// Reads and writes the app's data in MySQL.
//
// The routes see each table as a list of plain objects, just as they did with
// the JSON files, through two functions:
//   readData(name)              -> every row, in the order they were added
//   updateData(name, changeFn)  -> changeFn gets the current list and returns
//                                  the new one; only the differences are saved
//   updateMany(names, changeFn) -> the same for several collections at once,
//                                  in one transaction (all saved, or none)
// "settings" is one object ({ theme, adminPermissions }) instead of a list.
//
// All updates go through a single queue and each runs in a transaction, so two
// requests that change data at the same time run one after the other and a
// failed change saves nothing.
//
// Several academies (schools) share the database. Every row belongs to one
// academy (its academy_id), and reads and writes only see the current
// academy's rows. The current academy is set per request (server.js, from the
// logged-in user) with withAcademy(id, fn); scripts that set none work on the
// first academy, DEFAULT_ACADEMY. unscoped(fn) sees every academy (logging in,
// the platform owner's pages).

const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2/promise');
const { DB } = require('./config');

// ---------- Which academy's data ----------

// The academy that existed before there were several: old data, and scripts.
const DEFAULT_ACADEMY = 'default';
// "Every academy" (see unscoped).
const ALL = Symbol('all academies');

const scope = new AsyncLocalStorage();

// Run fn with academyId as the current academy. null = no academy (the
// platform owner): reads find nothing and writes are refused.
function withAcademy(academyId, fn) {
  return scope.run({ academyId }, fn);
}

// Run fn seeing the rows of every academy.
function unscoped(fn) {
  return scope.run({ academyId: ALL }, fn);
}

function currentAcademy() {
  const store = scope.getStore();
  return store ? store.academyId : DEFAULT_ACADEMY;
}

function noAcademyError() {
  return Object.assign(new Error('No academy is selected'), { status: 403 });
}

// How each collection is stored: its table, and its properties as
// "property:type". The column is the property in snake_case (classId -> class_id).
// Types: text (the default), int, number, bool, date (YYYY-MM-DD),
// timestamp (ISO text in JavaScript, a UTC DATETIME in MySQL) and json.
// A trailing "?" marks a property that may be missing: NULL in MySQL, left out
// in JavaScript.
// academyId (the academy_id column) is added to every collection below except
// academies, which all of them share ("global").
const COLLECTIONS = {
  academies: { table: 'academies', global: true, props: 'id name prefix:text? disabled:bool? createdAt:timestamp' },
  // photo (users and students): { key, type } of their profile photo (photos.js); missing = none.
  users: { table: 'users', props: 'id name username password role disabled:bool? photo:json?' },
  classes: { table: 'classes', props: 'id name teacherId' },
  // gender: "male" or "female" (shown to parents as son or daughter); missing = not given.
  students: { table: 'students', props: 'id rollNumber name gender:text? classId guardianName phone photo:json?' },
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
  // One row per parent account (id = the parent's user id): how they are related
  // to their children and how to reach them.
  parentProfiles: {
    table: 'parent_profiles',
    props: 'id relation phone altPhone email cnic occupation address',
  },
  parentStudents: { table: 'parent_students', props: 'id parentId studentId' },
  messages: {
    table: 'messages',
    props:
      'id parentId teacherId fromSchool:bool senderId senderName senderRole body createdAt:timestamp readAt:timestamp',
  },
  diary: {
    table: 'diary',
    props:
      'id classId className subjectId subjectName date:date title body createdById createdBy ' +
      'createdAt:timestamp updatedAt:timestamp',
  },
  leaves: {
    table: 'leaves',
    props:
      'id studentId studentName classId className parentId parentName fromDate:date toDate:date reason status ' +
      'reviewNote reviewedById reviewedBy reviewedAt:timestamp createdAt:timestamp',
  },
  feedback: {
    table: 'feedback',
    props:
      'id kind subject body fromId fromName fromRole studentId studentName status reply repliedBy ' +
      'repliedAt:timestamp createdAt:timestamp',
  },
  galleryAlbums: {
    table: 'gallery_albums',
    props: 'id title description date:date classId className createdById createdBy createdAt:timestamp',
  },
  galleryPhotos: { table: 'gallery_photos', props: 'id albumId type createdBy createdAt:timestamp' },
};

