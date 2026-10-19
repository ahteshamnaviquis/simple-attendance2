// Starting data used only when a JSON file does not exist yet.
// Plain-text passwords are ONLY acceptable for a disposable local demo.

const users = [
  { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
  { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
  { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher' },
];

const classes = [
  { id: 'c1', name: 'Grade 1 - A', teacherId: 'u2' },
  { id: 'c2', name: 'Grade 2 - B', teacherId: 'u2' },
  { id: 'c3', name: 'Grade 3 - A', teacherId: 'u3' },
];

// A few students per class. rollNumber is unique within a class.
const students = [
  { id: 's1', rollNumber: '1', name: 'Ahmed Hassan', classId: 'c1', guardianName: 'Hassan Ali', phone: '0300-1111111' },
  { id: 's2', rollNumber: '2', name: 'Ayesha Malik', classId: 'c1', guardianName: 'Tariq Malik', phone: '' },
  { id: 's3', rollNumber: '3', name: 'Bilal Ahmed', classId: 'c1', guardianName: '', phone: '' },
  { id: 's4', rollNumber: '1', name: 'Fatima Noor', classId: 'c2', guardianName: 'Noor Khan', phone: '0300-2222222' },
  { id: 's5', rollNumber: '2', name: 'Hamza Iqbal', classId: 'c2', guardianName: '', phone: '' },
  { id: 's6', rollNumber: '1', name: 'Zainab Shah', classId: 'c3', guardianName: 'Imran Shah', phone: '0300-3333333' },
  { id: 's7', rollNumber: '2', name: 'Usman Tariq', classId: 'c3', guardianName: '', phone: '' },
];

const attendance = [];

module.exports = { users, classes, students, attendance };
