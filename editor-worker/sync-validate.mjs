// Copies client-template/validate.js into worker.js (between VALIDATE-START / VALIDATE-END).
//   node editor-worker/sync-validate.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('.', import.meta.url);
const src = readFileSync(new URL('../client-template/validate.js', here), 'utf8').replace(/^export /gm, '');
const wPath = new URL('worker.js', here);
const w = readFileSync(wPath, 'utf8');
const out = w.replace(/\/\/ VALIDATE-START\n[\s\S]*?\/\/ VALIDATE-END/, `// VALIDATE-START\n${src}// VALIDATE-END`);
writeFileSync(wPath, out);
console.log(out === w ? 'worker.js already in sync' : 'worker.js updated');
