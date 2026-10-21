# Simple Daily Attendance & Class Management System

A small **local prototype**: React frontend + Node.js/Express backend, with data stored in JSON files.

> ⚠️ **Local demo only.** Passwords are stored in plain text, and "who is logged in" is just
> an id the browser sends in a header (`X-User-Id`), which anyone could fake. The roles
> keep honest users on the right screens. They are not real security. Do not put this on
> the internet or a shared network, and do not use real passwords.

## Features

**Admin**
- Dashboard for any day (with Prev / Next / Today): students enrolled, teachers, reports
  submitted, present, absent, attendance rate, a warning for classes that haven't
  reported, a class overview with rate bars and Submitted/Pending badges, a 7- or 14-day
  attendance chart (hover for numbers, click a day to open it), absence reasons, and
  the students absent most often in the last 14 days
- Submission tracker: a grid of classes (with their teacher) × the last 14 days showing
  ✓ submitted on the day, ⏱ late (submitted or edited after the attendance date,
  violet), ! missing, and – for days nobody submitted (treated as no school). The top
  row shows how many classes reported each day. Click a cell to open the attendance
  form for that class and date; click a date to list who did not submit or was late.
- Late reports also get a "⏱ Late" label in the Reports list.
- Students: add, edit, remove, search, filter by class
- Reports: filter by date and class, view, edit, print the list or a single report
- Classes: add, rename, and assign a teacher
- Teachers: add and edit (name, username, password)
- Subjects: add and rename the academy's subjects, and choose which subjects each class
  studies and which teacher teaches each one
- Examinations: create exams for one class, several, or all classes at once (the
  classes' subjects load with their teachers; set each subject's maximum marks), filter (class, name, subject, date range, status), and
  monitor marks entry per subject and teacher (Pending / In progress / Submitted).
  Enter marks for subjects with no teacher, reopen a submitted subject for corrections,
  publish results once every subject is submitted, and view the class result sheet and
  each student's result.

**Teacher**
- Dashboard: the same layout for their own classes and students, with a
  "Take attendance" button when a class hasn't reported, and "My submissions" for the
  last 14 days. Click a missed day (!) to fill it in, or a ✓ day to edit it.
- Daily attendance form for their own classes only: total, present, absent, added today,
  left today, and absent students' names and reasons. For a new report the total starts
  as the number of students in the class, and clicking a student's name marks them absent.
- My students: add, edit, remove students in their own classes
- My reports: view, edit and print reports for their own classes
- Examinations: the exam subjects they teach, with max marks and marks-entry status.
  Enter marks, save as a draft, and submit them. Teachers can't create or publish exams
  or see other teachers' subjects.

## Attendance rules

| Rule | How it works |
|------|--------------|
| Counts | Whole numbers, 0 or more. All five are required. |
| Present + absent | Must equal total students. |
| Absent student names | Cannot be more than the absent count. Fewer is allowed when some absent students are unknown. The form shows "X of Y named". |
| One report per class per date | Creating a second one is rejected. When a teacher picks a class and date that already has a report, the form loads it for editing. |
| Editing | Updates the same record. Class and date are fixed after creation. |
| Dates | No future dates. |
| History | Each report stores the class name and teacher name as they were that day. Renaming a class or changing its teacher does not change old reports. Classes and teachers can't be deleted, so old reports always make sense. |
| Who can edit | Admins: any report. Teachers: only reports for classes currently assigned to them. |
| Students | Name and class are required. A roll number can't be used twice in the same class. Teachers can only add, edit, move or remove students in their own classes. Removing a student does not change old reports (they store names as text). |

## Examination rules