// Columns added to a table after it was first released. CREATE TABLE IF NOT
// EXISTS leaves an existing table as it is, so these are added on start when missing.
const ADDED_COLUMNS = [
  { table: 'students', column: 'gender', definition: 'VARCHAR(10) NULL AFTER name' },
  { table: 'messages', column: 'teacher_id', definition: 'VARCHAR(64) NULL AFTER parent_id' },
  { table: 'messages', column: 'sender_role', definition: "VARCHAR(20) NOT NULL DEFAULT '' AFTER sender_name" },
  { table: 'academies', column: 'prefix', definition: 'VARCHAR(3) NULL AFTER name' },
  { table: 'users', column: 'photo', definition: 'JSON NULL AFTER disabled' },
  { table: 'students', column: 'photo', definition: 'JSON NULL AFTER phone' },
];

// The order to fill an empty database in, so every row's parents already exist.
const LOAD_ORDER = ['academies', 'users', 'classes', 'subjects', 'students', 'classSubjects', 'attendance', 'exams', 'marks', 'parentProfiles', 'parentStudents', 'messages', 'diary', 'leaves', 'feedback', 'galleryAlbums', 'galleryPhotos', 'settings'];

// The tables whose rows belong to an academy: every collection's but
// academies, and settings.
const ACADEMY_TABLES = [
  ...Object.values(COLLECTIONS)
    .filter((c) => !c.global)
    .map((c) => c.table),
  'settings',
];

