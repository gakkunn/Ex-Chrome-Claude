import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const distPath = path.resolve('dist');
const artifactsDir = path.resolve('artifacts');
const artifactName = `claude-power-suite-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}.zip`;
const artifactPath = path.join(artifactsDir, artifactName);

if (!fs.existsSync(distPath)) {
  throw new Error('dist/ does not exist. Run "npm run build" first.');
}

fs.mkdirSync(artifactsDir, { recursive: true });

console.info(`Creating ${artifactPath}`);
execFileSync('zip', ['-r', artifactPath, '.'], {
  cwd: distPath,
  stdio: 'inherit',
});

console.info(`Archive ready: ${artifactPath}`);

