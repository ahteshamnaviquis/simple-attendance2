// Turns the JSON data files (the format before MySQL) into an SQL script of
// INSERT statements: the same users, classes, students, reports, exams, marks
// and settings, ready to load into the tables from sql/schema.sql.
//
// Run from the backend folder:
//   npm run json-to-sql                          backend/data -> sql/data.sql
//   node scripts/jsonToSql.js <folder> <file>    any folder of JSON files
//
// Then load it into an empty database:
//   mysql -u root -p attendance -e "source sql/schema.sql"
//   mysql -u root -p attendance -e "source sql/data.sql"
//
// A logo uploaded before MySQL (the file "logo" next to the JSON files) is
// included too.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { rowsFor, LOAD_ORDER } = require('../store');

const folder = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data'));
const output = path.resolve(process.argv[3] || path.join(__dirname, '..', 'sql', 'data.sql'));

function readJson(name) {
  const file = path.join(folder, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// One INSERT per row keeps the file readable and easy to compare.
function insertsFor(name, items) {
  const { table, columns, values } = rowsFor(name, items);
  return values.map((row) => mysql.format('INSERT INTO ?? (??) VALUES (?);', [table, columns, row]));
}

const lines = [
  '-- Sample data for the Simple Daily Attendance system, the same as the JSON files',
  `-- it was made from (${path.relative(path.join(__dirname, '..'), folder) || '.'}). Made by scripts/jsonToSql.js.`,
  '-- Load it into a database that has the tables from sql/schema.sql:',
  '--   mysql -u root -p attendance -e "source sql/data.sql"',
  '-- It empties the tables first, so it can be loaded again to start over.',
  '',
  'SET NAMES utf8mb4;',
  'START TRANSACTION;',
  'SET FOREIGN_KEY_CHECKS = 0;',
  ...[...LOAD_ORDER, 'files'].reverse().map((name) => `DELETE FROM ${name === 'classSubjects' ? 'class_subjects' : name};`),
  'SET FOREIGN_KEY_CHECKS = 1;',
];

const counts = [];
for (const name of LOAD_ORDER) {
  const data = readJson(name);
  if (!data) continue;
  lines.push('', `-- ${name}`);

  if (name === 'settings') {
    let logo = data.theme?.logo ?? null;
    const logoFile = path.join(folder, 'logo');
    if (logo && fs.existsSync(logoFile)) {
      const image = fs.readFileSync(logoFile);
      lines.push(mysql.format('INSERT INTO files (name, type, data) VALUES (?, ?, ?);', ['logo', logo.type, image]));
    } else if (logo) {
      logo = null; // the settings mention a logo, but its file is missing
    }
    const settings = { ...data, theme: data.theme && { ...data.theme, logo } };
    for (const [key, value] of Object.entries(settings)) {
      lines.push(mysql.format('INSERT INTO settings (name, value) VALUES (?, ?);', [key, JSON.stringify(value)]));
    }
    counts.push(`settings: ${Object.keys(settings).length}`);
    continue;
  }

  lines.push(...insertsFor(name, data));
  counts.push(`${name}: ${data.length}`);
}

lines.push('', 'COMMIT;', '');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, lines.join('\n'), 'utf8');
console.log(`Wrote ${path.relative(process.cwd(), output)} (${counts.join(', ')})`);
