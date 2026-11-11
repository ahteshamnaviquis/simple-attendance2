// Creates the MySQL database with its tables and loads the data, in one step:
//   1. the database from backend/.env (DB_NAME), if it's missing
//   2. the tables from sql/schema.sql, if they're missing
//   3. the data from sql/data.sql (the same as the JSON files in backend/data)
//
// data.sql empties the tables first, so running this again starts over with
// the same data. Anything added in the app since is removed.
//
// Run from the backend folder:
//   npm run setup-db                          loads sql/data.sql
//   node scripts/setupDatabase.js <file.sql>  loads another data file
//                                             (made with scripts/jsonToSql.js)

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { DB } = require('../config');
const { initDatabase, closeDatabase } = require('../store');

const dataFile = path.resolve(process.argv[2] || path.join(__dirname, '..', 'sql', 'data.sql'));

async function main() {
  if (!fs.existsSync(dataFile)) throw new Error(`No data file: ${dataFile}`);

  await initDatabase(); // the database and tables, without the seedData.js sample data
  console.log(`Database "${DB.database}" and its tables are ready`);

  // data.sql is many statements, so this connection may run them all at once.
  const conn = await mysql.createConnection({ ...DB, multipleStatements: true });
  try {
    await conn.query(fs.readFileSync(dataFile, 'utf8'));
    await initDatabase(); // again: the loaded rows (and logo) go to the first academy
    const [rows] = await conn.query(
      `SELECT 'users' AS name, COUNT(*) AS n FROM users
       UNION ALL SELECT 'classes', COUNT(*) FROM classes
       UNION ALL SELECT 'students', COUNT(*) FROM students
       UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
       UNION ALL SELECT 'exams', COUNT(*) FROM exams
       UNION ALL SELECT 'marks', COUNT(*) FROM marks
       UNION ALL SELECT 'parents', COUNT(*) FROM parent_profiles
       UNION ALL SELECT 'messages', COUNT(*) FROM messages`
    );
    console.log(`Loaded ${path.relative(process.cwd(), dataFile)} (${rows.map((r) => `${r.name}: ${r.n}`).join(', ')})`);
  } finally {
    await conn.end();
  }
}

main()
  .catch((err) => {
    console.error(`Could not set up the database: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
