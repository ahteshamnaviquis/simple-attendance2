-- MySQL tables for the Simple Daily Attendance system (MySQL 8.0 or newer).
--
-- The server runs this file itself when it starts (every statement is
-- "IF NOT EXISTS", so running it again changes nothing). To set up a database
-- by hand instead:
--   mysql -u root -p -e "CREATE DATABASE attendance CHARACTER SET utf8mb4"
--   mysql -u root -p attendance -e "source sql/schema.sql"
--   mysql -u root -p attendance -e "source sql/data.sql"   (optional: the data)
--
-- Every table has a `seq` column: the order rows were added in. The API lists
-- rows in that order, like the JSON files did.
--
-- Copies such as attendance.class_name, attendance.teacher_name and
-- marks.student_name are kept on purpose: history stays readable after a
-- class is renamed or a teacher or student is removed. For the same reason
-- attendance.teacher_id and marks.student_id have no foreign key.

-- The academies (schools) that use the system. The platform owner adds them;
-- every other table's rows belong to one academy (academy_id). Rows from
-- before there were several academies belong to "default".
CREATE TABLE IF NOT EXISTS academies (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  prefix     VARCHAR(3)   NULL,  -- 3 letters every new username starts with ("gvs" -> "gvs.sara"); never changed
  disabled   BOOLEAN      NULL, -- NULL = never disabled; a disabled academy's users can't log in
  created_at DATETIME(3)  NOT NULL, -- UTC
  UNIQUE KEY uq_academies_prefix (prefix)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Usernames are unique across every academy: the login page has no academy box.
CREATE TABLE IF NOT EXISTS users (
  seq      INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id       VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL, -- NULL only for the platform owner
  KEY idx_users_academy (academy_id),
  name     VARCHAR(100) NOT NULL,
  username VARCHAR(60)  NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- plain text: LOCAL DEMO ONLY
  role     ENUM('owner', 'superadmin', 'admin', 'teacher', 'parent') NOT NULL,
  disabled BOOLEAN NULL           -- teachers and parents; NULL = never disabled
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Older databases: allow the "parent" and "owner" roles.
ALTER TABLE users MODIFY role ENUM('owner', 'superadmin', 'admin', 'teacher', 'parent') NOT NULL;

CREATE TABLE IF NOT EXISTS classes (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_classes_academy (academy_id),
  name       VARCHAR(100) NOT NULL,
  teacher_id VARCHAR(64)  NULL, -- the class teacher
  CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS students (
  seq           INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_students_academy (academy_id),
  roll_number   VARCHAR(20)  NOT NULL DEFAULT '', -- unique per class when filled in (checked by the API)
  name          VARCHAR(100) NOT NULL,
  gender        VARCHAR(10)  NULL,               -- male or female (son or daughter); NULL = not given
  class_id      VARCHAR(64)  NOT NULL,
  guardian_name VARCHAR(100) NOT NULL DEFAULT '',
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  KEY idx_students_class (class_id),
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  seq  INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id   VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_subjects_academy (academy_id),
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_subjects_academy_name (academy_id, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- The subjects each class studies, and who teaches each one.
CREATE TABLE IF NOT EXISTS class_subjects (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_class_subjects_academy (academy_id),
  class_id   VARCHAR(64)  NOT NULL,
  subject_id VARCHAR(64)  NOT NULL,
  teacher_id VARCHAR(64)  NULL,
  UNIQUE KEY uq_class_subject (class_id, subject_id),
  CONSTRAINT fk_class_subjects_class FOREIGN KEY (class_id) REFERENCES classes (id),
  CONSTRAINT fk_class_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects (id),
  CONSTRAINT fk_class_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- One daily attendance report per class per date.
CREATE TABLE IF NOT EXISTS attendance (
  seq            INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_attendance_academy (academy_id),
  class_id       VARCHAR(64)  NOT NULL,
  date           DATE         NOT NULL,
  class_name     VARCHAR(100) NOT NULL,
  teacher_id     VARCHAR(64)  NULL,
  teacher_name   VARCHAR(100) NULL,
  total_students INT UNSIGNED NOT NULL,
  present        INT UNSIGNED NOT NULL,
  absent         INT UNSIGNED NOT NULL,
  added_today    INT UNSIGNED NOT NULL,
  left_today     INT UNSIGNED NOT NULL,
  absentees      JSON         NOT NULL, -- [{ "name": ..., "reason": ... }]
  created_at     DATETIME(3)  NOT NULL, -- UTC
  created_by     VARCHAR(100) NOT NULL,
  updated_at     DATETIME(3)  NOT NULL,
  updated_by     VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_attendance_class_date (class_id, date),
  KEY idx_attendance_date (date),
  CONSTRAINT fk_attendance_class FOREIGN KEY (class_id) REFERENCES classes (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS exams (
  seq           INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_exams_academy (academy_id),
  name          VARCHAR(100) NOT NULL,
  class_id      VARCHAR(64)  NOT NULL,
  class_name    VARCHAR(100) NOT NULL,
  date          DATE         NOT NULL,
  remarks       TEXT         NOT NULL,
  -- [{ subjectId, subjectName, maxMarks, passMarks, submittedAt, submittedBy }]
  subjects      JSON         NOT NULL,
  status        ENUM('open', 'published') NOT NULL,
  disabled      BOOLEAN      NULL, -- NULL = never disabled
  created_by_id VARCHAR(64)  NOT NULL,
  created_by    VARCHAR(100) NOT NULL,
  created_at    DATETIME(3)  NOT NULL, -- UTC
  updated_at    DATETIME(3)  NOT NULL,
  updated_by    VARCHAR(100) NOT NULL,
  published_at  DATETIME(3)  NULL,
  published_by  VARCHAR(100) NULL,
  KEY idx_exams_class (class_id),
  CONSTRAINT fk_exams_class FOREIGN KEY (class_id) REFERENCES classes (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- One row per exam + subject + student. Removing an exam removes its marks.
CREATE TABLE IF NOT EXISTS marks (
  seq          INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_marks_academy (academy_id),
  exam_id      VARCHAR(64)  NOT NULL,
  subject_id   VARCHAR(64)  NOT NULL,
  student_id   VARCHAR(64)  NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  roll_number  VARCHAR(20)  NOT NULL DEFAULT '',
  obtained     DOUBLE       NULL, -- NULL = not entered (or absent)
  absent       BOOLEAN      NOT NULL DEFAULT FALSE,
  remarks      VARCHAR(255) NOT NULL DEFAULT '',
  updated_at   DATETIME(3)  NOT NULL, -- UTC
  updated_by   VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_mark (exam_id, subject_id, student_id),
  CONSTRAINT fk_marks_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE,
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id) REFERENCES subjects (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- A parent's details (id = their user id): relation to their children and contacts.
CREATE TABLE IF NOT EXISTS parent_profiles (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_parent_profiles_academy (academy_id),
  relation   VARCHAR(30)  NOT NULL,             -- Father, Mother, Guardian, ...
  phone      VARCHAR(30)  NOT NULL,
  alt_phone  VARCHAR(30)  NOT NULL DEFAULT '',
  email      VARCHAR(120) NOT NULL DEFAULT '',
  cnic       VARCHAR(20)  NOT NULL DEFAULT '',  -- national ID card number
  occupation VARCHAR(100) NOT NULL DEFAULT '',
  address    VARCHAR(255) NOT NULL DEFAULT '',
  CONSTRAINT fk_parent_profiles_user FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Which students each parent account can see. A parent can have several
-- children, and a child can have more than one parent account.
CREATE TABLE IF NOT EXISTS parent_students (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_parent_students_academy (academy_id),
  parent_id  VARCHAR(64)  NOT NULL,
  student_id VARCHAR(64)  NOT NULL,
  UNIQUE KEY uq_parent_student (parent_id, student_id),
  CONSTRAINT fk_parent_students_parent FOREIGN KEY (parent_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_students_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Messages between a parent and the school. Each parent has one conversation
-- with the school office (teacher_id NULL: every admin and the super admin) and
-- one with each teacher they write to (teacher_id = that teacher).
-- read_at is set when the other side reads it. Databases made before teacher
-- conversations get teacher_id and sender_role from store.js (ADDED_COLUMNS).
CREATE TABLE IF NOT EXISTS messages (
  seq         INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_messages_academy (academy_id),
  parent_id   VARCHAR(64)  NOT NULL,          -- whose conversation it is
  teacher_id  VARCHAR(64)  NULL,              -- NULL: the school office
  from_school BOOLEAN      NOT NULL,          -- TRUE: sent by staff, FALSE: by the parent
  sender_id   VARCHAR(64)  NOT NULL,
  sender_name VARCHAR(100) NOT NULL,          -- kept as text, like attendance.created_by
  sender_role VARCHAR(20)  NOT NULL DEFAULT '', -- admin, superadmin, teacher or parent
  body        TEXT         NOT NULL,
  created_at  DATETIME(3)  NOT NULL,          -- UTC
  read_at     DATETIME(3)  NULL,
  KEY idx_messages_parent (parent_id),
  CONSTRAINT fk_messages_parent FOREIGN KEY (parent_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Class diary: homework and notes a teacher (or admin) writes for a class on a day,
-- optionally for one subject. Parents see the diary of their children's classes.
CREATE TABLE IF NOT EXISTS diary (
  seq           INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_diary_academy (academy_id),
  class_id      VARCHAR(64)  NOT NULL,
  class_name    VARCHAR(100) NOT NULL,
  subject_id    VARCHAR(64)  NULL,             -- NULL: for the whole class, no subject
  subject_name  VARCHAR(100) NULL,
  date          DATE         NOT NULL,
  title         VARCHAR(150) NOT NULL DEFAULT '',
  body          TEXT         NOT NULL,
  created_by_id VARCHAR(64)  NOT NULL,
  created_by    VARCHAR(100) NOT NULL,
  created_at    DATETIME(3)  NOT NULL,         -- UTC
  updated_at    DATETIME(3)  NOT NULL,
  KEY idx_diary_class_date (class_id, date),
  CONSTRAINT fk_diary_class FOREIGN KEY (class_id) REFERENCES classes (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Leave applications: a parent asks for leave for their child; the class
-- teacher or an admin approves or rejects it. Names are kept as text, like
-- attendance.class_name, so the history stays readable.
CREATE TABLE IF NOT EXISTS leaves (
  seq            INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_leaves_academy (academy_id),
  student_id     VARCHAR(64)  NOT NULL,
  student_name   VARCHAR(100) NOT NULL,
  class_id       VARCHAR(64)  NOT NULL,
  class_name     VARCHAR(100) NOT NULL,
  parent_id      VARCHAR(64)  NOT NULL,
  parent_name    VARCHAR(100) NOT NULL,
  from_date      DATE         NOT NULL,
  to_date        DATE         NOT NULL,
  reason         TEXT         NOT NULL,
  status         ENUM('pending', 'approved', 'rejected') NOT NULL,
  review_note    VARCHAR(500) NOT NULL DEFAULT '',
  reviewed_by_id VARCHAR(64)  NULL,
  reviewed_by    VARCHAR(100) NULL,
  reviewed_at    DATETIME(3)  NULL,
  created_at     DATETIME(3)  NOT NULL,         -- UTC
  KEY idx_leaves_student (student_id),
  KEY idx_leaves_class (class_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Complaints and suggestions from parents and teachers to the school office.
-- An admin replies and marks it resolved.
CREATE TABLE IF NOT EXISTS feedback (
  seq          INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_feedback_academy (academy_id),
  kind         ENUM('complaint', 'suggestion') NOT NULL,
  subject      VARCHAR(150) NOT NULL,
  body         TEXT         NOT NULL,
  from_id      VARCHAR(64)  NOT NULL,
  from_name    VARCHAR(100) NOT NULL,
  from_role    VARCHAR(20)  NOT NULL,           -- parent or teacher
  student_id   VARCHAR(64)  NULL,               -- a parent may say which child it is about
  student_name VARCHAR(100) NULL,
  status       ENUM('open', 'resolved') NOT NULL,
  reply        TEXT         NOT NULL,
  replied_by   VARCHAR(100) NULL,
  replied_at   DATETIME(3)  NULL,
  created_at   DATETIME(3)  NOT NULL,           -- UTC
  KEY idx_feedback_from (from_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Photo gallery: albums for the whole school (class_id NULL) or one class.
-- Each photo's image is in the files table as "gallery-<photo id>".
CREATE TABLE IF NOT EXISTS gallery_albums (
  seq           INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_gallery_albums_academy (academy_id),
  title         VARCHAR(150) NOT NULL,
  description   VARCHAR(500) NOT NULL DEFAULT '',
  date          DATE         NOT NULL,
  class_id      VARCHAR(64)  NULL,             -- NULL: the whole school
  class_name    VARCHAR(100) NULL,
  created_by_id VARCHAR(64)  NOT NULL,
  created_by    VARCHAR(100) NOT NULL,
  created_at    DATETIME(3)  NOT NULL          -- UTC
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS gallery_photos (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  academy_id VARCHAR(64) NULL,
  KEY idx_gallery_photos_academy (academy_id),
  album_id   VARCHAR(64)  NOT NULL,
  type       VARCHAR(50)  NOT NULL,            -- image/png, image/jpeg, ...
  created_by VARCHAR(100) NOT NULL,
  created_at DATETIME(3)  NOT NULL,            -- UTC
  KEY idx_gallery_photos_album (album_id),
  CONSTRAINT fk_gallery_photos_album FOREIGN KEY (album_id) REFERENCES gallery_albums (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Each academy's settings: one row per part ("theme", "adminPermissions").
CREATE TABLE IF NOT EXISTS settings (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  academy_id VARCHAR(64)  NOT NULL DEFAULT 'default',
  name       VARCHAR(50)  NOT NULL,
  value      JSON         NOT NULL,
  PRIMARY KEY (academy_id, name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Uploaded files: each academy's logo and gallery photos, named
-- "<academy id>:<name>" (such as "default:logo").
CREATE TABLE IF NOT EXISTS files (
  name       VARCHAR(120) NOT NULL PRIMARY KEY,
  type       VARCHAR(50)  NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
