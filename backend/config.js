// All backend settings in one place.
//
// Values come from backend/.env (if the file exists), then fall back to the
// defaults below. Real environment variables win over the .env file.
// See .env.example for the list of settings.

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile); // built into Node.js 20.12+, no extra library
}

module.exports = {
  // Port the API listens on. The frontend's API_URL must point here.
  PORT: Number(process.env.PORT) || 5050,

  // 127.0.0.1 keeps the prototype reachable only from this computer.
  // On Railway (which sets RAILWAY_ENVIRONMENT) the app must listen on
  // 0.0.0.0, otherwise Railway cannot reach it and answers 502.
  HOST: process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1'),

  // Folder holding users.json, classes.json, students.json, attendance.json.
  // A relative path is resolved from the backend folder.
  DATA_DIR: path.resolve(__dirname, process.env.DATA_DIR || 'data'),
};