for (const collection of Object.values(COLLECTIONS)) {
  if (!collection.global) collection.props += ' academyId:text?';
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
// academy: whose rows (the current academy unless given).
async function readData(name, conn = pool, { lock = false, academy = currentAcademy() } = {}) {
  const forUpdate = lock ? ' FOR UPDATE' : '';
  if (name === 'settings') {
    if (academy === ALL) throw new Error('settings: choose an academy');
    if (academy === null) return {};
    const [rows] = await conn.query(
      `SELECT name, value FROM settings WHERE academy_id = ? ORDER BY seq${forUpdate}`,
      [academy]
    );
    return Object.fromEntries(rows.map((r) => [r.name, r.value]));
  }
  const { table, global } = collectionFor(name);
  if (!global && academy === null) return [];
  const [rows] =
    global || academy === ALL
      ? await conn.query(`SELECT * FROM ?? ORDER BY seq${forUpdate}`, [table])
      : await conn.query(`SELECT * FROM ?? WHERE academy_id = ? ORDER BY seq${forUpdate}`, [table, academy]);
  return rows.map((row) => fromRow(name, row));
}

// Save the difference between two versions of a collection: remove rows that
// are gone, update rows that changed, add new rows (in that order, so a new
// row can reuse a removed row's unique values).
// The rows of an academy stay in that academy: changes and removals only touch
// its rows, and new rows get its id. Seeing every academy (unscoped), each row
// keeps the academyId it has.
async function saveChanges(conn, name, before, after, academy = currentAcademy()) {
  if (name === 'settings') return saveSettings(conn, before, after, academy);

  const { table, global } = collectionFor(name);
  const scoped = !global && academy !== ALL;
  if (scoped && academy === null) {
    if (before.length || after.length) throw noAcademyError();
    return;
  }
  const own = (item) => (scoped ? { ...item, academyId: academy } : item);
  const [onlyAcademy, academyArgs] = scoped ? [' AND academy_id = ?', [academy]] : ['', []];

  const old = new Map(before.map((item) => [item.id, item]));
  const ids = new Set(after.map((item) => item.id));
  if (ids.size !== after.length) throw new Error(`${name}: two rows have the same id`);

  const removed = before.filter((item) => !ids.has(item.id)).map((item) => item.id);
  if (removed.length) {
    await conn.query(`DELETE FROM ?? WHERE id IN (?)${onlyAcademy}`, [table, removed, ...academyArgs]);
  }

  const added = [];
  for (const item of after) {
    const previous = old.get(item.id);
    if (!previous) {
      added.push(own(item));
      continue;
    }
    const row = toRow(name, own(item));
    if (JSON.stringify(row) !== JSON.stringify(toRow(name, previous))) {
      await conn.query(`UPDATE ?? SET ? WHERE id = ?${onlyAcademy}`, [table, row, item.id, ...academyArgs]);
    }
  }
  if (added.length) {
    const insert = rowsFor(name, added);
    await conn.query('INSERT INTO ?? (??) VALUES ?', [insert.table, insert.columns, insert.values]);
  }
}

async function saveSettings(conn, before, after, academy) {
  if (academy === ALL) throw new Error('settings: choose an academy');
  if (academy === null) throw noAcademyError();
  const removed = Object.keys(before).filter((key) => !(key in after));
  if (removed.length) {
    await conn.query('DELETE FROM settings WHERE academy_id = ? AND name IN (?)', [academy, removed]);
  }
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(value) === JSON.stringify(before[key])) continue;
    // Replace the row (in this transaction). Not "INSERT ... AS new ON DUPLICATE
    // KEY UPDATE": that is MySQL 8 only, and cPanel hosts often run MariaDB.
    const json = JSON.stringify(value);
    if (key in before) {
      await conn.query('UPDATE settings SET value = ? WHERE academy_id = ? AND name = ?', [json, academy, key]);
    } else {
      await conn.query('INSERT INTO settings (academy_id, name, value) VALUES (?, ?, ?)', [academy, key, json]);
    }
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

// Read several collections, let `changeFn` modify them, then save the
// differences, all in one transaction. `changeFn` receives { name: data } (and
// the transaction's connection) and returns { name: newData } for the
// collections it changed. They are saved in LOAD_ORDER, so a new row's parents
// (a new user before its profile) are saved first.
// Returns the saved data of every collection in `names`.
function updateMany(names, changeFn) {
  // The caller's academy, kept for the whole task (it runs later, in the queue).
  const academy = currentAcademy();
  const task = queue.then(() =>
    scope.run({ academyId: academy }, () =>
      inTransaction(async (conn) => {
        const current = {};
        for (const name of names) current[name] = await readData(name, conn, { lock: true, academy });
        const updated = { ...current, ...(await changeFn(current, conn)) };
        for (const name of LOAD_ORDER) {
          if (names.includes(name)) await saveChanges(conn, name, current[name], updated[name], academy);
        }
        return updated;
      })
    )
  );
  // Keep the queue going even if this task fails.
  queue = task.catch(() => {});
  return task;
}

// Read a collection, let `changeFn` modify it, then save the differences.
// `changeFn` receives the current data (and the transaction's connection, for
// saving a file in the same transaction) and returns the new data.
// Returns the saved data.
async function updateData(name, changeFn) {
  const saved = await updateMany([name], async (data, conn) => ({ [name]: await changeFn(data[name], conn) }));
  return saved[name];
}

// ---------- Files (the logo and gallery photos) ----------
// Each academy's files are stored as "<academy id>:<name>", such as
// "default:logo"; callers only use the name.

function storedFileName(name) {
  const academy = currentAcademy();
  if (academy === ALL || academy === null) throw noAcademyError();
  return `${academy}:${name}`;
}

async function readFile(name, conn = pool) {
  if (currentAcademy() === null) return null;
  const [rows] = await conn.query('SELECT type, data FROM files WHERE name = ?', [storedFileName(name)]);
  return rows[0] ?? null;
}

// Replaces the file. Callers pass a transaction's connection (see routes/settings.js),
// so the delete and insert happen together. Plain DELETE + INSERT works on MySQL
// and on MariaDB, which cPanel hosts often run.
async function writeFile(name, type, data, conn = pool) {
  const stored = storedFileName(name);
  await conn.query('DELETE FROM files WHERE name = ?', [stored]);
  await conn.query('INSERT INTO files (name, type, data) VALUES (?, ?, ?)', [stored, type, data]);
}

// names: one name, or a list of them.
async function deleteFile(names, conn = pool) {
  const stored = [].concat(names).map(storedFileName);
  if (stored.length) await conn.query('DELETE FROM files WHERE name IN (?)', [stored]);
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
  await addMissingColumns();
  await upgradeToAcademies();
  if (isNew && startData) {
    await importData(startData);
    console.log(`Created the tables in "${DB.database}" and added the sample data`);
  }
  await ensureDefaultAcademy();
  await assignMissingPrefixes();
  return isNew;
}

// Academies made before username prefixes get one from their name (see
// usernamePrefix.js). Their existing usernames are not changed.
async function assignMissingPrefixes() {
  const { freePrefix } = require('./usernamePrefix'); // here: it is not needed before
  const [rows] = await pool.query('SELECT id, name, prefix FROM academies ORDER BY seq');
  const taken = new Set(rows.map((r) => r.prefix).filter(Boolean));
  for (const row of rows.filter((r) => !r.prefix)) {
    const prefix = freePrefix(row.name, taken);
    taken.add(prefix);
    await pool.query('UPDATE academies SET prefix = ? WHERE id = ?', [prefix, row.id]);
  }
  if (!(await indexExists('academies', 'uq_academies_prefix'))) {
    await pool.query('ALTER TABLE academies ADD UNIQUE KEY uq_academies_prefix (prefix)');
  }
  await prefixOldUsernames();
}

// Usernames without their academy's prefix (made before prefixes, or added by a
// script) get it: "sara" -> "dat.sara". Passwords stay the same. A username
// that would clash with an existing one, or be too long, is left and reported.
async function prefixOldUsernames() {
  const [academies] = await pool.query('SELECT id, prefix FROM academies WHERE prefix IS NOT NULL');
  const prefixOf = new Map(academies.map((a) => [a.id, a.prefix]));
  const [users] = await pool.query("SELECT id, username, academy_id FROM users WHERE role <> 'owner' ORDER BY seq");
  const taken = new Set(users.map((u) => u.username.toLowerCase()));
  let renamed = 0;
  for (const user of users) {
    const prefix = prefixOf.get(user.academy_id);
    const current = user.username.toLowerCase();
    if (!prefix || current.startsWith(`${prefix}.`)) continue;
    const username = `${prefix}.${current}`;
    if (taken.has(username) || username.length > 60) {
      console.warn(`Username "${user.username}" kept: "${username}" is already used or too long`);
      continue;
    }
    await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, user.id]);
    taken.add(username);
    renamed += 1;
  }
  if (renamed) console.log(`Added the academy prefix to ${renamed} usernames (such as "sara" -> "dat.sara")`);
}

