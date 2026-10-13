// Simple website editor for shop owners (offer B).
// Reads the form from content/schema.json, edits a copy of the content,
// shows a preview with the real design (render.js), then sends it to the
// editor API (editor-worker), which saves it in GitHub. GitHub then rebuilds the site.
import { renderSite } from '../render.js';
import { validateContent, ContentError } from '../validate.js';

const ROOT = new URL('../', location.href);
const MAX_SIDE = 1600;          // photos are resized on the phone before upload
const JPEG_QUALITY = 0.82;

// ---------- Interface text (English + French) ----------
const L = {
  en: {
    loading: 'Loading…', title: 'Edit my website', password: 'Password', login: 'Log in', logout: 'Log out',
    badPassword: 'Wrong password. Try again.', locked: 'Too many tries. Wait 15 minutes, then try again.',
    disabled: 'The editor is not active for this website. Contact Atelier Penh to make a change.',
    offline: 'No internet connection. Check your connection and try again.',
    hello: 'What do you want to change?', preview: 'Preview', publish: 'Publish', back: 'Back',
    backEdit: 'Back to editing', unsaved: 'You have changes that are not published yet.',
    discard: 'Cancel my changes', discardQ: 'Cancel all changes not published yet?', yes: 'Yes', no: 'No',
    nothing: 'No changes to publish.', publishQ: 'Publish your changes now? Everyone will see them.',
    publishing: 'Publishing…', done: 'Published! Your website will show the changes in 1 or 2 minutes.',
    ok: 'OK', error: 'Something went wrong. Nothing was changed on your website. Try again, or contact Atelier Penh.',
    conflict: 'Your website was changed somewhere else. Tap OK to load the latest version.',
    session: 'Please log in again.', demo: 'Demo mode: publishing is turned off.',
    add: 'Add', remove: 'Remove', up: 'Move up', down: 'Move down', removeQ: 'Remove this?',
    choosePhoto: 'Choose a photo', changePhoto: 'Change photo', removePhoto: 'Remove photo', noPhoto: 'No photo',
    photoBusy: 'Preparing photo…', photoErr: 'This photo could not be opened. Try another one.',
    open: 'Open', closed: 'Closed', from: 'from', to: 'to', untitled: '(empty)',
    checkField: 'Please check this field:', lang: 'FR',
    errs: { phone: 'phone number looks wrong', email: 'email looks wrong', url: 'link looks wrong (it should start with https://)', image: 'photo problem', required: 'cannot be empty', too_many: 'too many items', time: 'time looks wrong' }
  },
  fr: {
    loading: 'Chargement…', title: 'Modifier mon site', password: 'Mot de passe', login: 'Se connecter', logout: 'Déconnexion',
    badPassword: 'Mot de passe incorrect. Réessayez.', locked: 'Trop d\'essais. Attendez 15 minutes puis réessayez.',
    disabled: 'L\'éditeur n\'est pas activé pour ce site. Contactez Atelier Penh pour toute modification.',
    offline: 'Pas de connexion internet. Vérifiez votre connexion et réessayez.',
    hello: 'Que voulez-vous modifier ?', preview: 'Aperçu', publish: 'Publier', back: 'Retour',
    backEdit: 'Retour aux modifications', unsaved: 'Vous avez des modifications pas encore publiées.',
    discard: 'Annuler mes modifications', discardQ: 'Annuler toutes les modifications non publiées ?', yes: 'Oui', no: 'Non',
    nothing: 'Aucune modification à publier.', publishQ: 'Publier vos modifications maintenant ? Tout le monde les verra.',
    publishing: 'Publication…', done: 'Publié ! Votre site affichera les changements d\'ici 1 à 2 minutes.',
    ok: 'OK', error: 'Un problème est survenu. Rien n\'a changé sur votre site. Réessayez ou contactez Atelier Penh.',
    conflict: 'Votre site a été modifié ailleurs. Touchez OK pour charger la dernière version.',
    session: 'Merci de vous reconnecter.', demo: 'Mode démo : la publication est désactivée.',
    add: 'Ajouter', remove: 'Supprimer', up: 'Monter', down: 'Descendre', removeQ: 'Supprimer cet élément ?',
    choosePhoto: 'Choisir une photo', changePhoto: 'Changer la photo', removePhoto: 'Retirer la photo', noPhoto: 'Pas de photo',
    photoBusy: 'Préparation de la photo…', photoErr: 'Impossible d\'ouvrir cette photo. Essayez-en une autre.',
    open: 'Ouvert', closed: 'Fermé', from: 'de', to: 'à', untitled: '(vide)',
    checkField: 'Vérifiez ce champ :', lang: 'EN',
    errs: { phone: 'le numéro semble faux', email: 'l\'e-mail semble faux', url: 'le lien semble faux (il doit commencer par https://)', image: 'problème de photo', required: 'ne peut pas être vide', too_many: 'trop d\'éléments', time: 'heure incorrecte' }
  }
};

