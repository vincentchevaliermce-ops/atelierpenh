// Content validation, shared by the editor (browser), build.js (Node) and,
// as a copy, by editor-worker/worker.js. Keep the three in sync.
// Returns a cleaned copy of the content that only contains fields declared in
// schema.json, with lengths capped and formats checked. Throws on bad formats.

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?[0-9 ().-]{6,22}$/;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const IMAGE = /^img\/(?!.*\.\.)[A-Za-z0-9._\/-]+\.(jpe?g|png|webp)$/i;
const UPLOAD = /^upload:[a-z0-9]{6,32}$/;

export class ContentError extends Error {
  constructor(path, code) { super(`${path}: ${code}`); this.path = path; this.code = code; }
}

function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }
function clean(v, max, multiline) {
  let s = str(v).replace(/\r\n?/g, '\n');
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.trim();
  return max ? s.slice(0, max) : s;
}

export function validateField(field, value, path, opts = {}) {
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

export function validateContent(schema, content, opts = {}) {
  if (!schema || !Array.isArray(schema.sections)) throw new ContentError('schema', 'invalid');
  const c = content && typeof content === 'object' ? content : {};
  const out = {};
  for (const s of schema.sections) out[s.key] = validateField(s, c[s.key], s.key, opts);
  return out;
}
