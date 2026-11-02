# Simple Daily Attendance & Class Management System

A small **local prototype**: React frontend + Node.js/Express backend, with data stored in MySQL.

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
- Students: add, edit, remove, search, filter by class. Each student can be marked boy or
  girl, so parents see them as their son or daughter.
- Reports: filter by date and class, view, edit, print the list or a single report
- Classes: add, rename, and assign a teacher
- Subjects: add and rename the academy's subjects, and choose which subjects each class
  studies and which teacher teaches each one
**Super admin**
- Admins: add, edit and remove admin accounts
- Settings: the website's look (school name, accent and sidebar colors with ready-made
  presets, font, corner style), previewed live while editing, and which areas admins may
  manage (students, classes, subjects, teachers, examinations)
- Logo: upload a PNG, JPEG, WebP or GIF (up to 1 MB) shown in the sidebar, on the login
  page and as the browser tab icon; choose its size, shape (rounded, square, circle) and
  background (accent color, white, none), and whether the school name shows next to it
- Teachers: add and edit (name, username, password)
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
- Messages: private chats with the parents of the students they teach (as class teacher
  or subject teacher). Parents can write to them; they can reply, or write to one parent,
  a class's parents or all their parents. The school office doesn't see these chats.

**Parents** (admins with the *Parents* permission, on by default, and the super admin)
- Parents are added on the student form, together with the student: relation (Father,
  Mother, Guardian, ...), name, phone, other phone, email, CNIC, occupation, address, and
  a username and password for the parent portal (the username is suggested from the name,
  and *Generate* makes an easy-to-read password). A student can have up to four parents.
  For a brother or sister, *Link an existing parent* finds the parent by name, phone,
  username or child, so one login follows all their children. Editing a student can
  update a parent's details, add another parent, or unlink one.
  Student, parents and links are saved together: if anything is wrong, nothing is saved.
- Parents page: the directory of parents with relation, contacts and children. Edit
  details and login, disable or remove a parent, or open their messages. There is no
  separate "add parent".
- Teachers see each student's parents (name, relation, phone) but can't add or change them.

**Messages** (every admin and the super admin, whatever the permissions)
- The school office inbox: one private chat per parent, shared by every admin and the
  super admin. Write to one parent, the parents of a class, or all parents at once (each
  gets the message in their own chat). Unread replies show as a count next to *Messages*.
- Every chat says who it is between ("Private chat between Hassan Ali (parent) and the
  school office"), and each message shows the sender and their role (Admin, Teacher,
  Parent), the time, and ✓ sent / ✓✓ read. Messages are grouped by day.
- Teachers' chats with parents are separate: each parent has one chat with the office and
  one with each teacher they write to.

**Parent** (their own login)
- My children: each child's class, roll number, class teacher, subjects and subject
  teachers, attendance over the last 30 days and their latest published result
- Attendance: day by day for the last 30 to 180 days, with the absence reason. A child is
  absent on a day when the class report names them among the absent students.
- Results: published exams only, with marks per subject, total, percentage, position,
  Pass/Fail and the class average and highest. A printable result card. Other students'
  marks are never shown.
