// Starting data used only when a JSON file does not exist yet.
// Plain-text passwords are ONLY acceptable for a disposable local demo.

const users = [
  { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
  { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
  { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher' },
  { id: 'u4', name: 'Nadia Hussain', username: 'nadia', password: 'teacher123', role: 'teacher' },
  { id: 'u5', name: 'Omar Farooq', username: 'omar', password: 'teacher123', role: 'teacher' },
  { id: 'u6', name: 'Hina Aslam', username: 'hina', password: 'teacher123', role: 'teacher' },
  { id: 'u7', name: 'Kamran Javed', username: 'kamran', password: 'teacher123', role: 'teacher' },
  { id: 'u8', name: 'Farah Naz', username: 'farah', password: 'teacher123', role: 'teacher' },
  { id: 'u9', name: 'Zainab Malik', username: 'zainab', password: 'teacher123', role: 'teacher' },
];

// Each class with its class teacher (attendance and students).
const classes = [
  { id: 'c1', name: 'Grade 9', teacherId: 'u2' },
  { id: 'c2', name: 'Grade 10', teacherId: 'u3' },
];

// A few students per class. rollNumber is unique within a class.
// (npm run demo-data fills every class up to 10 students.)
const students = [
  { id: 's1', rollNumber: '1', name: 'Ahmed Hassan', classId: 'c1', guardianName: 'Hassan Ali', phone: '0300-1111111' },
  { id: 's2', rollNumber: '2', name: 'Ayesha Malik', classId: 'c1', guardianName: 'Tariq Malik', phone: '' },
  { id: 's3', rollNumber: '3', name: 'Bilal Ahmed', classId: 'c1', guardianName: '', phone: '' },
  { id: 's4', rollNumber: '1', name: 'Fatima Noor', classId: 'c2', guardianName: 'Noor Khan', phone: '0300-2222222' },
  { id: 's5', rollNumber: '2', name: 'Hamza Iqbal', classId: 'c2', guardianName: '', phone: '' },
];

const attendance = [];

// Subjects taught at the academy (Matric, Grade 9 and 10).
const subjects = [
  { id: 'sub1', name: 'English' },
  { id: 'sub2', name: 'Mathematics' },
  { id: 'sub3', name: 'Urdu' },
  { id: 'sub4', name: 'Physics' },
  { id: 'sub5', name: 'Chemistry' },
  { id: 'sub6', name: 'Biology' },
  { id: 'sub7', name: 'Islamiyat' },
  { id: 'sub8', name: 'Pakistan Studies' },
  { id: 'sub9', name: 'Computer Science' },
];

// Who teaches each subject (by username), in every class.
const SUBJECT_TEACHERS = {
  English: 'sara',
  Mathematics: 'ali',
  Urdu: 'kamran',
  Physics: 'nadia',
  Chemistry: 'omar',
  Biology: 'hina',
  Islamiyat: 'farah',
  'Pakistan Studies': 'farah',
  'Computer Science': 'zainab',
};

// Every class studies every subject, taught by the teacher above.
const classSubjects = classes.flatMap((cls) =>
  subjects.map((subject) => ({
    id: `${cls.id}-${subject.id}`,
    classId: cls.id,
    subjectId: subject.id,
    teacherId: users.find((u) => u.username === SUBJECT_TEACHERS[subject.name])?.id ?? null,
  }))
);

// Examinations start empty: the admin creates them, subject teachers enter marks.
const exams = [];
const marks = [];

module.exports = {
  users,
  classes,
  students,
  attendance,
  subjects,
  classSubjects,
  exams,
  marks,
  SUBJECT_TEACHERS, // used by scripts/addDemoData.js
};
