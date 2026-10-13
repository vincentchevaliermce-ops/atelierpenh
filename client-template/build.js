// Builds the public site into _site/ (no dependencies, Node 18+).
//   node build.js
// Run by .github/workflows/deploy.yml on every push, so each "Publish"
// from the editor (a commit on content/site.json) rebuilds the site.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { validateContent } from './validate.js';
import { renderSite } from './render.js';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const cfg = read('site.config.json');
const schema = read('content/schema.json');
const content = validateContent(schema, read('content/site.json')); // throws if invalid: the old site stays online
const editor = !!(cfg.editor && cfg.editor.enabled);
const base = cfg.siteUrl || '/';

const out = '_site';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

writeFileSync(`${out}/index.html`, renderSite(cfg, content));
for (const p of ['assets', 'img']) if (existsSync(p)) cpSync(p, `${out}/${p}`, { recursive: true });
if (cfg.domain) writeFileSync(`${out}/CNAME`, cfg.domain + '\n');
writeFileSync(`${out}/.nojekyll`, '');
writeFileSync(`${out}/robots.txt`, `User-agent: *\nAllow: /\n${editor ? 'Disallow: /admin/\n' : ''}Sitemap: ${new URL('sitemap.xml', base).href}\n`);
writeFileSync(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url></urlset>\n`);
writeFileSync(`${out}/404.html`, `<!doctype html><html lang="${cfg.language || 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404</title><link rel="stylesheet" href="/assets/style.css"></head><body><main class="section"><h1>404</h1><p><a href="/">← ${content.business.name}</a></p></main></body></html>\n`);

// The editor only ships when it is enabled for this client (offer B).
if (editor) {
  cpSync('admin', `${out}/admin`, { recursive: true });
  mkdirSync(`${out}/content`, { recursive: true });
  cpSync('content/schema.json', `${out}/content/schema.json`);
  for (const f of ['render.js', 'validate.js', 'site.config.json']) cpSync(f, `${out}/${f}`);
}
console.log(`Built ${out}/ (editor ${editor ? 'ON' : 'OFF'})`);