- Messages: start or continue a chat with the school office (admins) or with any of
  their children's teachers. Each teacher is listed with what they teach which child
  ("Class teacher and English for your son Ahmed Hassan (Grade 9)"). With several
  children, tabs (All children, Ahmed · Son, Fatima · Daughter) show one child's teachers.
  Chats with unread messages come first, "1 unread · open Sara Khan" jumps to them, and an
  open chat refreshes every 10 seconds, so new messages are read straight away and the
  unread count in the menu goes. A teacher who no longer teaches their children keeps the
  old chat, but can't get new messages.

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
| Creating exams | Super admin only. Choose one class, several, or "Select all classes". The chosen classes' subjects load with their teachers; the super admin picks which to include and sets each one's maximum marks (a whole number, 1 to 1000; 100 by default) and pass marks. Each class gets its own exam with the included subjects it studies. Every chosen class must study at least one included subject, and if any class has a problem nothing is created. The class of an exam can't be changed later. |
| Who enters marks | The teacher assigned to that subject in that class (checked by the backend on every request), or the super admin. A teacher only sees the exam subjects they teach. |
| Marks-entry status | Pending (nothing entered), In progress (saved as draft), Submitted. Submitting needs a mark or Absent for every student. Submitted marks are locked; the super admin can reopen a subject so the teacher can correct it. |
| Publishing | Super admin only, once every subject is submitted and every student has all marks. A published exam is locked; the super admin can unpublish it, then reopen subjects for corrections. |
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
│   ├── .env               # PORT, FRONTEND_URL, MySQL connection
│   ├── config.js          # Reads .env
│   ├── server.js          # Express app: login, health, users, error handling
│   ├── helpers.js         # HttpError, ids, dates, role and permission checks
│   ├── settings.js        # Theme and admin permissions: defaults and validation
│   ├── store.js           # Reads/writes MySQL through one write queue (readData/updateData)
│   ├── seedData.js        # Sample data for a brand-new database
│   ├── sql/
│   │   ├── schema.sql     # The tables (the server runs this itself on start)
│   │   └── data.sql       # The data from the JSON files as INSERTs (npm run json-to-sql)
│   ├── parentAccounts.js  # Parent details: checking them and saving them with a student
│   ├── conversations.js   # Messages: who can write to whom, one chat per parent and office or teacher
│   ├── results.js         # Exam totals, percentages, Incomplete and positions
│   ├── test/
│   │   ├── testServer.js  # Starts the server on a temporary MySQL database for each test file
│   │   ├── exams.test.js  # npm test: API tests for examinations
│   │   ├── admins.test.js # Super admin and admin accounts
│   │   └── settings.test.js # Theme and admin permissions
│   ├── scripts/
│   │   ├── addDemoData.js # npm run demo-data: extra teachers, classes, students, 14 days of reports
│   │   └── jsonToSql.js   # npm run json-to-sql: JSON data files -> sql/data.sql
│   ├── routes/
│   │   ├── admins.js      # /api/admins (super admin only)
│   │   ├── settings.js    # /api/settings (theme and admin permissions)
│   │   ├── teachers.js    # /api/teachers
│   │   ├── classes.js     # /api/classes
│   │   ├── students.js    # /api/students
│   │   ├── attendance.js  # /api/attendance (all attendance rules live here)
│   │   ├── subjects.js    # /api/subjects
│   │   ├── classSubjects.js # /api/class-subjects (subjects of each class and their teachers)
│   │   ├── exams.js       # /api/exams (exams, marks and results; all exam rules live here)
│   │   ├── parents.js     # /api/parents (the parent directory: edit, disable, remove)
│   │   ├── messages.js    # /api/messages (the staff side: the office's or a teacher's chats)
│   │   └── parentPortal.js # /api/parent (what a logged-in parent sees)
│   └── data/              # The JSON data from before MySQL (source of sql/data.sql; not used by the server)
│       ├── users.json
│       ├── classes.json
│       ├── students.json
│       ├── attendance.json
│       ├── subjects.json
│       ├── classSubjects.json
│       ├── exams.json
│       ├── marks.json
│       ├── settings.json
│       └── logo           # A logo uploaded before MySQL, if any (not committed)
├── mobile/                # React Native (Expo) Android app, see "Mobile app"
└── frontend/
    ├── package.json
    ├── .env               # VITE_API_URL
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx        # Picks the screen: login, super admin, admin or teacher
        ├── api.js         # All backend calls live here
        ├── session.js     # Remembers the logged-in user (sessionStorage)
        ├── utils.js       # Date helpers
        ├── theme.js       # Applies the super admin's theme; fonts, presets, settings context
        ├── index.css      # All styles, including the print layout
        ├── components/
        │   ├── Brand.jsx            # Logo and school name (sidebar, login, settings preview)
        │   ├── Header.jsx
        │   ├── Tabs.jsx
        │   ├── Dashboard.jsx        # Dashboard (admin and teacher)
        │   ├── SubmissionTracker.jsx # Who submitted on which day (admin and teacher)
        │   ├── AttendanceForm.jsx   # Used by teachers (new) and admins (edit)
        │   ├── Reports.jsx          # Report list, filters, view/edit/print
        │   ├── StudentsManager.jsx  # Students screen (admin and teacher)
        │   ├── ReportDetails.jsx    # One report (also the printed layout)
        │   ├── Exams.jsx            # Super admin: examinations list, filters, progress
        │   ├── TeacherExams.jsx     # Teacher: the exam subjects they teach
        │   ├── ExamDetails.jsx      # One exam: progress per subject and teacher, publish
        │   ├── ExamForm.jsx         # Create / edit an exam and its subjects
        │   ├── MarksEntry.jsx       # Marks grid for one subject (save draft, submit)
        │   ├── ExamResults.jsx      # Class result sheet
        │   └── StudentResult.jsx    # One student's result (also the printed card)
        └── pages/
            ├── LoginPage.jsx
            ├── SuperAdminHome.jsx   # Examinations, teachers, admins, settings
            ├── AdminHome.jsx        # Dashboard, reports, and the areas admins are allowed
            ├── TeacherHome.jsx
            └── admin/
                ├── AdminsManager.jsx   # Super admin only
                ├── SettingsManager.jsx # Super admin only: theme and admin permissions
                ├── ClassesManager.jsx
                ├── SubjectsManager.jsx
                ├── ClassSubjectsManager.jsx
                └── TeachersManager.jsx