// ---------- State ----------
const S = {
  lang: 'en',
  cfg: null, schema: null, api: '', demo: false, token: null,
  saved: null, sha: null, draft: null, uploads: {}
};
// localStorage can be unavailable (private mode): never let it crash the editor.
const store = makeStore();
function makeStore() {
  return {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };
}
const t = k => L[S.lang][k];
const tl = o => (o && (o[S.lang] || o.en)) || '';
const clone = o => JSON.parse(JSON.stringify(o));
const draftKey = () => `ap-draft-${S.cfg.clientId}`;
const tokenKey = () => `ap-token-${S.cfg.clientId}`;

// ---------- Tiny DOM helper (never uses innerHTML with user text) ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
const app = () => document.getElementById('app');
function screen(...nodes) { const a = app(); a.replaceChildren(...nodes); window.scrollTo(0, 0); }

function modal(title, text, buttons) {
  return new Promise(resolve => {
    const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', {},
        title && h('h2', {}, title),
        text && h('p', {}, text),
        ...buttons.map(b => h('button', { class: `btn ${b.cls || ''}`, onclick: () => { m.remove(); resolve(b.value); } }, b.label))));
    document.body.append(m);
    m.querySelector('button').focus();
  });
}
const alertBox = (text, cls = '') => modal('', text, [{ label: t('ok'), value: true, cls: cls || 'btn-dark' }]);
const confirmBox = text => modal('', text, [{ label: t('yes'), value: true, cls: 'btn-go' }, { label: t('no'), value: false }]);
function busy(text) {
  const m = h('div', { class: 'modal' }, h('div', { class: 'center' }, h('div', { class: 'spin' }), h('p', {}, text)));
  document.body.append(m);
  return () => m.remove();
}

