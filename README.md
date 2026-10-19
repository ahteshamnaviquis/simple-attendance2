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

**Teacher**
- Dashboard: the same layout for their own classes and students, with a
  "Take attendance" button when a class hasn't reported, and "My submissions" for the
  last 14 days. Click a missed day (!) to fill it in, or a ✓ day to edit it.
- Daily attendance form for their own classes only: total, present, absent, added today,
  left today, and absent students' names and reasons. For a new report the total starts
  as the number of students in the class, and clicking a student's name marks them absent.
- My students: add, edit, remove students in their own classes
- My reports: view, edit and print reports for their own classes

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

## Folder structure

```
SimpleAttendence/
├── README.md
├── backend/
│   ├── package.json
│   ├── .env / .env.example # Backend settings (PORT, HOST, DATA_DIR)
│   ├── config.js          # Reads .env and provides the settings
│   ├── server.js          # Express app: login, health, users, error handling
│   ├── helpers.js         # HttpError, ids, dates, role checks
│   ├── fileStore.js       # Reads/writes JSON files through one write queue
│   ├── seedData.js        # Sample data used when a JSON file is missing
│   ├── scripts/
│   │   └── addDemoData.js # npm run demo-data: extra teachers, classes, students, 14 days of reports
│   ├── routes/
│   │   ├── teachers.js    # /api/teachers
│   │   ├── classes.js     # /api/classes
│   │   ├── students.js    # /api/students
│   │   └── attendance.js  # /api/attendance (all attendance rules live here)
│   └── data/              # Created automatically on first start
│       ├── users.json
│       ├── classes.json
│       ├── students.json
│       └── attendance.json
└── frontend/
    ├── package.json
    ├── .env / .env.example # Frontend settings (API_URL, VITE_APP_TITLE)
    ├── vite.config.js     # Reads .env; forwards /api requests to the backend
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx        # Picks the screen: login, admin or teacher
        ├── api.js         # All backend calls live here
        ├── config.js      # Settings the browser can read (VITE_APP_TITLE)
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
        │   └── ReportDetails.jsx    # One report (also the printed layout)
        └── pages/
            ├── LoginPage.jsx
            ├── AdminHome.jsx
            ├── TeacherHome.jsx
            └── admin/
                ├── ClassesManager.jsx
                └── TeachersManager.jsx
```

## Requirements

- Node.js 20.12 or newer (check with `node -v` in PowerShell)

## Configuration (.env files)

Settings live in two `.env` files. Each has a `.env.example` next to it listing every
setting with its default. All settings are optional: if a `.env` file is missing, the
defaults are used.

**`backend/.env`**

| Setting    | Default     | What it does |
|------------|-------------|--------------|
| `PORT`     | `5050`      | Port the API listens on |
| `HOST`     | `127.0.0.1` | `127.0.0.1` = only this computer can reach the API |
| `DATA_DIR` | `data`      | Folder for the JSON data files (relative to `backend/`, or a full path) |

**`frontend/.env`**

| Setting          | Default                 | What it does |
|------------------|-------------------------|--------------|
| `API_URL`        | (required)              | Backend the dev server forwards `/api` to: the live Railway URL, or `http://127.0.0.1:5050` for a local backend |
| `VITE_APP_TITLE` | `Daily Attendance`      | Name shown in the browser tab, header and login page |

- After changing a `.env` file, restart that server (`Ctrl + C`, then start it again).
- To use a local backend instead of the live one, set `API_URL=http://127.0.0.1:5050`
  in `frontend/.env` (and match the backend `PORT`).
- `.env` files are ignored by git, and `.env.example` files are committed. On a new
  computer, copy each `.env.example` to `.env`.
- Variables starting with `VITE_` are visible in the browser. Never put secrets in them.

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

## Sample logins

| Username | Password     | Role    | Classes                    |
|----------|--------------|---------|----------------------------|
| admin    | admin123     | admin   | all                        |
| sara     | teacher123   | teacher | Grade 1 - A, Grade 2 - B   |
| ali      | teacher123   | teacher | Grade 3 - A (+ Grade 5 - B with demo data) |

## Demo data

To fill the app with realistic data, run this in the `backend` folder:

```powershell
npm run demo-data
```

It adds 3 teachers (`nadia`, `omar`, `hina`, password `teacher123`), 4 classes
(Grade 3 - B, Grade 4 - A, Grade 5 - A, Grade 5 - B), students up to 10 per class, and
attendance reports for the last 14 days. Sundays are skipped, and today a few classes are
left pending so the dashboard has something to show.

It only **adds** data: existing users, classes, students and reports are never changed,
and running it again adds only what is missing. Refresh the browser afterwards. You don't
need to restart the backend.

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

## Data safety

All writes go through one queue in `fileStore.js`, so simultaneous saves run one after
another instead of overwriting each other. Each save writes a temporary file first and
then renames it, so a crash can't leave a half-written JSON file.

**Backup:** copy the `backend/data` folder.
**Reset:** stop the backend, delete the files in `backend/data/`, and start it again. They
are recreated from `seedData.js`.

## Quick test checklist

1. Log in as `sara`. Pick *Grade 1 - A*, enter Total 30, Present 27, Absent 2, and check
   the mismatch warning appears. Click *Absent = Total − Present*, add two absent students,
   and save.
2. Switch the class to *Grade 2 - B* and back. The saved report loads with the "already
   exists" notice.
3. *My reports* shows only Sara's classes. View the report and click *Print*.
4. Log out and log in as `admin`. The dashboard shows 1 / 3 reports submitted and lists
   the two missing classes.
5. *Teachers*: add a teacher. Adding the username `sara` again is rejected.
6. *Classes*: add a class assigned to the new teacher, and rename *Grade 1 - A*. In
   *Reports*, the old report still says *Grade 1 - A*.
7. *Reports*: filter by date and class. Edit a report so present + absent ≠ total, and
   the save is rejected with a clear message.
8. Log in as `ali`. You don't see Sara's classes, reports or students.
9. *My students* (teacher) or *Students* (admin): add a student, try a roll number that's
   already used in that class, edit, search, and remove.

# simple-attendance
# simple-attendance2