async function indexExists(table, index) {
  const [found] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, index]
  );
  return found[0].n > 0;
}

// Databases made when the app was for one academy: every row goes to the first
// academy (DEFAULT_ACADEMY). Safe to run again: it only changes what is missing.
async function upgradeToAcademies() {
  for (const table of ACADEMY_TABLES) {
    const [found] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'academy_id'",
      [table]
    );
    if (found[0].n === 0) {
      const definition =
        table === 'settings' ? `NOT NULL DEFAULT '${DEFAULT_ACADEMY}' AFTER seq` : 'NULL AFTER id';
      await pool.query(`ALTER TABLE ?? ADD COLUMN academy_id VARCHAR(64) ${definition}`, [table]);
    }
    const index = `idx_${table}_academy`;
    if (table !== 'settings' && !(await indexExists(table, index))) {
      await pool.query('ALTER TABLE ?? ADD INDEX ?? (academy_id)', [table, index]);
    }
    // Every row but the platform owner's account belongs to an academy.
    const notOwner = table === 'users' ? " AND role <> 'owner'" : '';
    await pool.query(`UPDATE ?? SET academy_id = ? WHERE academy_id IS NULL${notOwner}`, [table, DEFAULT_ACADEMY]);
  }

  // Settings: one row per academy and name.
  const [key] = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND table_name = 'settings' AND constraint_name = 'PRIMARY' AND column_name = 'academy_id'"
  );
  if (key[0].n === 0) await pool.query('ALTER TABLE settings DROP PRIMARY KEY, ADD PRIMARY KEY (academy_id, name)');

  // Subject names: unique within an academy, not across all of them.
  if (await indexExists('subjects', 'name')) await pool.query('ALTER TABLE subjects DROP INDEX name');
  if (!(await indexExists('subjects', 'uq_subjects_academy_name'))) {
    await pool.query('ALTER TABLE subjects ADD UNIQUE KEY uq_subjects_academy_name (academy_id, name)');
  }

  // Files: room for the academy in the name; older files belong to the first academy.
  await pool.query('ALTER TABLE files MODIFY name VARCHAR(120) NOT NULL');
  await pool.query("UPDATE files SET name = CONCAT(?, ':', name) WHERE name NOT LIKE '%:%'", [DEFAULT_ACADEMY]);
}

// The first academy's row, named after the school name in its settings, when
// it has data but no row yet (a database from before academies, or a new one).
async function ensureDefaultAcademy() {
  const [[{ n: hasRow }]] = await pool.query('SELECT COUNT(*) AS n FROM academies WHERE id = ?', [DEFAULT_ACADEMY]);
  if (hasRow) return;
  // Not before its data is there (the next start adds the row).
  const [[{ n: users }]] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE academy_id = ?', [DEFAULT_ACADEMY]);
  if (!users) return;
  const settings = await withAcademy(DEFAULT_ACADEMY, () => readData('settings'));
  const name = String(settings.theme?.schoolName || 'My Academy').slice(0, 100);
  await pool.query('INSERT INTO academies (id, name, created_at) VALUES (?, ?, ?)', [
    DEFAULT_ACADEMY,
    name,
    new Date().toISOString().slice(0, 23).replace('T', ' '),
  ]);
}

async function addMissingColumns() {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const [found] = await pool.query(
      'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [table, column]
    );
    if (found[0].n === 0) await pool.query(`ALTER TABLE ?? ADD COLUMN ?? ${definition}`, [table, column]);
  }
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
  withAcademy,
  unscoped,
  currentAcademy,
  DEFAULT_ACADEMY,
  readData,
  updateData,
  updateMany,
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