// ---------- API ----------
async function api(path, body) {
  let res;
  try {
    res = await fetch(S.api + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch { throw Object.assign(new Error('offline'), { code: 'offline' }); }
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw Object.assign(new Error(data.error || res.status), { code: data.error || String(res.status), status: res.status });
  return data;
}

// ---------- Draft (kept on the phone until published) ----------
function saveDraft() {
  const ok = store.set(draftKey(), JSON.stringify({ sha: S.sha, draft: S.draft, uploads: S.uploads }));
  if (!ok) store.set(draftKey(), JSON.stringify({ sha: S.sha, draft: S.draft, uploads: {} }));
}
const dirty = () => JSON.stringify(S.draft) !== JSON.stringify(S.saved);
function resolveImage(p) {
  if (!p) return '';
  if (p.startsWith('upload:')) return S.uploads[p.slice(7)]?.dataUrl || '';
  return new URL(p, ROOT).href;
}

// ---------- Boot ----------
async function boot() {
  S.lang = store.get('ap-lang') || ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  try {
    const [cfg, schema] = await Promise.all([
      fetch(new URL('site.config.json', ROOT)).then(r => r.json()),
      fetch(new URL('content/schema.json', ROOT)).then(r => r.json())
    ]);
    S.cfg = cfg; S.schema = schema;
  } catch { return screen(h('p', { class: 'center' }, t('error'))); }
  if (!S.cfg.editor || !S.cfg.editor.enabled) return screen(h('p', { class: 'center' }, t('disabled')));
  S.api = (S.cfg.editor.apiUrl || '').replace(/\/$/, '');
  S.demo = !S.api;
  S.token = store.get(tokenKey());
  if (S.demo || S.token) return loadContent();
  loginScreen();
}

function loginScreen(msg) {
  const input = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  const form = h('form', { class: 'login', onsubmit: async e => {
    e.preventDefault();
    const done = busy(t('loading'));
    try {
      const r = await api('/login', { client: S.cfg.clientId, password: input.value });
      S.token = r.token; store.set(tokenKey(), r.token);
      done(); loadContent();
    } catch (err) {
      done();
      loginScreen(err.code === 'locked' ? t('locked') : err.code === 'offline' ? t('offline') : err.code === 'disabled' ? t('disabled') : t('badPassword'));
    }
  } },
    h('h1', {}, t('title')),
    msg && h('p', { class: 'notice err', role: 'alert' }, msg),
    h('label', { class: 'field' }, h('span', {}, t('password')), input),
    h('button', { class: 'btn btn-go', type: 'submit' }, t('login')),
    h('p', {}, h('button', { type: 'button', class: 'btn btn-small', onclick: toggleLang }, t('lang')))
  );
  screen(form);
  input.focus();
}

async function loadContent() {
  screen(h('p', { class: 'center' }, t('loading')));
  try {
    if (S.demo) {
      S.saved = await fetch(new URL('content/site.json', ROOT)).then(r => r.json());
      S.sha = 'demo';
    } else {
      const r = await api(`/content?client=${encodeURIComponent(S.cfg.clientId)}`);
      S.saved = r.content; S.sha = r.sha;
    }
    S.saved = validateContent(S.schema, S.saved);
  } catch (err) {
    if (err.status === 401) { store.del(tokenKey()); S.token = null; return loginScreen(t('session')); }
    if (err.code === 'disabled') return screen(h('p', { class: 'center' }, t('disabled')));
    return screen(h('div', { class: 'center' }, h('p', {}, err.code === 'offline' ? t('offline') : t('error')),
      h('button', { class: 'btn btn-dark', onclick: loadContent }, 'OK')));
  }
  S.draft = clone(S.saved); S.uploads = {};
  try {
    const d = JSON.parse(store.get(draftKey()) || 'null');
    if (d && d.sha === S.sha && d.draft) { S.draft = validateContent(S.schema, d.draft, { allowUploads: true }); S.uploads = d.uploads || {}; }
  } catch { /* old or broken draft: ignore it */ }
  home();
}

function toggleLang() {
  S.lang = S.lang === 'fr' ? 'en' : 'fr';
  store.set('ap-lang', S.lang);
  document.documentElement.lang = S.lang;
  if (S.draft) home(); else if (S.cfg && S.cfg.editor && S.cfg.editor.enabled) loginScreen(); else boot();
}

function topBar(title, left) {
  return h('header', { class: 'top' }, left, h('h1', {}, title),
    h('button', { onclick: toggleLang, 'aria-label': S.lang === 'fr' ? 'English' : 'Français' }, t('lang')));
}

// ---------- Home ----------
function home() {
  const tiles = S.schema.sections.map(sec => h('button', { class: 'tile', onclick: () => sectionScreen(sec) },
    h('span', { class: 'ic', 'aria-hidden': 'true' }, sec.icon || '•'), h('b', {}, tl(sec.label)), h('small', {}, tl(sec.help))));
  screen(
    topBar(S.draft.business?.name || t('title'), !S.demo && h('button', { onclick: logout }, t('logout'))),
    h('main', { class: 'wrap' },
      S.demo && h('p', { class: 'notice' }, t('demo')),
      dirty() && h('div', { class: 'notice' }, t('unsaved'), h('button', { class: 'btn btn-small btn-danger', onclick: discard }, t('discard'))),
      h('h2', {}, t('hello')),
      h('div', { class: 'tiles' }, tiles)),
    bottomBar());
}
function bottomBar() {
  return h('div', { class: 'bar' },
    h('button', { class: 'btn', onclick: preview }, '👁 ', t('preview')),
    h('button', { class: 'btn btn-go', onclick: publish }, '✓ ', t('publish')));
}
async function discard() {
  if (!(await confirmBox(t('discardQ')))) return;
  S.draft = clone(S.saved); S.uploads = {}; store.del(draftKey()); home();
}
async function logout() {
  store.del(tokenKey()); S.token = null; S.draft = null; loginScreen();
}

// ---------- Section editor ----------
function sectionScreen(sec) {
  const body = h('main', { class: 'wrap' }, sec.help && h('p', { class: 'muted' }, tl(sec.help)));
  if (sec.type === 'list') body.append(listEditor(sec, S.draft, sec.key));
  else for (const f of sec.fields) body.append(fieldEditor(f, S.draft[sec.key], f.key));
  body.append(h('button', { class: 'btn btn-dark', onclick: home }, '← ', t('back')));
  screen(topBar(tl(sec.label), h('button', { onclick: home, 'aria-label': t('back') }, '←')), body, bottomBar());
}

function fieldEditor(f, obj, key) {
  const label = tl(f.label);
  const set = v => { obj[key] = v; saveDraft(); };
  switch (f.type) {
    case 'text': case 'phone': case 'email': case 'url': {
      const type = { phone: 'tel', email: 'email', url: 'url' }[f.type] || 'text';
      const max = f.type === 'text' ? f.max : f.type === 'url' ? 400 : f.type === 'email' ? 120 : 22;
      const count = h('small', { class: 'count' });
      const upd = () => { count.textContent = `${input.value.length} / ${max}`; };
      const input = h('input', { type, value: obj[key] || '', maxLength: max, placeholder: f.placeholder || '',
        inputMode: f.type === 'phone' ? 'tel' : undefined, autocomplete: 'off',
        oninput: e => { set(e.target.value); upd(); } });
      upd();
      return h('label', { class: 'field' }, h('span', {}, label), input, f.type === 'text' && count);
    }
    case 'longtext': {
      const count = h('small', { class: 'count' });
      const ta = h('textarea', { maxLength: f.max, rows: Math.min(10, Math.max(3, Math.ceil((f.max || 300) / 120))),
        oninput: e => { set(e.target.value); count.textContent = `${e.target.value.length} / ${f.max}`; } });
      ta.value = obj[key] || '';
      count.textContent = `${ta.value.length} / ${f.max}`;
      return h('label', { class: 'field' }, h('span', {}, label), ta, count);
    }
    case 'image': return imageEditor(label, obj, key);
    case 'day': return dayEditor(label, obj, key);
    case 'list': return h('div', { class: 'sub' }, h('h3', {}, label), listEditor(f, obj, key));
    default: return h('p', {}, label);
  }
}

function imageEditor(label, obj, key) {
  const box = h('div', { class: 'img-box' });
  const draw = () => {
    const url = resolveImage(obj[key]);
    const file = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      const done = busy(t('photoBusy'));
      try {
        const dataUrl = await resizePhoto(f);
        const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        S.uploads[id] = { dataUrl };
        obj[key] = `upload:${id}`; saveDraft(); draw();
      } catch { alertBox(t('photoErr')); }
      done();
    } });
    const pick = h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, '📷 ', url ? t('changePhoto') : t('choosePhoto'));
    box.replaceChildren(
      h('span', { class: 'field' }, h('span', {}, label)),
      url ? h('img', { src: url, alt: '' }) : h('div', { class: 'img-empty' }, t('noPhoto')),
      file, pick,
      url && h('button', { type: 'button', class: 'btn btn-small btn-danger', onclick: () => { obj[key] = ''; saveDraft(); draw(); } }, t('removePhoto')));
  };
  draw();
  return h('div', { class: 'field' }, box);
}