| Rule | How it works |
|------|--------------|
| Subjects | The admin keeps one list of subjects, and for each class chooses its subjects and each subject's teacher. A class can have each subject once. The subject teacher is separate from the class teacher, who still takes attendance and manages students. |
| Creating exams | Admins only. Choose one class, several, or "Select all classes". The chosen classes' subjects load with their teachers; the admin picks which to include and sets each one's maximum marks (a whole number, 1 to 1000; 100 by default) and pass marks. Each class gets its own exam with the included subjects it studies. Every chosen class must study at least one included subject, and if any class has a problem nothing is created. The class of an exam can't be changed later. |
| Who enters marks | The teacher assigned to that subject in that class (checked by the backend on every request), or the admin. A teacher only sees the exam subjects they teach. |
| Marks-entry status | Pending (nothing entered), In progress (saved as draft), Submitted. Submitting needs a mark or Absent for every student. Submitted marks are locked; the admin can reopen a subject so the teacher can correct it. |
| Publishing | Admins only, once every subject is submitted and every student has all marks. A published exam is locked; the admin can unpublish it, then reopen subjects for corrections. |
| Marks | 0 up to the subject's maximum, at most 2 decimals. An empty box means "not entered", which is different from 0. Ticking Absent counts as 0 in totals. Every row is checked before saving; if any row is wrong, nothing is saved. |
| One mark per student, subject and exam | Saving again updates the same record, so duplicates can't happen. |
| Totals | Total = sum of the maximum marks of the exam's subjects. Percentage = obtained ÷ total × 100, rounded to 2 decimals. |
| Incomplete results | A result is Incomplete while any subject mark is not entered or any subject isn't submitted yet: no total, percentage or position, only "so far" totals. Incomplete results are not counted in the class average, highest or lowest. |
| Position | Complete results ranked by total. Equal totals share a position (1, 2, 2, 4). |
| Pass marks | Each exam subject has pass marks: a whole number from 1 to its maximum, 33% of the maximum (rounded up) by default, e.g. 33/100, 17/50. A subject is passed when obtained ≥ pass marks; Absent fails it. A complete result is **Pass** only when every subject is passed, otherwise **Fail** (the failed subjects are listed). Marks below pass marks are shown in red. |
| Changing an exam | A subject that already has marks can't be removed, and its maximum can't go below the highest mark entered. An exam can only be deleted while it has no marks. |
| History | Marks store the student's name and roll number. If a student moves to another class or is removed, their marks stay and appear under "Students who have left the class" (not ranked). Exams keep the class and subject names they were created with. Changing a class's subjects or teachers doesn't change existing exams or marks; a new subject teacher gets access to that subject. |

## Folder structure

```
SimpleAttendence/
├── README.md
├── backend/
│   ├── package.json
│   ├── .env               # PORT, FRONTEND_URL
│   ├── config.js          # Reads .env
│   ├── server.js          # Express app: login, health, users, error handling
│   ├── helpers.js         # HttpError, ids, dates, role checks
│   ├── fileStore.js       # Reads/writes JSON files through one write queue
│   ├── seedData.js        # Sample data used when a JSON file is missing
│   ├── results.js         # Exam totals, percentages, Incomplete and positions
│   ├── test/
│   │   └── exams.test.js  # npm test: API tests for examinations (uses a temporary data folder)
│   ├── scripts/
│   │   └── addDemoData.js # npm run demo-data: extra teachers, classes, students, 14 days of reports
│   ├── routes/
│   │   ├── teachers.js    # /api/teachers
│   │   ├── classes.js     # /api/classes
│   │   ├── students.js    # /api/students
│   │   ├── attendance.js  # /api/attendance (all attendance rules live here)
│   │   ├── subjects.js    # /api/subjects
│   │   ├── classSubjects.js # /api/class-subjects (subjects of each class and their teachers)
│   │   └── exams.js       # /api/exams (exams, marks and results; all exam rules live here)
│   └── data/              # Created automatically on first start
│       ├── users.json
│       ├── classes.json
│       ├── students.json
│       ├── attendance.json
│       ├── subjects.json
│       ├── classSubjects.json
│       ├── exams.json
│       └── marks.json
├── mobile/                # React Native (Expo) Android app, see "Mobile app"
└── frontend/
    ├── package.json
    ├── .env               # VITE_API_URL
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx        # Picks the screen: login, admin or teacher
        ├── api.js         # All backend calls live here
        ├── session.js     # Remembers the logged-in user (sessionStorage)
        ├── utils.js       # Date helpers
        ├── index.css      # All styles, including the print layout
        ├── components/
        │   ├── Header.jsx
        │   ├── Tabs.jsx
        │   ├── Dashboard.jsx        # Dashboard (admin and teacher)
        │   ├── SubmissionTracker.jsx # Who submitted on which day (admin and teacher)
        │   ├── AttendanceForm.jsx   # Used by teachers (new) and admins (edit)
        │   ├── Reports.jsx          # Report list, filters, view/edit/print
        │   ├── StudentsManager.jsx  # Students screen (admin and teacher)
        │   ├── ReportDetails.jsx    # One report (also the printed layout)
        │   ├── Exams.jsx            # Admin: examinations list, filters, progress
        │   ├── TeacherExams.jsx     # Teacher: the exam subjects they teach
        │   ├── ExamDetails.jsx      # One exam: progress per subject and teacher, publish
        │   ├── ExamForm.jsx         # Create / edit an exam and its subjects
        │   ├── MarksEntry.jsx       # Marks grid for one subject (save draft, submit)
        │   ├── ExamResults.jsx      # Class result sheet
        │   └── StudentResult.jsx    # One student's result (also the printed card)
        └── pages/
            ├── LoginPage.jsx
            ├── AdminHome.jsx
            ├── TeacherHome.jsx
            └── admin/
                ├── ClassesManager.jsx
                ├── SubjectsManager.jsx
                ├── ClassSubjectsManager.jsx
                └── TeachersManager.jsx
```

