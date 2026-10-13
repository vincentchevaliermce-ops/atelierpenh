// Turns site.config.json + content/site.json into the public page.
// Used by build.js (Node, real site) and by the editor (browser, preview),
// so the preview is always exactly what gets published.
// All client text is escaped: content can never break the layout.

const T = {
  en: {
    menu: 'Menu', photos: 'Photos', hours: 'Opening hours', contact: 'Contact', about: 'About us',
    call: 'Call', whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'Email', directions: 'Directions',
    closed: 'Closed', today: 'Today', follow: 'Follow us', skip: 'Skip to content', madeBy: 'Website by',
    days: { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
  },
  fr: {
    menu: 'Carte', photos: 'Photos', hours: 'Horaires', contact: 'Contact', about: 'À propos',
    call: 'Appeler', whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'E-mail', directions: 'Itinéraire',
    closed: 'Fermé', today: "Aujourd'hui", follow: 'Suivez-nous', skip: 'Aller au contenu', madeBy: 'Site réalisé par',
    days: { mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche' }
  }
};
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SCHEMA_DAYS = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const paras = s => String(s || '').split(/\n{2,}/).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const lines = s => esc(s).replace(/\n/g, '<br>');
const digits = s => String(s || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
const color = (v, d) => /^#[0-9a-f]{3,8}$/i.test(v || '') ? v : d;
const absUrl = (base, p) => { try { return new URL(p, base).href; } catch { return p; } };

function jsonLd(cfg, c, base) {
  const b = c.business, ct = c.contact;
  const data = {
    '@context': 'https://schema.org',
    '@type': cfg.businessType || 'LocalBusiness',
    '@id': base + '#business',
    name: b.name,
    url: base,
    description: b.seoDescription || b.tagline || undefined,
    image: b.heroImage ? absUrl(base, b.heroImage) : undefined,
    telephone: ct.phone || undefined,
    email: ct.email || undefined,
    priceRange: cfg.priceRange || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ct.address ? ct.address.replace(/\n/g, ', ') : undefined,
      addressLocality: cfg.city || 'Phnom Penh',
      addressCountry: cfg.country || 'KH'
    },
    hasMap: ct.mapLink || undefined,
    openingHoursSpecification: DAYS.filter(d => !c.hours[d].closed).map(d => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAYS[d], opens: c.hours[d].open, closes: c.hours[d].close
    })),
    sameAs: Object.values(c.social).filter(Boolean)
  };
  if (/Restaurant|Cafe|Bar|Bakery|FoodEstablishment/i.test(data['@type']) && c.menu.categories.length) data.hasMenu = base + '#menu';
  if (!data.sameAs.length) delete data.sameAs;
  // "</" inside JSON could close the script tag: escape it.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const ICONS = {
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
  chat: '<path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.2-1.3A10 10 0 1 0 12 2z"/>',
  send: '<path d="M2 11l19-8-6 19-3.5-7.5z"/>',
  pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
  mail: '<path d="M3 5h18v14H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="2"/>'
};
const icon = n => `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${ICONS[n]}</svg>`;

/**
 * @param {object} cfg      site.config.json
 * @param {object} c        validated content
 * @param {object} [opts]   { preview: bool, resolveImage: fn(path) -> url }
 */
