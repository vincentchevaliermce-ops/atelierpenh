// Atelier Penh editor API — one Cloudflare Worker (free plan) for ALL clients.
// The client's editor (/admin on their site) talks to this worker, which
// checks the password, validates the content and commits it to the client's
// GitHub repository. GitHub Actions then rebuilds the site.
//
// Configuration (Cloudflare dashboard → Worker → Settings → Variables):
//   CLIENTS            (plain text, JSON)  {"demo-cafe":{"repo":"owner/demo-cafe","branch":"main","origins":["https://democafe.com"]}}
//   GITHUB_TOKEN       (secret)  fine-grained token, "Contents: Read and write" on the client repos only
//   SESSION_SECRET     (secret)  long random string, signs login sessions
//   PASSWORD_DEMO_CAFE (secret)  one per client: PASSWORD_ + client id in capitals, "-" becomes "_"
// Optional: a KV namespace bound as LOGIN_KV to block password guessing (10 tries / 15 min).
//
// A client can only use the editor if it is listed in CLIENTS, has a password
// secret AND its site.config.json in GitHub says "editor": {"enabled": true}.

const SESSION_DAYS = 30;
const MAX_UPLOADS = 12;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const CONTENT_PATH = 'content/site.json';
const SCHEMA_PATH = 'content/schema.json';
const CONFIG_PATH = 'site.config.json';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    let clients;
    try { clients = JSON.parse(env.CLIENTS || '{}'); } catch { return json({ error: 'server_config' }, 500); }
    const allowed = new Set(Object.values(clients).flatMap(c => c.origins || []));
    const cors = allowed.has(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: allowed.has(origin) ? 204 : 403, headers: cors });
    const reply = (data, status = 200) => json(data, status, cors);

    try {
      if (url.pathname === '/login' && req.method === 'POST') {
        const { client, password } = await req.json();
        const c = clients[client];
        if (!c || !(c.origins || []).includes(origin)) return reply({ error: 'bad_login' }, 401);
        const ip = req.headers.get('CF-Connecting-IP') || 'x';
        if (await isLocked(env, client, ip)) return reply({ error: 'locked' }, 429);
        const expected = env['PASSWORD_' + client.toUpperCase().replace(/[^A-Z0-9]/g, '_')];
        if (!expected || typeof password !== 'string' || !(await sameText(password, expected))) {
          await countFailure(env, client, ip);
          await new Promise(r => setTimeout(r, 800));
          return reply({ error: 'bad_login' }, 401);
        }
        const gh = github(env, c);
        if (!(await editorEnabled(gh))) return reply({ error: 'disabled' }, 403);
        return reply({ token: await sign(env, { c: client, exp: Date.now() + SESSION_DAYS * 864e5 }) });
      }

      // Everything below needs a valid session.
      const session = await verify(env, (req.headers.get('Authorization') || '').replace(/^Bearer /, ''));
      if (!session || !clients[session.c]) return reply({ error: 'session' }, 401);
      const c = clients[session.c];
      if (!(c.origins || []).includes(origin)) return reply({ error: 'origin' }, 403);
      const gh = github(env, c);
      if (!(await editorEnabled(gh))) return reply({ error: 'disabled' }, 403);

      if (url.pathname === '/content' && req.method === 'GET') {
        const f = await gh.file(CONTENT_PATH);
        return reply({ content: JSON.parse(f.text), sha: f.sha });
      }

      if (url.pathname === '/publish' && req.method === 'POST') {
        const body = await req.json();
        const current = await gh.file(CONTENT_PATH);
        if (body.baseSha !== current.sha) return reply({ error: 'conflict' }, 409);
        const schema = JSON.parse((await gh.file(SCHEMA_PATH)).text);
        let content = validateContent(schema, body.content, { allowUploads: true });

        // New photos: give them a safe name and replace "upload:id" in the content.
        const uploads = Array.isArray(body.uploads) ? body.uploads.slice(0, MAX_UPLOADS) : [];
        const files = [];
        const names = {};
        const stamp = new Date().toISOString().slice(0, 10);
        for (const u of uploads) {
          if (!/^[a-z0-9]{6,32}$/.test(u.id || '') || typeof u.data !== 'string') continue;
          const bytes = base64Bytes(u.data);
          if (!bytes || bytes.length > MAX_UPLOAD_BYTES || !isImage(bytes)) return reply({ error: 'image' }, 400);
          const ext = bytes[0] === 0x89 ? 'png' : bytes[0] === 0xff ? 'jpg' : 'webp';
          const path = `img/uploads/${stamp}-${u.id}.${ext}`;
          names[u.id] = path;
          files.push({ path, base64: u.data });
        }
        let text = JSON.stringify(content, null, 2);
        text = text.replace(/"upload:([a-z0-9]+)"/g, (m, id) => names[id] ? JSON.stringify(names[id]) : '""');
        content = validateContent(schema, JSON.parse(text)); // final check: no "upload:" left
        text = JSON.stringify(content, null, 2) + '\n';
        files.push({ path: CONTENT_PATH, text });

        await gh.commit(files, 'Content update from the website editor');
        const saved = await gh.file(CONTENT_PATH);
        return reply({ ok: true, content, sha: saved.sha });
      }
      return reply({ error: 'not_found' }, 404);
    } catch (e) {
      if (e instanceof ContentError) return reply({ error: 'invalid', path: e.path, code: e.code }, 400);
      console.log('editor error', e && e.stack || e);
      return reply({ error: 'server' }, 500);
    }
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}