```

## Requirements

- Node.js 20.12 or newer (check with `node -v` in PowerShell)
- MySQL 8.0 or newer, running (the Windows installer sets it up as a service). The
  backend's MySQL user needs permission to create a database and tables, or you create
  them yourself (see *Database*).

## Configuration (.env files)

Each app has one small `.env` file:

**`backend/.env`**
```
PORT=5050
FRONTEND_URL=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=attendance
```
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: the MySQL server and
  database (defaults: `127.0.0.1`, `3306`, `root`, no password, `attendance`). Instead you
  can give one `DATABASE_URL`, such as `mysql://user:password@host:3306/attendance`.
  Railway's MySQL sets `MYSQL_URL`, which works too.
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

## Database

On start the backend creates the database (`DB_NAME`) if it's missing, and any missing
tables from `backend/sql/schema.sql`. A **brand-new** database is filled with the starting
data from `seedData.js` (the logins below). After that the server never adds sample data
again.

**Load the same data as the JSON files** (the users, classes, students, 25 reports, exams
and marks in `backend/data`): `backend/sql/data.sql` has all of it as INSERT statements.
In PowerShell, from the `backend` folder:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS attendance CHARACTER SET utf8mb4"
mysql -u root -p attendance -e "source sql/schema.sql"
mysql -u root -p attendance -e "source sql/data.sql"
```

`data.sql` empties the tables first, so loading it again starts over. (In MySQL Workbench:
*File → Open SQL Script*, pick the database, and run each file.)

**Your own JSON data** (for example a backup folder, or the data on a server): turn it into
SQL with `node scripts/jsonToSql.js <folder> <output.sql>`, then load that file the same
way. `npm run json-to-sql` remakes `sql/data.sql` from `backend/data`.

**Tables:** `users`, `classes`, `students`, `subjects`, `class_subjects`, `attendance`,
`exams`, `marks`, `settings` and `files` (the uploaded logo). Lists inside a row (a
report's absent students, an exam's subjects) are JSON columns. Copies such as a report's
class and teacher name are kept on purpose, so history stays readable after renames and
removals.

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

The work is split between two kinds of administrator. The **super admin** handles the
admin accounts, the settings, teachers and examinations. **Admins** (there can be several)
always have the dashboard and attendance reports, plus the areas the super admin allows in
*Settings*: by default students, classes and subjects. The super admin can also hand
teachers or examinations to admins, or take areas away. If the database has no super
admin, the server adds the `superadmin` account when it starts.

| Username | Password   | Role    | Class teacher of | Teaches (Grade 9 and 10) |
|----------|------------|---------|------------------|--------------------------|
| superadmin | super123 | superadmin |               | |
| admin    | admin123   | admin   | all              | |
| sara     | teacher123 | teacher | Grade 9          | English |
| ali      | teacher123 | teacher | Grade 10         | Mathematics |
| kamran   | teacher123 | teacher |                  | Urdu |
| nadia    | teacher123 | teacher |                  | Physics |
| omar     | teacher123 | teacher |                  | Chemistry |
| hina     | teacher123 | teacher |                  | Biology |
| farah    | teacher123 | teacher |                  | Islamiyat, Pakistan Studies |
| zainab   | teacher123 | teacher |                  | Computer Science |
| parent   | parent123  | parent  | (children: Ahmed Hassan, Grade 9; Fatima Noor, Grade 10) | |

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

To start over with only the starting data plus demo data: stop the backend, back up the
database (see *Data safety*), drop it (`mysql -u root -p -e "DROP DATABASE attendance"`),
and run `npm run demo-data`. It creates a fresh database first.

## API

In the "Who" column, the teacher and exam rows marked "super admin" also accept admins
when *Settings* allows them those areas, and the class, subject and student rows marked
"admin" need that permission (on by default).

All routes except `/api/health` and `/api/login` need the `X-User-Id` header (the frontend
adds it automatically after login).

| Method | URL                    | Who            | What it does |
|--------|------------------------|----------------|--------------|
| GET    | `/api/health`          | anyone         | `{ status: "ok", time }` |
| POST   | `/api/login`           | anyone         | `{ username, password }` → the user (no password), or 401 |
| GET    | `/api/users`           | admin / super admin | All users without passwords |
| GET    | `/api/settings`        | anyone         | `{ theme, adminPermissions }` (the login page uses the theme) |
| PUT    | `/api/settings`        | super admin    | Save `{ theme: { schoolName, accentColor, sidebarColor, font, corners, logoSize, logoShape, logoBackground, showSchoolName }, adminPermissions: { students, classes, subjects, teachers, exams, parents } }`. Colors must be dark enough for white text |
| GET    | `/api/settings/logo`   | anyone         | The uploaded logo image (404 if none) |
| PUT    | `/api/settings/logo`   | super admin    | Upload the logo: the image itself as the body, with its `Content-Type` (PNG, JPEG, WebP or GIF, up to 1 MB) |
| DELETE | `/api/settings/logo`   | super admin    | Remove the logo (the check mark is shown again) |
| GET    | `/api/admins`          | super admin    | All admins |
| POST   | `/api/admins`          | super admin    | Add admin `{ name, username, password }` |
| PUT    | `/api/admins/:id`      | super admin    | Edit admin (blank password = keep current) |
| DELETE | `/api/admins/:id`      | super admin    | Remove admin |
| GET    | `/api/teachers`        | logged in      | All teachers |
| POST   | `/api/teachers`        | super admin    | Add teacher `{ name, username, password }` |
| PUT    | `/api/teachers/:id`    | super admin    | Edit teacher (blank password = keep current) |
| GET    | `/api/classes`         | logged in      | Admin: all classes. Teacher: only theirs |
| POST   | `/api/classes`         | admin          | Add class `{ name, teacherId }` |
| PUT    | `/api/classes/:id`     | admin          | Edit class / assign teacher |
| GET    | `/api/attendance`      | logged in      | Reports, optional `?date=YYYY-MM-DD&classId=...` |
| GET    | `/api/attendance/school-days` | logged in | Dates on which any class submitted (used to tell missed days from no-school days) |
| GET    | `/api/attendance/:id`  | logged in      | One report |
| POST   | `/api/attendance`      | logged in      | New report (409 if class+date already exists) |
| PUT    | `/api/attendance/:id`  | logged in      | Update counts and absent students |
| GET    | `/api/students`        | logged in      | Admin: all students. Teacher: only their classes. Optional `?classId=`. Each student has `parents: [{ parentId, name, relation, phone }]` |
| POST   | `/api/students`        | logged in      | Add `{ name, gender, classId, rollNumber, guardianName, phone, parents? }` (gender: `male`, `female` or left out). `parents` (needs the parents permission) lists `{ parentId }` to link an existing parent, `{ parentId, ...details }` to also update them, or `{ ...details }` for a new one; details = `{ name, relation, phone, altPhone, email, cnic, occupation, address, username, password }`. All saved together |
| PUT    | `/api/students/:id`    | logged in      | Edit / move a student. With `parents`, they replace the student's parents (blank password = keep current) |
| DELETE | `/api/students/:id`    | logged in      | Remove a student |
| GET    | `/api/subjects`        | logged in      | All subjects |
| POST   | `/api/subjects`        | admin          | Add subject `{ name }` |
| PUT    | `/api/subjects/:id`    | admin          | Rename subject |
| GET    | `/api/class-subjects`  | logged in      | Subjects of each class with their teacher. Teachers: only the ones they teach. Optional `?classId=` |
| PUT    | `/api/class-subjects/:classId` | admin  | Set a class's subjects `{ subjects: [{ subjectId, teacherId }] }` |
| GET    | `/api/exams`           | super admin    | Exams with marks-entry progress and a results summary. Optional `?classId=&name=&subjectId=&from=&to=&status=` |
| GET    | `/api/exams/my-subjects` | teacher      | The exam subjects the teacher teaches, with status |
| GET    | `/api/exams/:id`       | logged in      | One exam with progress per subject. Teachers: only their subjects |
| POST   | `/api/exams`           | super admin    | New exam `{ name, classId, date, remarks, subjects: [{ subjectId, maxMarks, passMarks }] }` (passMarks optional, 33% by default) |
| POST   | `/api/exams/bulk`      | super admin    | The same exam for several classes `{ name, classIds: [...], date, remarks, subjects }`. Each class gets the subjects it studies. All or nothing |
| PUT    | `/api/exams/:id`       | super admin    | Edit an open exam (not its class) |
| DELETE | `/api/exams/:id`       | super admin    | Delete an exam with no marks |
| GET    | `/api/exams/:id/marks?subjectId=` | subject teacher / super admin | Marks grid for one subject |
| PUT    | `/api/exams/:id/marks` | subject teacher / super admin | Save (draft) one subject's marks `{ subjectId, marks: [{ studentId, obtained, absent, remarks }] }` |
| POST   | `/api/exams/:id/subjects/:subjectId/submit` | subject teacher / super admin | Submit a subject's marks (locks them) |
| POST   | `/api/exams/:id/subjects/:subjectId/reopen` | super admin | Unlock a submitted subject |
| POST   | `/api/exams/:id/publish` | super admin  | Publish results (every subject submitted) |
| POST   | `/api/exams/:id/unpublish` | super admin | Back to open |
| GET    | `/api/exams/:id/results` | super admin  | Result sheet: per-student totals, percentages, positions and summary |
| GET    | `/api/parents`         | parents permission | Parents with relation, contacts and children |
| PUT    | `/api/parents/:id`     | parents permission | Edit a parent's details and login (blank password = keep current) |
| POST   | `/api/parents/:id/disable` and `/enable` | parents permission | A disabled parent can't log in |
| DELETE | `/api/parents/:id`     | parents permission | Remove parent, with their details, links and messages |
| GET    | `/api/messages`        | staff          | Conversations, newest first, with unread counts. Admins: the school office's. Teachers: their own |
| GET    | `/api/messages/unread` | staff          | `{ count }` of unread parent messages |
| GET    | `/api/messages/parents` | staff         | Everyone this user can write to: all parents (admins) or the parents of their students (teachers) |
| GET    | `/api/messages/:parentId` | staff       | One conversation (marks the parent's messages read) |
| POST   | `/api/messages`        | staff          | Send `{ parentIds: [...], body }` (one message per parent, up to 2000 characters) |
| GET    | `/api/parent/children` | parent         | The parent's children with class, teachers, subjects, 30-day attendance and latest result |
| GET    | `/api/parent/children/:studentId/attendance` | parent | Day by day, optional `?from=&to=` (default last 60 days) |
| GET    | `/api/parent/children/:studentId/exams` | parent | Published exams with the child's result |
| GET    | `/api/parent/children/:studentId/exams/:examId` | parent | The child's subject-wise result and class average, highest and lowest |
| GET    | `/api/parent/contacts` | parent         | The school office and the children's teachers (what each teaches which child), with last message and unread count |
| GET    | `/api/parent/messages?with=school\|<teacherId>` | parent | One conversation (marks the other side's messages read) |
| GET    | `/api/parent/messages/unread` | parent  | `{ count }` of unread messages from the office and teachers |
| POST   | `/api/parent/messages` | parent         | Send `{ to: "school" \| teacherId, body }` |

## Data safety

All writes go through one queue in `store.js`, so simultaneous saves run one after another
instead of overwriting each other. Each save runs in a MySQL transaction: a change that
fails part-way saves nothing. Foreign keys and unique keys (one report per class per date,
one mark per exam, subject and student, unique usernames and subject names) guard the data
as well.

**Backup:** `mysqldump -u root -p attendance > attendance-backup.sql`
**Reset:** stop the backend, drop the database, and start it again. It is recreated from
`seedData.js`.

## Tests

```powershell
cd backend
npm test
```

Runs the API tests. Each test file gets its own temporary MySQL database
(`attendance_test_...`), dropped again at the end, so your real database is never touched.
They use the MySQL server from `backend/.env`, whose user must be allowed to create and
drop databases.

## Quick test checklist

1. Log in as `sara`. Pick *Grade 9*, enter Total 30, Present 27, Absent 2, and check
   the mismatch warning appears. Click *Absent = Total − Present*, add two absent students,
   and save.
2. Change the date and back. The saved report loads with the "already exists" notice.
3. *My reports* shows only Sara's class. View the report and click *Print*.
4. Log out and log in as `superadmin`. *Teachers*: add a teacher. Adding the username
   `sara` again is rejected. *Admins*: add a second admin.
5. Log in as `admin`. The dashboard shows which classes have reported today. There is no
   *Teachers* or *Examinations* menu.
6. *Classes*: add a class assigned to the new teacher, and rename *Grade 9*. In
   *Reports*, the old report still says *Grade 9*.
7. *Reports*: filter by date and class. Edit a report so present + absent ≠ total, and
   the save is rejected with a clear message.
8. Log in as `ali`. You don't see Sara's class, reports or students.
9. *My students* (teacher) or *Students* (admin): add a student, try a roll number that's
   already used in that class, edit, search, and remove.
10. As `admin`, *Subjects*: the subjects and each class's subjects and teachers are
    already there. Adding "english" again is rejected.
11. As `superadmin`, *Examinations* → *Create examination*: tick *Select all classes*. English and
    Mathematics load with their teachers, each out of 100 with 33 pass marks; change one
    (for example Mathematics to 75) and create. The details panel shows both subjects as
    Pending.
12. Log in as `sara`. *Examinations* lists only English, for Grade 9 and Grade 10. Enter
    marks (Enter moves to the next student); 120 or a negative number is flagged. *Save
    draft* with some empty, and *Submit marks* stays disabled until every student has a
    mark or Absent. Submit.
13. Log in as `ali`: only Mathematics is listed. Enter and submit it, with one mark below
    the pass marks.
14. As `superadmin`: the result sheet shows positions, the low mark in red and that student as
    Fail. Before both subjects were submitted, it showed "Awaiting submission" and
    *Publish results* was disabled.
15. *Publish results*. Marks are locked. *Unpublish*, then *Reopen* English: Sara can
    correct it and must submit again.

# simple-attendance
# simple-attendance2
