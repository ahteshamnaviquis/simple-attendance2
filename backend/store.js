// Reads and writes the app's data in MySQL.
//
// The routes see each table as a list of plain objects, just as they did with
// the JSON files, through two functions:
//   readData(name)              -> every row, in the order they were added
//   updateData(name, changeFn)  -> changeFn gets the current list and returns
//                                  the new one; only the differences are saved
// "settings" is one object ({ theme, adminPermissions }) instead of a list.
//
// All updates go through a single queue and each runs in a transaction, so two
// requests that change data at the same time run one after the other and a
// failed change saves nothing.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { DB } = require('./config');

// How each collection is stored: its table, and its properties as
// "property:type". The column is the property in snake_case (classId -> class_id).
// Types: text (the default), int, number, bool, date (YYYY-MM-DD),
// timestamp (ISO text in JavaScript, a UTC DATETIME in MySQL) and json.
// A trailing "?" marks a property that may be missing: NULL in MySQL, left out
// in JavaScript.
const COLLECTIONS = {
  users: { table: 'users', props: 'id name username password role disabled:bool?' },
  classes: { table: 'classes', props: 'id name teacherId' },
  students: { table: 'students', props: 'id rollNumber name classId guardianName phone' },
  subjects: { table: 'subjects', props: 'id name' },
  classSubjects: { table: 'class_subjects', props: 'id classId subjectId teacherId' },
  attendance: {
    table: 'attendance',
    props:
      'id classId date:date className teacherId teacherName totalStudents:int present:int absent:int ' +
      'addedToday:int leftToday:int absentees:json createdAt:timestamp createdBy updatedAt:timestamp updatedBy',
  },
  exams: {
    table: 'exams',
    props:
      'id name classId className date:date remarks subjects:json status disabled:bool? createdById createdBy ' +
      'createdAt:timestamp updatedAt:timestamp updatedBy publishedAt:timestamp publishedBy',
  },
  marks: {
    table: 'marks',
    props:
      'id examId subjectId studentId studentName rollNumber obtained:number absent:bool remarks ' +
      'updatedAt:timestamp updatedBy',
  },
};

// The order to fill an empty database in, so every row's parents already exist.
const LOAD_ORDER = ['users', 'classes', 'subjects', 'students', 'classSubjects', 'attendance', 'exams', 'marks', 'settings'];

for (const collection of Object.values(COLLECTIONS)) {
  collection.columns = collection.props.split(' ').map((spec) => {
    const [prop, rawType = 'text'] = spec.split(':');
    return {
      prop,
      column: prop.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
      type: rawType.replace('?', ''),
      optional: rawType.endsWith('?'),
    };
  });
}

const pool = mysql.createPool({
  ...DB,
  charset: 'utf8mb4',
  dateStrings: true, // DATE and DATETIME come back as text, with no time zone shifts
  timezone: 'Z',
  connectionLimit: 10,
});

function collectionFor(name) {
  const collection = COLLECTIONS[name];
  if (!collection) throw new Error(`Unknown data: ${name}`);
  return collection;
}

// ---------- Converting between objects and table rows ----------

// A JavaScript object -> { column: value } for MySQL.
function toRow(name, item) {
  const { columns } = collectionFor(name);
  const known = new Set(columns.map((c) => c.prop));
  for (const key of Object.keys(item)) {
    if (!known.has(key) && item[key] !== undefined) {
      throw new Error(`${name}: "${key}" has no column in MySQL (add it to store.js and sql/schema.sql)`);
    }
  }
  const row = {};
  for (const { prop, column, type } of columns) {
    const value = item[prop] ?? null;
    if (value === null) row[column] = null;
    else if (type === 'json') row[column] = JSON.stringify(value);
    else if (type === 'timestamp') row[column] = new Date(value).toISOString().slice(0, 23).replace('T', ' ');
    else row[column] = value;
  }
  return row;
}

// A MySQL row -> the JavaScript object the routes expect.
function fromRow(name, row) {
  const item = {};
  for (const { prop, column, type, optional } of collectionFor(name).columns) {
    const value = row[column];
    if (value === null) {
      if (!optional) item[prop] = null;
    } else if (type === 'bool') item[prop] = Boolean(value);
    else if (type === 'timestamp') item[prop] = `${value.replace(' ', 'T')}Z`;
    else item[prop] = value; // mysql2 already turns JSON columns into objects
  }
  return item;
}

// The table, column names and rows for a list of objects: what an INSERT needs.
// Also used by scripts/jsonToSql.js.
function rowsFor(name, items) {
  const { table, columns } = collectionFor(name);
  const names = columns.map((c) => c.column);
  return { table, columns: names, values: items.map((item) => names.map((n) => toRow(name, item)[n])) };
}

// ---------- Reading and saving ----------

// lock: also lock the rows until the transaction ends (used by updateData).
async function readData(name, conn = pool, { lock = false } = {}) {
  const forUpdate = lock ? ' FOR UPDATE' : '';
  if (name === 'settings') {
    const [rows] = await conn.query(`SELECT name, value FROM settings ORDER BY seq${forUpdate}`);
    return Object.fromEntries(rows.map((r) => [r.name, r.value]));
  }
  const { table } = collectionFor(name);
  const [rows] = await conn.query(`SELECT * FROM ?? ORDER BY seq${forUpdate}`, [table]);
  return rows.map((row) => fromRow(name, row));
}

