// Adds demo data for trying the app:
//   - 3 more teachers, 4 more classes
//   - students for every class (about 10 per class)
//   - attendance reports for the last 14 days (Sundays are off; today only some
//     classes have reported, so the dashboard shows pending classes)
//
// It only ADDS data. Existing users, classes, students and reports are never
// changed or removed, and no report is added where one already exists for that
// class and date. Running it again is safe - it adds only what is missing.
//
// Run from the backend folder:  npm run demo-data

const { initDataFiles, readData, updateData } = require('../fileStore');
const { newId, todayString } = require('../helpers');

const DEMO_PASSWORD = 'teacher123'; // local demo only

const NEW_TEACHERS = [
  { id: 'u4', name: 'Nadia Hussain', username: 'nadia' },
  { id: 'u5', name: 'Omar Farooq', username: 'omar' },
  { id: 'u6', name: 'Hina Aslam', username: 'hina' },
];

const NEW_CLASSES = [
  { id: 'c4', name: 'Grade 3 - B', teacherId: 'u4' },
  { id: 'c5', name: 'Grade 4 - A', teacherId: 'u5' },
  { id: 'c6', name: 'Grade 5 - A', teacherId: 'u6' },
  { id: 'c7', name: 'Grade 5 - B', teacherId: 'u3' },
];

const FIRST_NAMES = [
  'Ali', 'Amna', 'Arham', 'Areeba', 'Bilal', 'Dua', 'Ebad', 'Eman', 'Faris', 'Hafsa',
  'Hassan', 'Iqra', 'Ibrahim', 'Javeria', 'Kashan', 'Laiba', 'Moiz', 'Mahnoor', 'Noman',
  'Noor', 'Rayan', 'Rida', 'Saad', 'Sana', 'Taha', 'Umaima', 'Wali', 'Yusra', 'Zaid', 'Zoya',
];
const LAST_NAMES = [
  'Ahmed', 'Butt', 'Chaudhry', 'Dar', 'Farooq', 'Ghani', 'Hashmi', 'Iqbal', 'Javed',
  'Khan', 'Latif', 'Mirza', 'Nawaz', 'Qureshi', 'Rana', 'Siddiqui', 'Sheikh', 'Zafar',
];
const REASONS = ['Sick', 'Sick', 'Fever', 'Family reason', 'Travelling', 'Appointment', 'Wedding in family', ''];

const STUDENTS_PER_CLASS = 10;
const DAYS = 14;

// Small seeded random number generator, so every run makes the same choices.
let seed = 20261019;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function addTeachers() {
  let added = 0;
  await updateData('users', (users) => {
    const result = [...users];
    for (const t of NEW_TEACHERS) {
      const exists = result.some((u) => u.id === t.id || u.username.toLowerCase() === t.username);
      if (!exists) {
        result.push({ ...t, password: DEMO_PASSWORD, role: 'teacher' });
        added++;
      }
    }
    return result;
  });
  return added;
}

async function addClasses() {
  let added = 0;
  const users = await readData('users');
  await updateData('classes', (classes) => {
    const result = [...classes];
    for (const c of NEW_CLASSES) {
      const exists = result.some((x) => x.id === c.id || x.name.toLowerCase() === c.name.toLowerCase());
      const teacherOk = users.some((u) => u.id === c.teacherId && u.role === 'teacher');
      if (!exists) {
        result.push({ ...c, teacherId: teacherOk ? c.teacherId : null });
        added++;
      }
    }
    return result;
  });
  return added;
}

async function addStudents() {
  let added = 0;
  const classes = await readData('classes');
  await updateData('students', (students) => {
    const result = [...students];
    const usedNames = new Set(result.map((s) => s.name));

    for (const cls of classes) {
      const inClass = result.filter((s) => s.classId === cls.id);
      let roll = Math.max(0, ...inClass.map((s) => Number(s.rollNumber) || 0));

      for (let i = inClass.length; i < STUDENTS_PER_CLASS; i++) {
        let name;
        do {
          name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        } while (usedNames.has(name));
        usedNames.add(name);
        roll++;
        result.push({
          id: newId(),
          rollNumber: String(roll),
          name,
          classId: cls.id,
          guardianName: random() < 0.6 ? `${pick(FIRST_NAMES)} ${name.split(' ')[1]}` : '',
          phone: random() < 0.5 ? `0300-${String(Math.floor(random() * 9000000) + 1000000)}` : '',
        });
        added++;
      }
    }
    return result;
  });
  return added;
}

async function addAttendance() {
  let added = 0;
  const [classes, users, students] = await Promise.all([
    readData('classes'),
    readData('users'),
    readData('students'),
  ]);
  const today = todayString();

  await updateData('attendance', (reports) => {
    const result = [...reports];

    for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
      const date = dateDaysAgo(daysAgo);
      if (new Date(`${date}T00:00:00`).getDay() === 0) continue; // Sunday: no school

      classes.forEach((cls, index) => {
        // Today: leave every third class pending so the dashboard shows it.
        if (date === today && index % 3 === 2) return;
        if (result.some((r) => r.classId === cls.id && r.date === date)) return;

        const classStudents = students.filter((s) => s.classId === cls.id);
        if (classStudents.length === 0) return;

        // Usually 0-2 absent, sometimes more. The first two students of each
        // class are absent more often, so "frequently absent" has something to show.
        const absentees = [];
        for (const [i, s] of classStudents.entries()) {
          const chance = i < 2 ? 0.3 : 0.08;
          if (random() < chance) absentees.push({ name: s.name, reason: pick(REASONS) });
        }
        // Occasionally one absent student is not identified by name.
        const unnamed = random() < 0.15 ? 1 : 0;

        const total = classStudents.length + unnamed;
        const absent = absentees.length + unnamed;
        const teacher = users.find((u) => u.id === cls.teacherId);
        const time = new Date(`${date}T08:${String(10 + Math.floor(random() * 40)).padStart(2, '0')}:00`).toISOString();

        result.push({
          id: newId(),
          classId: cls.id,
          date,
          className: cls.name,
          teacherId: cls.teacherId,
          teacherName: teacher ? teacher.name : null,
          totalStudents: total,
          present: total - absent,
          absent,
          addedToday: random() < 0.05 ? 1 : 0,
          leftToday: random() < 0.03 ? 1 : 0,
          absentees,
          createdAt: time,
          createdBy: teacher ? teacher.name : 'Admin User',
          updatedAt: time,
          updatedBy: teacher ? teacher.name : 'Admin User',
        });
        added++;
      });
    }
    return result;
  });
  return added;
}

async function main() {
  await initDataFiles();
  console.log(`Teachers added:   ${await addTeachers()}`);
  console.log(`Classes added:    ${await addClasses()}`);
  console.log(`Students added:   ${await addStudents()}`);
  console.log(`Reports added:    ${await addAttendance()}`);
  console.log(`New teachers log in with password "${DEMO_PASSWORD}" (local demo only).`);
}

main().catch((err) => {
  console.error('Could not add demo data:', err);
  process.exit(1);
});
