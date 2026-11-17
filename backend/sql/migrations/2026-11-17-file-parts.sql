-- Uploads up to 100 MB (logo, profile photos, gallery photos).
--
-- Big files are saved in 4 MB pieces: the first piece stays in `files`, the
-- rest go in this new table. Nothing else changes and existing files keep
-- working as they are.
--
-- The backend also creates this table by itself when it starts, so running
-- this script is optional. Run it in phpMyAdmin (SQL tab) on the production
-- database if you want the table there before restarting the app.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS file_parts (
  name       VARCHAR(120) NOT NULL,
  part       INT          NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  PRIMARY KEY (name, part)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