// ---------- GitHub ----------
function github(env, c) {
  const branch = c.branch || 'main';
  const call = async (path, init = {}) => {
    const res = await fetch(`https://api.github.com/repos/${c.repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'atelierpenh-editor', ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} ${path}`);
    return res.json();
  };
  return {
    async file(path) {
      const r = await call(`/contents/${path}?ref=${encodeURIComponent(branch)}`);
      const bin = atob(r.content.replace(/\n/g, ''));
      return { sha: r.sha, text: new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))) };
    },
    // One commit for all files = one rebuild of the site.
    async commit(files, message) {
      const ref = await call(`/git/ref/heads/${encodeURIComponent(branch)}`);
      const head = await call(`/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const f of files) {
        const blob = await call('/git/blobs', { method: 'POST', body: JSON.stringify(f.text != null ? { content: f.text, encoding: 'utf-8' } : { content: f.base64, encoding: 'base64' }) });
        tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const newTree = await call('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const commit = await call('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [head.sha] }) });
      await call(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    }
  };
}
async function editorEnabled(gh) {
  try { const cfg = JSON.parse((await gh.file(CONFIG_PATH)).text); return !!(cfg.editor && cfg.editor.enabled); }
  catch { return false; }
}

// ---------- Security helpers ----------
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(env, data) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET missing or too short');
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function sign(env, payload) {
  const p = b64url(enc.encode(JSON.stringify(payload)));
  return `${p}.${await hmac(env, p)}`;
}
async function verify(env, token) {
  const [p, s] = String(token || '').split('.');
  if (!p || !s) return null;
  if (!(await sameText(s, await hmac(env, p)))) return null;
  try {
    const data = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
// Constant-time comparison (compares SHA-256 digests).
async function sameText(a, b) {
  const [x, y] = await Promise.all([a, b].map(v => crypto.subtle.digest('SHA-256', enc.encode(v))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}
async function isLocked(env, client, ip) {
  if (!env.LOGIN_KV) return false;
  return Number(await env.LOGIN_KV.get(`fail:${client}:${ip}`)) >= 10;
}
async function countFailure(env, client, ip) {
  if (!env.LOGIN_KV) return;
  const k = `fail:${client}:${ip}`;
  const n = Number(await env.LOGIN_KV.get(k)) || 0;
  await env.LOGIN_KV.put(k, String(n + 1), { expirationTtl: 900 });
}
function base64Bytes(s) {
  try { const bin = atob(s); return Uint8Array.from(bin, ch => ch.charCodeAt(0)); } catch { return null; }
}
function isImage(b) {
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpg || png || webp;
}

// ---------- Content validation: COPY of client-template/validate.js (keep in sync) ----------
// VALIDATE-START
// Content validation, shared by the editor (browser), build.js (Node) and,
// as a copy, by editor-worker/worker.js. Keep the three in sync.
// Returns a cleaned copy of the content that only contains fields declared in
// schema.json, with lengths capped and formats checked. Throws on bad formats.

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?[0-9 ().-]{6,22}$/;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const IMAGE = /^img\/(?!.*\.\.)[A-Za-z0-9._\/-]+\.(jpe?g|png|webp)$/i;
const UPLOAD = /^upload:[a-z0-9]{6,32}$/;

class ContentError extends Error {
  constructor(path, code) { super(`${path}: ${code}`); this.path = path; this.code = code; }
}

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
function clean(v, max, multiline) {
  let s = str(v).replace(/\r\n?/g, '\n');
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.trim();
  return max ? s.slice(0, max) : s;
}

function validateField(field, value, path, opts = {}) {
  switch (field.type) {
    case 'text': return clean(value, field.max || 200, false);
    case 'longtext': return clean(value, field.max || 2000, true).replace(/\n{3,}/g, '\n\n');
    case 'phone': {
      const s = clean(value, 22, false);
      if (s && !PHONE.test(s)) throw new ContentError(path, 'phone');
      return s;
    }
    case 'email': {
      const s = clean(value, 120, false);
      if (s && !EMAIL.test(s)) throw new ContentError(path, 'email');
      return s;
    }
    case 'url': {
      let s = clean(value, 400, false);
      if (!s) return '';
      if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
      try { const u = new URL(s); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { throw new ContentError(path, 'url'); }
      return s;
    }
    case 'image': {
      const s = clean(value, 200, false);
      if (!s) return '';
      if (IMAGE.test(s)) return s;
      if (opts.allowUploads && UPLOAD.test(s)) return s;
      throw new ContentError(path, 'image');
    }
    case 'bool': return value === true;
    case 'time': {
      const s = clean(value, 5, false);
      if (!TIME.test(s)) throw new ContentError(path, 'time');
      return s;
    }
    case 'day': {
      const v = value && typeof value === 'object' ? value : {};
      return {
        closed: v.closed === true,
        open: TIME.test(str(v.open)) ? v.open : '09:00',
        close: TIME.test(str(v.close)) ? v.close : '18:00'
      };
    }
    case 'object': {
      const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const out = {};
      for (const f of field.fields) out[f.key] = validateField(f, v[f.key], `${path}.${f.key}`, opts);
      for (const f of field.fields) if (f.required && !out[f.key]) throw new ContentError(`${path}.${f.key}`, 'required');
      return out;
    }
    case 'list': {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length > (field.max || 50)) throw new ContentError(path, 'too_many');
      return arr.map((item, i) => validateField({ type: 'object', fields: field.fields }, item, `${path}[${i}]`, opts));
    }
    default: throw new ContentError(path, 'unknown_type');
  }
}

function validateContent(schema, content, opts = {}) {
  if (!schema || !Array.isArray(schema.sections)) throw new ContentError('schema', 'invalid');
  const c = content && typeof content === 'object' ? content : {};
  const out = {};
  for (const s of schema.sections) out[s.key] = validateField(s, c[s.key], s.key, opts);
  return out;
}
// VALIDATE-END