// Save the difference between two versions of a collection: remove rows that
// are gone, update rows that changed, add new rows (in that order, so a new
// row can reuse a removed row's unique values).
async function saveChanges(conn, name, before, after) {
  if (name === 'settings') return saveSettings(conn, before, after);

  const { table } = collectionFor(name);
  const old = new Map(before.map((item) => [item.id, item]));
  const ids = new Set(after.map((item) => item.id));
  if (ids.size !== after.length) throw new Error(`${name}: two rows have the same id`);

  const removed = before.filter((item) => !ids.has(item.id)).map((item) => item.id);
  if (removed.length) await conn.query('DELETE FROM ?? WHERE id IN (?)', [table, removed]);

  const added = [];
  for (const item of after) {
    const previous = old.get(item.id);
    if (!previous) {
      added.push(item);
      continue;
    }
    const row = toRow(name, item);
    if (JSON.stringify(row) !== JSON.stringify(toRow(name, previous))) {
      await conn.query('UPDATE ?? SET ? WHERE id = ?', [table, row, item.id]);
    }
  }
  if (added.length) {
    const insert = rowsFor(name, added);
    await conn.query('INSERT INTO ?? (??) VALUES ?', [insert.table, insert.columns, insert.values]);
  }
}

async function saveSettings(conn, before, after) {
  const removed = Object.keys(before).filter((key) => !(key in after));
  if (removed.length) await conn.query('DELETE FROM settings WHERE name IN (?)', [removed]);
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(value) === JSON.stringify(before[key])) continue;
    await conn.query(
      'INSERT INTO settings (name, value) VALUES (?, ?) AS new ON DUPLICATE KEY UPDATE value = new.value',
      [key, JSON.stringify(value)]
    );
  }
}

async function inTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// The write queue: each update waits for the previous one to finish.
let queue = Promise.resolve();

// Read a collection, let `changeFn` modify it, then save the differences.
// `changeFn` receives the current data (and the transaction's connection, for
// saving a file in the same transaction) and returns the new data.
// Returns whatever `changeFn` returned.
function updateData(name, changeFn) {
  const task = queue.then(() =>
    inTransaction(async (conn) => {
      const current = await readData(name, conn, { lock: true });
      const updated = await changeFn(current, conn);
      await saveChanges(conn, name, current, updated);
      return updated;
    })
  );
  // Keep the queue going even if this task fails.
  queue = task.catch(() => {});
  return task;
}

// ---------- Files (the logo) ----------

async function readFile(name, conn = pool) {
  const [rows] = await conn.query('SELECT type, data FROM files WHERE name = ?', [name]);
  return rows[0] ?? null;
}

async function writeFile(name, type, data, conn = pool) {
  await conn.query(
    'INSERT INTO files (name, type, data) VALUES (?, ?, ?) AS new ' +
      'ON DUPLICATE KEY UPDATE type = new.type, data = new.data, updated_at = CURRENT_TIMESTAMP(3)',
    [name, type, data]
  );
}

async function deleteFile(name, conn = pool) {
  await conn.query('DELETE FROM files WHERE name = ?', [name]);
}

// ---------- Setting up the database ----------

// The statements in sql/schema.sql, without comments.
function schemaStatements() {
  const text = fs.readFileSync(path.join(__dirname, 'sql', 'schema.sql'), 'utf8');
  return text
    .replace(/--.*$/gm, '')
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

// Add a whole set of data ({ users: [...], ..., settings: {...} }) to empty tables.
async function importData(data) {
  await inTransaction(async (conn) => {
    for (const name of LOAD_ORDER) {
      if (data[name]) await saveChanges(conn, name, name === 'settings' ? {} : [], data[name]);
    }
  });
}

// Create the database and its tables if they are missing. A brand-new
// database is filled with `startData` (the sample data from seedData.js).
// Returns true when the database was new.
async function initDatabase(startData) {
  const server = await mysql.createConnection({ ...DB, database: undefined });
  try {
    await server.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4', [DB.database]);
  } catch (err) {
    // Not allowed to create databases: fine if it already exists.
    if (err.code !== 'ER_DBACCESS_DENIED_ERROR') throw err;
  } finally {
    await server.end();
  }

  const [found] = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
  );
  const isNew = found[0].n === 0;
  for (const statement of schemaStatements()) await pool.query(statement);
  if (isNew && startData) {
    await importData(startData);
    console.log(`Created the tables in "${DB.database}" and added the sample data`);
  }
  return isNew;
}

// Remove a test database (testServer.js). Refuses any other name.
async function dropDatabase() {
  if (!DB.database.startsWith('attendance_test_')) throw new Error(`Not a test database: ${DB.database}`);
  await pool.query('DROP DATABASE IF EXISTS ??', [DB.database]);
}

// Close the connections, so a script can finish.
function closeDatabase() {
  return pool.end();
}

module.exports = {
  readData,
  updateData,
  readFile,
  writeFile,
  deleteFile,
  initDatabase,
  importData,
  closeDatabase,
  dropDatabase,
  rowsFor,
  schemaStatements,
  LOAD_ORDER,
};
