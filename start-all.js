/**
 * start-all.js
 * Convenience runner: starts the Student and Admin servers together.
 * Federal Polytechnic, Ilaro - NBTE 4.0 Standard
 */

const { spawn } = require('child_process');
const path = require('path');

const servers = [
  { name: 'STUDENT', script: path.join(__dirname, 'Student server', 'student-server.js') },
  { name: 'ADMIN', script: path.join(__dirname, 'Admin server', 'admin-server.js') }
];

const children = [];

function shutdown() {
  children.forEach((child) => {
    if (!child.killed) child.kill();
  });
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

servers.forEach(({ name, script }) => {
  const child = spawn(process.execPath, [script], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env
  });

  child.on('exit', (code) => {
    console.error(`[${name}] server exited with code ${code}. Shutting down all servers.`);
    shutdown();
  });

  children.push(child);
});