## Requirements

- Node.js 20.12 or newer (check with `node -v` in PowerShell)

## Configuration (.env files)

Each app has one small `.env` file:

**`backend/.env`**
```
PORT=5050
FRONTEND_URL=http://localhost:5173
```
- `PORT`: port the API listens on. Railway sets its own `PORT` automatically.
- `FRONTEND_URL`: the website allowed to call the API from the browser (CORS). To
  allow several, separate them with commas. On Railway, set this as a variable to
  your deployed frontend's address. The default allows `http://localhost:5173`.

**`frontend/.env`**
```
VITE_API_URL=https://simple-attendance2-production.up.railway.app
```
- `VITE_API_URL`: the backend the app calls. For a local backend, use
  `http://127.0.0.1:5050`.

Restart the server after changing a `.env` file. `.env` files are not committed to git.

## Install (once)

Open PowerShell in the project folder:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

## Run (two PowerShell windows)

Window 1, backend (http://localhost:5050):

```powershell
cd backend
npm start
```

Window 2, frontend:

```powershell
cd frontend
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). If port 5173 is busy, Vite
picks the next free one (5174, ...). Stop either server with `Ctrl + C`.

While developing the backend, `npm run dev` restarts it automatically when you save a file.

## Mobile app (Android)

The `mobile` folder is a React Native app (Expo) with the same features as the web
frontend: login, dashboards, submission tracker, attendance form, reports, students,
classes and teachers. Print is web-only.

**`mobile/.env`**
```
EXPO_PUBLIC_API_URL=https://simple-attendance2-production.up.railway.app
```
The backend address is built into the app, so set it before building. Use an `https`
address: Android blocks plain `http` by default, and a phone cannot reach `127.0.0.1`
on your computer.

**Try it in a browser** (quick check, no Android tools needed):
```powershell
cd mobile
npm install
npm run web
```
The browser counts as a frontend, so add its address (shown by Expo) to the backend's
`FRONTEND_URL`.

**Build the APK** (needs JDK 17, Android SDK and `ANDROID_HOME` set up):
```powershell
cd mobile
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleRelease
```
The APK is `mobile\android\app\build\outputs\apk\release\app-release.apk`. Copy it to
your phone and open it, allowing "Install unknown apps" when Android asks. The first
build takes 10+ minutes while Gradle downloads its dependencies. The `android` folder is
generated, so it's not committed; run `prebuild` again after changing `app.json`.

## Sample logins

| Username | Password   | Role    | Class teacher of | Teaches (Grade 9 and 10) |
|----------|------------|---------|------------------|--------------------------|
| admin    | admin123   | admin   | all              | |
| sara     | teacher123 | teacher | Grade 9          | English |
| ali      | teacher123 | teacher | Grade 10         | Mathematics |
| kamran   | teacher123 | teacher |                  | Urdu |
| nadia    | teacher123 | teacher |                  | Physics |
| omar     | teacher123 | teacher |                  | Chemistry |
| hina     | teacher123 | teacher |                  | Biology |
| farah    | teacher123 | teacher |                  | Islamiyat, Pakistan Studies |
| zainab   | teacher123 | teacher |                  | Computer Science |

This is the starting data (`backend/seedData.js`), used whenever a data file doesn't
exist yet: two classes (Grade 9, Grade 10) that both study all nine subjects above. The
class teacher takes attendance and manages students; the subject teacher enters that
subject's exam marks.

## Demo data

To fill the app with realistic data, run this in the `backend` folder:

```powershell
npm run demo-data
```

It adds students up to 10 per class and attendance reports for the last 14 days. Sundays
are skipped, and today a few classes are left pending so the dashboard has something to
show. On older data it also adds whatever is missing from the starting data above: the
teachers, Grade 9 and Grade 10, the subjects, and for every class each subject it doesn't
have yet, with that subject's teacher.

To add **only** the teachers, subjects and class subjects (no students or reports):

```powershell
npm run seed-subjects
```

Both only **add** data: existing users, classes, students, reports, subjects and subject
assignments are never changed (a subject a class already has keeps its teacher), and
running again adds only what is missing. Refresh the browser afterwards. You don't need to
restart the backend.

To start over with only the starting data plus demo data: stop the backend, copy
`backend/data` somewhere safe (a `data-backup-*` folder is ignored by git), delete the
files in `backend/data`, and run `npm run demo-data`.

## API

All routes except `/api/health` and `/api/login` need the `X-User-Id` header (the frontend
adds it automatically after login).

| Method | URL                    | Who            | What it does |
|--------|------------------------|----------------|--------------|
| GET    | `/api/health`          | anyone         | `{ status: "ok", time }` |
| POST   | `/api/login`           | anyone         | `{ username, password }` → the user (no password), or 401 |
| GET    | `/api/users`           | admin          | All users without passwords |
| GET    | `/api/teachers`        | logged in      | All teachers |
| POST   | `/api/teachers`        | admin          | Add teacher `{ name, username, password }` |
| PUT    | `/api/teachers/:id`    | admin          | Edit teacher (blank password = keep current) |
| GET    | `/api/classes`         | logged in      | Admin: all classes. Teacher: only theirs |
| POST   | `/api/classes`         | admin          | Add class `{ name, teacherId }` |
| PUT    | `/api/classes/:id`     | admin          | Edit class / assign teacher |
| GET    | `/api/attendance`      | logged in      | Reports, optional `?date=YYYY-MM-DD&classId=...` |
| GET    | `/api/attendance/school-days` | logged in | Dates on which any class submitted (used to tell missed days from no-school days) |
| GET    | `/api/attendance/:id`  | logged in      | One report |
| POST   | `/api/attendance`      | logged in      | New report (409 if class+date already exists) |
| PUT    | `/api/attendance/:id`  | logged in      | Update counts and absent students |
| GET    | `/api/students`        | logged in      | Admin: all students. Teacher: only their classes. Optional `?classId=` |
| POST   | `/api/students`        | logged in      | Add `{ name, classId, rollNumber, guardianName, phone }` |
| PUT    | `/api/students/:id`    | logged in      | Edit / move a student |
| DELETE | `/api/students/:id`    | logged in      | Remove a student |
| GET    | `/api/subjects`        | logged in      | All subjects |
| POST   | `/api/subjects`        | admin          | Add subject `{ name }` |
| PUT    | `/api/subjects/:id`    | admin          | Rename subject |
| GET    | `/api/class-subjects`  | logged in      | Subjects of each class with their teacher. Teachers: only the ones they teach. Optional `?classId=` |
| PUT    | `/api/class-subjects/:classId` | admin  | Set a class's subjects `{ subjects: [{ subjectId, teacherId }] }` |
| GET    | `/api/exams`           | admin          | Exams with marks-entry progress and a results summary. Optional `?classId=&name=&subjectId=&from=&to=&status=` |
| GET    | `/api/exams/my-subjects` | teacher      | The exam subjects the teacher teaches, with status |
| GET    | `/api/exams/:id`       | logged in      | One exam with progress per subject. Teachers: only their subjects |
| POST   | `/api/exams`           | admin          | New exam `{ name, classId, date, remarks, subjects: [{ subjectId, maxMarks, passMarks }] }` (passMarks optional, 33% by default) |
| POST   | `/api/exams/bulk`      | admin          | The same exam for several classes `{ name, classIds: [...], date, remarks, subjects }`. Each class gets the subjects it studies. All or nothing |
| PUT    | `/api/exams/:id`       | admin          | Edit an open exam (not its class) |
| DELETE | `/api/exams/:id`       | admin          | Delete an exam with no marks |
| GET    | `/api/exams/:id/marks?subjectId=` | subject teacher / admin | Marks grid for one subject |
| PUT    | `/api/exams/:id/marks` | subject teacher / admin | Save (draft) one subject's marks `{ subjectId, marks: [{ studentId, obtained, absent, remarks }] }` |
| POST   | `/api/exams/:id/subjects/:subjectId/submit` | subject teacher / admin | Submit a subject's marks (locks them) |
| POST   | `/api/exams/:id/subjects/:subjectId/reopen` | admin | Unlock a submitted subject |
| POST   | `/api/exams/:id/publish` | admin        | Publish results (every subject submitted) |
| POST   | `/api/exams/:id/unpublish` | admin      | Back to open |
| GET    | `/api/exams/:id/results` | admin        | Result sheet: per-student totals, percentages, positions and summary |

## Data safety

All writes go through one queue in `fileStore.js`, so simultaneous saves run one after
another instead of overwriting each other. Each save writes a temporary file first and
then renames it, so a crash can't leave a half-written JSON file.

**Backup:** copy the `backend/data` folder.
**Reset:** stop the backend, delete the files in `backend/data/`, and start it again. They
are recreated from `seedData.js`.

## Tests

```powershell
cd backend
npm test
```

Runs the examination API tests against a temporary copy of the starting data, so the files
in `backend/data` are never touched.

## Quick test checklist

1. Log in as `sara`. Pick *Grade 9*, enter Total 30, Present 27, Absent 2, and check
   the mismatch warning appears. Click *Absent = Total − Present*, add two absent students,
   and save.
2. Change the date and back. The saved report loads with the "already exists" notice.
3. *My reports* shows only Sara's class. View the report and click *Print*.
4. Log out and log in as `admin`. The dashboard shows which classes have reported today.
5. *Teachers*: add a teacher. Adding the username `sara` again is rejected.
6. *Classes*: add a class assigned to the new teacher, and rename *Grade 9*. In
   *Reports*, the old report still says *Grade 9*.
7. *Reports*: filter by date and class. Edit a report so present + absent ≠ total, and
   the save is rejected with a clear message.
8. Log in as `ali`. You don't see Sara's class, reports or students.
9. *My students* (teacher) or *Students* (admin): add a student, try a roll number that's
   already used in that class, edit, search, and remove.
10. As `admin`, *Subjects*: the subjects and each class's subjects and teachers are
    already there. Adding "english" again is rejected.
11. *Examinations* → *Create examination*: tick *Select all classes*. English and
    Mathematics load with their teachers, each out of 100 with 33 pass marks; change one
    (for example Mathematics to 75) and create. The details panel shows both subjects as
    Pending.
12. Log in as `sara`. *Examinations* lists only English, for Grade 9 and Grade 10. Enter
    marks (Enter moves to the next student); 120 or a negative number is flagged. *Save
    draft* with some empty, and *Submit marks* stays disabled until every student has a
    mark or Absent. Submit.
13. Log in as `ali`: only Mathematics is listed. Enter and submit it, with one mark below
    the pass marks.
14. As `admin`: the result sheet shows positions, the low mark in red and that student as
    Fail. Before both subjects were submitted, it showed "Awaiting submission" and
    *Publish results* was disabled.
15. *Publish results*. Marks are locked. *Unpublish*, then *Reopen* English: Sara can
    correct it and must submit again.

# simple-attendance
# simple-attendance2
