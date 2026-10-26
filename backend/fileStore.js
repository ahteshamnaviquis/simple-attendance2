// Small helper for reading and writing the JSON data files.
//
// All writes go through a single queue, so two requests that update data at
// the same time run one after the other instead of overwriting each other.

const fs = require('fs/promises');
const path = require('path');
const seedData = require('./seedData');
const { DATA_DIR } = require('./config');

// The data files we manage: name -> starting content
const FILES = {
  users: seedData.users,
  classes: seedData.classes,
  students: seedData.students,
  attendance: seedData.attendance,
  subjects: seedData.subjects,
  classSubjects: seedData.classSubjects,
  exams: seedData.exams,
  marks: seedData.marks,
  settings: seedData.settings,
};

function filePath(name) {
  if (!FILES[name]) {
    throw new Error(`Unknown data file: ${name}`);
  }
  return path.join(DATA_DIR, `${name}.json`);
}

async function writeFileSafely(name, data) {
  // Write to a temporary file first, then rename it over the real file.
  // This way a crash mid-write never leaves a half-written JSON file.
  const target = filePath(name);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temp, target);
}

// Create the data folder and any missing JSON files.
async function initDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const [name, initialData] of Object.entries(FILES)) {
    try {
      await fs.access(filePath(name));
    } catch {
      await writeFileSafely(name, initialData);
      console.log(`Created data/${name}.json with sample data`);
    }
  }
}

async function readData(name) {
  const text = await fs.readFile(filePath(name), 'utf8');
  return JSON.parse(text);
}

// The write queue: each update waits for the previous one to finish.
let queue = Promise.resolve();

// Read a file, let `changeFn` modify the data, then save it.
// `changeFn` receives the current data and returns the new data.
// Returns whatever `changeFn` returned.
function updateData(name, changeFn) {
  const task = queue.then(async () => {
    const current = await readData(name);
    const updated = await changeFn(current);
    await writeFileSafely(name, updated);
    return updated;
  });
  // Keep the queue going even if this task fails.
  queue = task.catch(() => {});
  return task;
}

module.exports = { initDataFiles, readData, updateData };