export function renderSite(cfg, c, opts = {}) {
  const lang = cfg.language === 'fr' ? 'fr' : 'en';
  const t = T[lang];
  const base = cfg.siteUrl || '/';
  const img = p => (opts.resolveImage ? opts.resolveImage(p) : p) || '';
  const b = c.business, ct = c.contact, th = cfg.theme || {};
  const title = b.tagline ? `${b.name} · ${b.tagline}` : b.name;
  const desc = b.seoDescription || b.tagline || '';
  const wa = digits(ct.whatsapp);
  const tg = String(ct.telegram || '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');

  const actions = [
    ct.phone && `<a class="btn" href="tel:${esc(ct.phone.replace(/[^\d+]/g, ''))}">${icon('phone')}${t.call}</a>`,
    wa && `<a class="btn" href="https://wa.me/${wa}" rel="noopener">${icon('chat')}${t.whatsapp}</a>`,
    tg && `<a class="btn" href="https://t.me/${tg}" rel="noopener">${icon('send')}${t.telegram}</a>`,
    ct.mapLink && `<a class="btn btn-ghost" href="${esc(ct.mapLink)}" rel="noopener">${icon('pin')}${t.directions}</a>`
  ].filter(Boolean).join('');

  const nav = [
    b.about && `<a href="#about">${t.about}</a>`,
    c.menu.categories.length && `<a href="#menu">${esc(c.menu.title || t.menu)}</a>`,
    c.gallery.length && `<a href="#photos">${t.photos}</a>`,
    `<a href="#hours">${t.hours}</a>`,
    `<a href="#contact">${t.contact}</a>`
  ].filter(Boolean).join('');

  const menu = c.menu.categories.length ? `
<section id="menu" class="section">
  <h2>${esc(c.menu.title || t.menu)}</h2>
  ${c.menu.note ? `<p class="note">${esc(c.menu.note)}</p>` : ''}
  <div class="menu">
  ${c.menu.categories.map(cat => `
    <div class="menu-cat">
      ${cat.name ? `<h3>${esc(cat.name)}</h3>` : ''}
      <ul>${cat.items.filter(i => i.name).map(i => `
        <li><div class="mi-head"><span class="mi-name">${esc(i.name)}</span><span class="mi-dots" aria-hidden="true"></span>${i.price ? `<span class="mi-price">${esc(i.price)}</span>` : ''}</div>${i.description ? `<p>${esc(i.description)}</p>` : ''}</li>`).join('')}
      </ul>
    </div>`).join('')}
  </div>
</section>` : '';

  const photos = c.gallery.filter(g => g.image);
  const gallery = photos.length ? `
<section id="photos" class="section">
  <h2>${t.photos}</h2>
  <ul class="gallery">${photos.map(g => `
    <li><figure><img src="${esc(img(g.image))}" alt="${esc(g.caption)}" loading="lazy" decoding="async" width="600" height="450">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure></li>`).join('')}
  </ul>
</section>` : '';

  const hours = `
<section id="hours" class="section">
  <h2>${t.hours}</h2>
  <table class="hours">
    <tbody>${DAYS.map(d => { const h = c.hours[d]; return `
      <tr data-day="${d}"><th scope="row">${t.days[d]}</th><td>${h.closed ? t.closed : `${esc(h.open)} – ${esc(h.close)}`}</td></tr>`; }).join('')}
    </tbody>
  </table>
  ${c.hours.note ? `<p class="note">${esc(c.hours.note)}</p>` : ''}
</section>`;

  const socialNames = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', google: 'Google' };
  const social = Object.entries(c.social).filter(([, v]) => v);
  const contact = `
<section id="contact" class="section">
  <h2>${t.contact}</h2>
  ${ct.address ? `<address>${lines(ct.address)}</address>` : ''}
  <div class="actions">${actions}${ct.email ? `<a class="btn btn-ghost" href="mailto:${esc(ct.email)}">${icon('mail')}${t.email}</a>` : ''}</div>
  ${social.length ? `<h3>${t.follow}</h3><ul class="social">${social.map(([k, v]) => `<li><a href="${esc(v)}" rel="noopener">${socialNames[k] || esc(k)}</a></li>`).join('')}</ul>` : ''}
</section>`;

  const previewScript = opts.preview ? `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;e.preventDefault();var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){var el=document.querySelector(h);if(el)el.scrollIntoView({behavior:'smooth'});}});</script>` : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(base)}">
<meta name="theme-color" content="${esc(color(th.accent, '#A8481F'))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(b.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(base)}">
${b.heroImage ? `<meta property="og:image" content="${esc(absUrl(base, b.heroImage))}">` : ''}
<meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
${b.heroImage ? `<link rel="preload" as="image" href="${esc(img(b.heroImage))}">` : ''}
<link rel="stylesheet" href="assets/style.css">
<style>:root{--accent:${color(th.accent, '#A8481F')};--bg:${color(th.background, '#FBF7F2')};--text:${color(th.text, '#1F1A17')};--muted:${color(th.muted, '#5E544D')}}</style>
<script type="application/ld+json">${jsonLd(cfg, c, base)}</script>
</head>
<body>
<a class="skip" href="#main">${t.skip}</a>
<header class="hero">
  ${b.heroImage ? `<img class="hero-img" src="${esc(img(b.heroImage))}" alt="${esc(b.heroAlt)}" fetchpriority="high" decoding="async" width="1600" height="1000">` : ''}
  <div class="hero-inner">
    <h1>${esc(b.name)}</h1>
    ${b.tagline ? `<p class="tagline">${esc(b.tagline)}</p>` : ''}
    <div class="actions">${actions}</div>
  </div>
</header>
<nav class="nav" aria-label="${t.menu}">${nav}</nav>
<main id="main">
${b.about ? `<section id="about" class="section"><h2>${t.about}</h2>${paras(b.about)}</section>` : ''}
${menu}
${gallery}
${hours}
${contact}
</main>
<footer class="footer">
  <p>© ${new Date().getFullYear()} ${esc(b.name)}</p>
  ${cfg.credit !== false ? `<p>${t.madeBy} <a href="https://atelierpenh.com/">Atelier Penh</a></p>` : ''}
</footer>
${wa ? `<a class="fab" href="https://wa.me/${wa}" rel="noopener" aria-label="${t.whatsapp}">${icon('chat')}</a>` : ''}
<script src="assets/site.js" defer></script>
${previewScript}
</body>
</html>
`;
}
