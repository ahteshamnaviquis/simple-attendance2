// Loads a folder of JSON files (the format before MySQL, with its "logo" file)
// into MySQL, replacing everything in the tables, and fills in what older data
// is missing:
//   - a student's gender, when it isn't given: "female" when the class name
//     says Girls, "male" when it says Boys, otherwise guessed from the name
//   - a parent account for every student who has none. Brothers and sisters
//     with the same phone number share one parent. The parent's name is the
//     student's guardian name, or "Parent of <student>" when there is none.
//     Username: the phone number (or parent.<student name> without a phone).
//     Password: PARENT_PASSWORD from the environment, or "parent123".
//
// Steps: the completed JSON goes to sql/import-data/, the SQL made from it to
// sql/import.sql (scripts/jsonToSql.js), and that is loaded into the database
// from backend/.env (scripts/setupDatabase.js). The SQL empties every table
// first, so running this again starts over.
//
// Where the JSON files are read from (the first that has students.json):
//   1. the folder given on the command line
//   2. this script's own folder (backend/scripts), so on a server such as
//      cPanel you can upload the JSON files and logo next to this script
//   3. the folder it is run from
//
// Run from the backend folder:
//   npm run import-data                          JSON files in scripts/data (see package.json)
//   node scripts/importJsonFolder.js             JSON files next to this script
//   npm run import-data -- "D:\Temp\attendence Data"
//   npm run import-data -- --sql-only            make import.sql, don't load it
// On cPanel: Setup Node.js App -> Run JS script -> import-data, or in the
// Terminal: cd into the app's folder, then  node scripts/importJsonFolder.js

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const sqlOnly = args.includes('--sql-only');
const given = args.find((a) => !a.startsWith('--'));
const candidates = given ? [path.resolve(given)] : [__dirname, process.cwd()];
const folder = candidates.find((dir) => fs.existsSync(path.join(dir, 'students.json')));
if (!folder) {
  console.error(`No students.json found in: ${candidates.join(' or ')}`);
  console.error('Put the JSON files (and logo) there, or run: npm run import-data -- "<folder with the JSON files>"');
  process.exit(1);
}
const backend = path.join(__dirname, '..');
const outFolder = path.join(backend, 'sql', 'import-data');
const sqlFile = path.join(backend, 'sql', 'import.sql');
const PARENT_PASSWORD = process.env.PARENT_PASSWORD || 'parent123';

function readJson(name, fallback) {
  const file = path.join(folder, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}


const data = {};
for (const name of ['users', 'classes', 'subjects', 'students', 'classSubjects', 'attendance', 'exams', 'marks', 'messages']) {
  data[name] = readJson(name, []);
}
data.parentProfiles = readJson('parentProfiles', []);
data.parentStudents = readJson('parentStudents', []);
data.settings = readJson('settings', null);

// ---------- Gender ----------

// Common girls' names (first word of the name), for classes that are not
// marked Boys or Girls.
const GIRL_NAMES = new Set(
  ('aiza aleena aliza amina amna anam anaya anum anumta areeba arooj asma ayat ayesha aisha bushra eman emaan ' +
    'esha fatima fiza hafsa hamna hareem hira hiba iqra iram javeria kainat khadija laiba maham maha maira maria ' +
    'marium maryam mehwish minahil mubarah mubashara muskan nabiha nadia naila nimra noor rabia rida rimsha ' +
    'saba sadia safa sana sara sehar sidra sobia sumaira tooba ume umme urooj zainab zara zoya abeeha afia ashfa ' +
    'qareeha aqsa alishba dua')
    .split(' ')
);

function guessGender(student) {
  const className = data.classes.find((c) => c.id === student.classId)?.name ?? '';
  if (/\bgirls?\b/i.test(className)) return 'female';
  if (/\bboys?\b/i.test(className)) return 'male';
  const first = student.name.trim().split(/\s+/)[0].toLowerCase();
  return GIRL_NAMES.has(first) ? 'female' : 'male';
}

let gendersAdded = 0;
data.students = data.students.map((s) => {
  if (s.gender === 'male' || s.gender === 'female') return s;
  gendersAdded += 1;
  return { ...s, gender: guessGender(s) };
});

// ---------- Parents ----------

const usernames = new Set(data.users.map((u) => u.username.toLowerCase()));
function freeUsername(wanted) {
  let name = wanted;
  for (let i = 2; usernames.has(name); i += 1) name = `${wanted}${i}`;
  usernames.add(name);
  return name;
}
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

const hasParent = new Set(data.parentStudents.map((l) => l.studentId));
const parentByPhone = new Map(); // phone digits -> parent user id, so siblings share one parent
let parentsAdded = 0;
let linksAdded = 0;

for (const student of data.students) {
  if (hasParent.has(student.id)) continue;
  const phone = (student.phone ?? '').trim();
  const digits = phone.replace(/\D/g, '');
  let parentId = digits ? parentByPhone.get(digits) : undefined;

  if (!parentId) {
    parentId = randomUUID();
    const guardian = (student.guardianName ?? '').trim();
    data.users.push({
      id: parentId,
      name: guardian || `Parent of ${student.name.trim()}`,
      username: freeUsername(digits || `parent.${slug(student.name)}`),
      password: PARENT_PASSWORD,
      role: 'parent',
    });
    data.parentProfiles.push({
      id: parentId,
      relation: guardian ? 'Father' : 'Guardian',
      phone,
      altPhone: '',
      email: '',
      cnic: '',
      occupation: '',
      address: '',
    });
    if (digits) parentByPhone.set(digits, parentId);
    parentsAdded += 1;
  } else {
    // A brother or sister already made this parent: use the guardian name if it had none.
    const user = data.users.find((u) => u.id === parentId);
    const guardian = (student.guardianName ?? '').trim();
    if (guardian && user.name.startsWith('Parent of ')) {
      user.name = guardian;
      data.parentProfiles.find((p) => p.id === parentId).relation = 'Father';
    }
  }

  data.parentStudents.push({ id: randomUUID(), parentId, studentId: student.id });
  linksAdded += 1;
}

// ---------- Write the JSON, make the SQL, load it ----------

fs.rmSync(outFolder, { recursive: true, force: true });
fs.mkdirSync(outFolder, { recursive: true });
for (const [name, value] of Object.entries(data)) {
  if (value === null) continue;
  fs.writeFileSync(path.join(outFolder, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
const logo = path.join(folder, 'logo');
if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(outFolder, 'logo'));

console.log(`Read ${folder}`);
console.log(`  genders filled in: ${gendersAdded} of ${data.students.length} students`);
console.log(`  parent accounts added: ${parentsAdded}, linked to ${linksAdded} students (password: ${PARENT_PASSWORD})`);

const run = (script, ...scriptArgs) =>
  execFileSync(process.execPath, [path.join(__dirname, script), ...scriptArgs], { cwd: backend, stdio: 'inherit' });

run('jsonToSql.js', outFolder, sqlFile);
if (sqlOnly) {
  console.log('Not loaded (--sql-only). Load it with: npm run setup-db -- sql/import.sql');
} else {
  run('setupDatabase.js', sqlFile);
}
