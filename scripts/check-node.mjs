import { readFileSync } from 'node:fs';

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (process.versions.node !== engines.node) {
  console.error(`Expected Node.js ${engines.node}, received ${process.versions.node}. Use mise install and mise exec.`);
  process.exit(1);
}
