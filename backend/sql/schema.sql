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

CREATE TABLE IF NOT EXISTS users (
  seq      INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id       VARCHAR(64)  NOT NULL PRIMARY KEY,
  name     VARCHAR(100) NOT NULL,
  username VARCHAR(60)  NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- plain text: LOCAL DEMO ONLY
  role     ENUM('superadmin', 'admin', 'teacher') NOT NULL,
  disabled BOOLEAN NULL           -- teachers only; NULL = never disabled
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS classes (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  teacher_id VARCHAR(64)  NULL, -- the class teacher
  CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS students (
  seq           INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  roll_number   VARCHAR(20)  NOT NULL DEFAULT '', -- unique per class when filled in (checked by the API)
  name          VARCHAR(100) NOT NULL,
  class_id      VARCHAR(64)  NOT NULL,
  guardian_name VARCHAR(100) NOT NULL DEFAULT '',
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  KEY idx_students_class (class_id),
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  seq  INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id   VARCHAR(64)  NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- The subjects each class studies, and who teaches each one.
CREATE TABLE IF NOT EXISTS class_subjects (
  seq        INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
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

-- School-wide settings: one row per part ("theme", "adminPermissions").
CREATE TABLE IF NOT EXISTS settings (
  seq   INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  name  VARCHAR(50)  NOT NULL PRIMARY KEY,
  value JSON         NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Uploaded files, such as the logo.
CREATE TABLE IF NOT EXISTS files (
  name       VARCHAR(50)  NOT NULL PRIMARY KEY,
  type       VARCHAR(50)  NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