function dayEditor(label, obj, key) {
  const d = obj[key];
  const wrap = h('div', { class: 'day' });
  const draw = () => {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label },
      h('button', { type: 'button', 'aria-pressed': String(!d.closed), onclick: () => { d.closed = false; saveDraft(); draw(); } }, t('open')),
      h('button', { type: 'button', 'aria-pressed': String(d.closed), onclick: () => { d.closed = true; saveDraft(); draw(); } }, t('closed')));
    const time = (k, lbl) => h('input', { type: 'time', value: d[k], 'aria-label': `${label} ${lbl}`, onchange: e => { if (e.target.value) { d[k] = e.target.value; saveDraft(); } } });
    wrap.replaceChildren(h('b', {}, label), seg,
      !d.closed && h('div', { class: 'times' }, h('span', {}, t('from')), time('open', t('from')), h('span', {}, t('to')), time('close', t('to'))));
  };
  draw();
  return wrap;
}

function blankItem(fields) {
  const o = {};
  for (const f of fields) o[f.key] = f.type === 'list' ? [] : f.type === 'day' ? { closed: false, open: '09:00', close: '18:00' } : '';
  return o;
}

function listEditor(f, obj, key, openIndex = -1) {
  const wrap = h('div', {});
  const draw = (openAt = -1) => {
    const arr = obj[key];
    const cards = arr.map((item, i) => {
      const title = (f.itemTitle && item[f.itemTitle]) || `${i + 1}. ${t('untitled')}`;
      const move = dir => { const j = i + dir; [arr[i], arr[j]] = [arr[j], arr[i]]; saveDraft(); draw(j); };
      const inner = h('div', { class: 'inner' },
        ...f.fields.map(sf => fieldEditor(sf, item, sf.key)),
        h('div', { class: 'tools' },
          i > 0 && h('button', { type: 'button', class: 'btn btn-small', onclick: () => move(-1) }, '↑ ', t('up')),
          i < arr.length - 1 && h('button', { type: 'button', class: 'btn btn-small', onclick: () => move(1) }, '↓ ', t('down')),
          h('button', { type: 'button', class: 'btn btn-small btn-danger', onclick: async () => {
            if (!(await confirmBox(t('removeQ')))) return;
            arr.splice(i, 1); saveDraft(); draw();
          } }, '✕ ', t('remove'))));
      const d = h('details', { class: 'card', open: i === openAt }, h('summary', {}, title), inner);
      // Keep the card title in sync with what is typed.
      if (f.itemTitle) d.addEventListener('input', () => { d.firstChild.textContent = item[f.itemTitle] || `${i + 1}. ${t('untitled')}`; });
      return d;
    });
    const full = arr.length >= (f.max || 50);
    wrap.replaceChildren(...cards, !full && h('button', { type: 'button', class: 'btn', onclick: () => {
      arr.push(blankItem(f.fields)); saveDraft(); draw(arr.length - 1);
      wrap.querySelector('details[open]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } }, '+ ', tl(f.addLabel) || t('add')));
  };
  draw(openIndex);
  return wrap;
}

// ---------- Photos: resize on the phone (fast upload, light website) ----------
async function resizePhoto(file) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w0 = src.width, h0 = src.height;
  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', JPEG_QUALITY);
}

// ---------- Check, preview, publish ----------
function check() {
  try { return validateContent(S.schema, S.draft, { allowUploads: true }); }
  catch (e) {
    if (!(e instanceof ContentError)) throw e;
    const [secKey, ...rest] = e.path.split('.');
    const sec = S.schema.sections.find(s => s.key === secKey);
    let field = sec && sec.fields ? sec.fields.find(f => f.key === (rest[0] || '').replace(/\[.*$/, '')) : null;
    alertBox(`${t('checkField')} ${tl(sec?.label)}${field ? ' → ' + tl(field.label) : ''}: ${t('errs')[e.code] || e.code}`);
    return null;
  }
}

function preview() {
  const content = check(); if (!content) return;
  const html = renderSite(S.cfg, content, { preview: true, resolveImage })
    .replace('<head>', `<head><base href="${ROOT.href}">`);
  const frame = h('iframe', { title: t('preview'), sandbox: 'allow-scripts', srcdoc: html });
  const back = () => { view.remove(); };
  const view = h('div', { class: 'preview' },
    h('header', { class: 'top' }, h('button', { onclick: back }, '←'), h('h1', {}, t('preview'))),
    frame,
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: back }, t('backEdit')),
      h('button', { class: 'btn btn-go', onclick: async () => { if (await publish()) back(); } }, '✓ ', t('publish'))));
  document.body.append(view);
}

async function publish() {
  const content = check(); if (!content) return false;
  if (!dirty()) { await alertBox(t('nothing')); return false; }
  if (!(await confirmBox(t('publishQ')))) return false;
  if (S.demo) { await alertBox(t('demo')); return false; }
  // Only send the photos that are still used.
  const used = JSON.stringify(content).match(/upload:[a-z0-9]+/g) || [];
  const uploads = [...new Set(used)].map(u => u.slice(7)).filter(id => S.uploads[id])
    .map(id => ({ id, data: S.uploads[id].dataUrl.split(',')[1], type: 'image/jpeg' }));
  const done = busy(t('publishing'));
  try {
    const r = await api('/publish', { client: S.cfg.clientId, baseSha: S.sha, content, uploads });
    done();
    S.saved = validateContent(S.schema, r.content); S.sha = r.sha; S.draft = clone(S.saved); S.uploads = {};
    store.del(draftKey());
    await alertBox(t('done'), 'btn-go');
    home();
    return true;
  } catch (err) {
    done();
    if (err.status === 401) { store.del(tokenKey()); S.token = null; await alertBox(t('session')); loginScreen(); return false; }
    if (err.code === 'conflict') { await alertBox(t('conflict')); store.del(draftKey()); loadContent(); return false; }
    await alertBox(err.code === 'offline' ? t('offline') : err.code === 'disabled' ? t('disabled') : t('error'));
    return false;
  }
}

boot();
