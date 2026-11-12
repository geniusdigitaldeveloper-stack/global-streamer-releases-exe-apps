// Jalankan backend dan frontend serentak untuk pembangunan.
import { spawn } from 'node:child_process';
const run = (name, args) => {
  const p = spawn('npm', ['run', name, ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (code) => { if (code) process.exit(code); });
  return p;
};
const procs = [run('dev:server', []), run('dev:web', [])];
process.on('SIGINT', () => { procs.forEach((p) => p.kill('SIGINT')); process.exit(0); });
