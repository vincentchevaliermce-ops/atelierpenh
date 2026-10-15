/* Atelier Penh · page d'accueil v3 (rue 3D + galerie 3D) */
(function () {
  'use strict';
  var AP = window.AP || {}, L = AP.L || {}, d = document, html = d.documentElement;
  var $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || d).querySelectorAll(s)); };
  var lite = html.classList.contains('lite');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var mobile = innerWidth < 760;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function secProg(el) { var r = el.getBoundingClientRect(), h = r.height - innerHeight; return h > 0 ? clamp(-r.top / h, 0, 1) : 0; }
  /* ---------- mesure d'audience : AP.track(nom, props) vers Umami, GoatCounter ou Plausible s'ils sont chargés, sinon rien ---------- */
  AP.track = function (name, props) {
    props = props || {}; var tries = 0;
    try { (window.APEvents = window.APEvents || []).push([name, props]); if (window.APEvents.length > 200) window.APEvents.shift(); } catch (_) { }
    (function send() {
      try {
        if (window.umami && typeof window.umami.track === 'function') { window.umami.track(name, props); return; }
        if (window.goatcounter && typeof window.goatcounter.count === 'function') {
          var vals = []; for (var k in props) if (props[k] !== '' && props[k] != null) vals.push(String(props[k]).replace(/[\s/?#&]+/g, '_').slice(0, 40));
          window.goatcounter.count({ path: [name].concat(vals).join('-'), title: name, event: true }); return;
        }
        if (typeof window.plausible === 'function') { window.plausible(name, { props: props }); return; }
      } catch (_) { return; }
      if (AP.an && ++tries < 4) setTimeout(send, 1500); /* le script d'audience n'est pas encore chargé */
    })();
  };
  /* départ vers une autre page (langue, mode) : on laisse 180 ms à l'envoi si une mesure est active */
  function leaveAfter(fn) { if (AP.an) setTimeout(fn, 180); else fn(); }
  function toast(t) { var e = $('#toast'); if (!e) { e = d.createElement('div'); e.id = 'toast'; e.className = 'toast'; e.setAttribute('role', 'status'); d.body.appendChild(e); } e.textContent = t; e.classList.add('on'); clearTimeout(e._h); e._h = setTimeout(function () { e.classList.remove('on'); }, 4200); }

  /* ---------- défilement doux ---------- */
  var lenis = null;
  if (window.Lenis && !reduce && fine) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
    window.__lenis = lenis;
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    $$('a[href^="#"]').forEach(function (a) { a.addEventListener('click', function (e) { var id = a.getAttribute('href'); if (id.length < 2) return; var t = $(id); if (!t) return; e.preventDefault(); lenis.scrollTo(t, { offset: id === '#work' ? 0 : -70, duration: 1.6 }); }); });
  }
  function scrollToY(y) { if (lenis) lenis.scrollTo(y, { duration: 1.1 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); }

  /* ---------- texte : mots qui montent ---------- */
  $$('.split').forEach(function (el) {
    var walk = function (node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (w) { if (!w) return; if (/^\s+$/.test(w)) { frag.appendChild(d.createTextNode(w)); return; } var o = d.createElement('span'); o.className = 'w'; var i = d.createElement('span'); i.textContent = w; o.appendChild(i); frag.appendChild(o); });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    $$('.w>span', el).forEach(function (s, i) { s.style.transitionDelay = (i * 0.045) + 's'; });
  });
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
  $$('.rv,.split').forEach(function (e) { io.observe(e); });

  /* ---------- lueur qui suit la souris (boutons, cartes) ---------- */
  if (fine) d.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('.btn,.plan'); if (!t) return;
    var r = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ---------- écran de chargement : vraie progression (polices, page, paquet 3D, rue prête), 4 s maximum ---------- */
  var intro = $('#intro'), introDone = false, iBar = $('#iBar'), iPc = $('#iPc'), iSt = $('#iSt');
  var introOn = !!intro && !html.classList.contains('seen') && !reduce;
  var LW = lite ? { f: .4, l: .6 } : { f: .1, l: .2, b: .5, i: .2 }, LP = { f: 0, l: 0, b: 0, i: 0 }, lpShown = 0, lpRaf = 0;
  function lpDraw(v) { if (iBar) iBar.style.transform = 'scaleX(' + v.toFixed(4) + ')'; if (iPc) iPc.textContent = Math.round(v * 100) + '%'; }
  function lpTarget() { var t = 0; for (var k in LW) t += LW[k] * LP[k]; return t; }
  function lpTick() {
    lpRaf = 0; if (introDone) return;
    var t = lpTarget(); lpShown = Math.min(t, lpShown + Math.max((t - lpShown) * .09, .003)); lpDraw(lpShown);
    if (t >= .999 && lpShown >= .998) { setTimeout(endIntro, 280); return; }
    if (lpShown < t) lpRaf = requestAnimationFrame(lpTick);
  }
  function lp(k, v) {
    if (!introOn || introDone) return;
    LP[k] = Math.max(LP[k] || 0, clamp(v, 0, 1));
    if (k === 'b' && LP.b >= 1 && iSt && iSt.dataset.s2) iSt.textContent = iSt.dataset.s2;
    if (!lpRaf) lpRaf = requestAnimationFrame(lpTick);
  }
  function lpAll() { for (var k in LW) LP[k] = 1; if (!lpRaf && introOn && !introDone) lpRaf = requestAnimationFrame(lpTick); }
  function endIntro() {
    if (introDone) return; introDone = true; html.classList.add('revealed');
    if (!intro) return;
    lpDraw(1); intro.classList.add('out'); try { sessionStorage.setItem('ap-intro', '1'); } catch (_) { }
    setTimeout(function () { intro.style.display = 'none'; }, 1300);
    setTimeout(function () { if (typeof fabUpd === 'function') fabUpd(); }, 900);
  }
  if (introOn) {
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { lp('f', 1); }, function () { lp('f', 1); }); else lp('f', 1);
    if (d.readyState === 'complete') lp('l', 1); else addEventListener('load', function () { lp('l', 1); });
    /* jamais plus de ~4 s (2 s en mode léger) : les posters prennent le relais */
    setTimeout(endIntro, Math.max(600, (lite ? 2200 : 4000) - performance.now()));
  } else endIntro();

  /* ---------- son ---------- */
  var SND = window.APSound, sndBtn = $('#sndBtn'), sndWant = false;
  try { sndWant = localStorage.getItem('ap-sound') === 'on'; } catch (_) { }
  function sndSet(onv) {
    if (!SND) return; sndBtn.setAttribute('aria-pressed', String(onv)); sndBtn.setAttribute('aria-label', onv ? AP.sndOff : AP.sndOn);
    if (onv) SND.enable(); else SND.disable();
    try { localStorage.setItem('ap-sound', onv ? 'on' : 'off'); } catch (_) { }
  }
  if (sndBtn) sndBtn.addEventListener('click', function () { sndSet(!(SND && SND.enabled())); if (SND && SND.enabled()) { toast(AP.sndOn); AP.track('sound_on'); } });
  if (sndWant) { var once = function () { sndSet(true); d.removeEventListener('pointerdown', once); d.removeEventListener('keydown', once); }; d.addEventListener('pointerdown', once); d.addEventListener('keydown', once); }
  function sndEvent(type, v) {
    if (!SND || !SND.enabled()) return;
    if (type === 'shutter') SND.shutter(v.pan); else if (type === 'pop') SND.pop(); else if (type === 'pin') SND.chime(v); else if (type === 'cats') SND.cats(v); else if (type === 'horn') SND.horn(v); else if (type === 'splash') SND.splash(v); else if (type === 'moto') SND.moto(v); else if (type === 'tuktuk') SND.tuktuk(v); else if (type === 'bark') SND.bark(v); else if (type === 'wa') SND.wa(); else if (type === 'named') SND.chime(4);
  }

  /* ---------- votre nom : néon dans la rue + « Et votre commerce ? » (aperçu du site en direct) ---------- */
  var Y = AP.Y || {}, TR = Y.tr || {};
  /* photo de héros par métier : une maquette existante (960×600), recadrée sur sa seule photo [image, x0, y0, x1, y1] */
  var TIMG = { restaurant: [24, 560, 60, 960, 325], cafe: [19, 560, 110, 840, 395], spa: [9, 640, 240, 845, 500], boutique: [13, 640, 190, 860, 465], hotel: [17, 570, 170, 800, 440] };
  function crop(r, a) {
    var rw = r[3] - r[1], rh = r[4] - r[2], ww = rw / rh > a ? rh * a : rw, wh = ww / a, wx = (r[1] + r[3]) / 2 - ww / 2, wy = (r[2] + r[4]) / 2 - wh / 2;
    return 'width:' + (960 / ww * 100).toFixed(2) + '%;left:' + (-wx / ww * 100).toFixed(2) + '%;top:' + (-wy / wh * 100).toFixed(2) + '%';
  }
  var shop = { name: '', trade: 'restaurant', touched: false };
  var tryName = $('#tryName'), tryOk = $('#tryOk'), neon2d = $('#neon2d'), tryT = 0, pingT = 0;
  var yName = $('#yName'), yStage = $('#yStage'), ySL = $('#ySiteL'), ySM = $('#ySiteM'), yNotif = $('#yNotif'), yWa = $('#yWa'), yWaT = $('#yWaT'), yTg = $('#yTg'), yUrl = $('#yUrl'), yNh = $('#yNh'), yNb = $('#yNb'), yStreet = $('#yStreet'), yCta = $('#yCta');
  var waSvg = ($('.waic') || {}).outerHTML || '';
  function R(u) { return window.__R ? window.__R(u) : u; }
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tc() { return TR[shop.trade] || TR.restaurant || {}; }
  function shopName() { return shop.name || tc().sample || ''; }
  function slug(n) { n = n.normalize ? n.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : n; return (n.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourshop').slice(0, 24) + '.com'; }
  function siteHTML(m) {
    var c = tc(), im = TIMG[shop.trade] || TIMG.restaurant, n = esc(shopName());
    var items = (c.items || []).map(function (it) { return '<li><span>' + esc(it[0]) + '</span><i></i><b>' + esc(it[1]) + '</b></li>'; }).join('');
    return '<div class="ys-nav"><b class="ys-logo ys-n">' + n + '</b><span class="ys-links">' + (c.links || []).map(function (l) { return '<i>' + esc(l) + '</i>'; }).join('') + '</span><span class="ys-pill">' + esc(c.b1) + '</span><span class="ys-burger"><i></i><i></i></span></div>' +
      '<div class="ys-hero"><div class="ys-txt"><small>' + esc(c.kicker) + '</small><h4 class="ys-n">' + n + '</h4><p class="ys-tag">' + esc(c.h1) + ' <em>' + esc(c.h2) + '</em></p><p class="ys-sub">' + esc(c.sub) + '</p><div class="ys-btns"><span class="b1">' + esc(c.b1) + '</span><span class="b2">' + esc(c.b2) + '</span></div></div>' +
      '<div class="ys-img"><img alt="" decoding="async" src="' + R('/img/work-' + pad(im[0]) + '.jpg') + '" style="' + crop(im, m ? 1 / .82 : 4 / 4.3) + '"></div></div>' +
      '<div class="ys-sec"><h5>' + esc(c.sec) + '</h5><ul>' + items + '</ul></div>' + (m ? '<span class="ys-fab">' + waSvg + '</span>' : '');
  }
  function waMsg() {
    var c = tc();
    if (shop.name) return Y.msg.replace('{n}', shop.name).replace('{t}', String(c.label || '').toLowerCase());
    return shop.touched ? Y.msg0.replace('{t}', c.word || '') : Y.fab_msg;
  }
  function waHref() { return 'https://wa.me/' + AP.wa + '?text=' + encodeURIComponent(waMsg()); }
  function nameUpd() {
    var n = shopName();
    if (yStage) {
      $$('.ys-n', yStage).forEach(function (e) { e.textContent = n; });
      yStage.classList.toggle('typed', !!shop.name); yStage.dataset.len = n.length > 15 ? 'l' : n.length > 10 ? 'm' : 's'; yStage.setAttribute('aria-label', (Y.aria || '').replace('{n}', n));
      yUrl.textContent = slug(n);
      yWaT.textContent = shop.name ? Y.cta.replace('{n}', shop.name) : Y.cta0;
      yWa.href = waHref();
    }
    var fab = $('#fab'); if (fab) fab.href = waHref();
    contactUpd();
  }
  function renderSites() { if (!ySL) return; ySL.innerHTML = siteHTML(false); ySM.innerHTML = siteHTML(true); ySL.dataset.tr = ySM.dataset.tr = shop.trade; nameUpd(); }
  function ping(delay) {
    if (!yNotif) return; clearTimeout(pingT);
    pingT = setTimeout(function () {
      var c = tc(); yNh.textContent = (c.nh || '').replace('{n}', shopName()); yNb.textContent = c.nb || '';
      yNotif.classList.remove('in'); void yNotif.offsetWidth; yNotif.classList.add('in');
      var f = $('.ys-fab', ySM); if (f) { f.classList.remove('buzz'); void f.offsetWidth; f.classList.add('buzz'); }
      if (SND && SND.enabled() && yInView) SND.wa();
    }, delay == null ? 700 : delay);
  }
  function applyName() {
    var v = shop.name;
    if (streetApi && streetApi.setName) streetApi.setName(v, shop.trade);
    else if (neon2d) { neon2d.textContent = v; neon2d.classList.toggle('on', !!v); }
    if (tryOk) tryOk.hidden = !v;
    if (yStreet) yStreet.hidden = !(v && streetApi);
  }
  var nameTracked = false;
  function setName(v, src) {
    shop.name = String(v || '').trim().slice(0, 22); if (shop.name) shop.touched = true;
    if (tryName && src !== tryName && tryName.value !== v) tryName.value = v;
    if (yName && src !== yName && yName.value !== v) yName.value = v;
    var kb = $('#f-biz'); if (kb && src !== kb && kb.value !== v) kb.value = v;
    if (shop.name && !nameTracked && src) { nameTracked = true; AP.track('module_name_typed', { where: src === tryName ? 'street' : src === yName ? 'module' : 'contact' }); }
    nameUpd(); clearTimeout(tryT); tryT = setTimeout(applyName, 450);
    if (shop.name) ping(900);
  }
  function setTrade(tr, src) {
    if (!TR[tr] || tr === shop.trade && src) { return; }
    shop.trade = tr; shop.touched = true;
    if (src) AP.track('module_trade', { trade: tr, where: src.closest && src.closest('.tryname') ? 'street' : 'module' });
    $$('.tchips button').forEach(function (x) { x.setAttribute('aria-checked', String(x.dataset.tr === tr)); });
    $$('input[name=ytrade]').forEach(function (x) { x.checked = x.value === tr; });
    if (yStage && !reduce) { yStage.classList.add('sw'); setTimeout(function () { renderSites(); yStage.classList.remove('sw'); }, 220); } else renderSites();
    if (shop.name) applyName();
    ping(650);
  }
  if (tryName) {
    tryName.addEventListener('input', function () { setName(tryName.value, tryName); });
    $$('.tchips button').forEach(function (b, i, all) {
      b.addEventListener('click', function () { setTrade(b.dataset.tr, b); });
      b.addEventListener('keydown', function (e) { var k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!k) return; e.preventDefault(); var nb = all[(i + k + all.length) % all.length]; nb.focus(); setTrade(nb.dataset.tr, nb); });
    });
  }
  if (yName) {
    yName.addEventListener('input', function () { setName(yName.value, yName); });
    yName.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); yWa.click(); } });
    $$('input[name=ytrade]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setTrade(r.value, r); }); });
    yTg.addEventListener('click', function () { var m = waMsg(); try { navigator.clipboard.writeText(m).then(function () { toast(Y.copied || L.copied); }, function () { }); } catch (_) { } });
    renderSites();
    var yInView = false, yPinged = false;
    var yio = new IntersectionObserver(function (es) { es.forEach(function (e) { yInView = e.isIntersecting; if (yInView && !yPinged) { yPinged = true; ping(900); } }); }, { threshold: .35 });
    yio.observe(yStage);
    /* précharge les 5 photos quand on approche */
    var ypre = new IntersectionObserver(function (es) { if (!es[0].isIntersecting) return; ypre.disconnect(); Object.keys(TIMG).forEach(function (k) { var i = new Image(); i.src = R('/img/work-' + pad(TIMG[k][0]) + '.jpg'); }); }, { rootMargin: '900px 0px' });
    ypre.observe(yStage);
  }

  /* ---------- avant / après ---------- */
  var baw = $('#baw'), baR = $('#baRange');
  if (baw && baR) {
    baR.addEventListener('input', function () { baw.style.setProperty('--x', baR.value + '%'); });
    var baIO = new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting || reduce) return; baIO.unobserve(baw); var t0 = performance.now(); (function an(n) { var k = clamp((n - t0) / 2200, 0, 1), v = 50 + Math.sin(k * Math.PI * 2) * 28 * (1 - k); baw.style.setProperty('--x', v + '%'); baR.value = v; if (k < 1) requestAnimationFrame(an); })(t0); }); }, { threshold: .5 });
    baIO.observe(baw);
  }

  /* ---------- grand mot qui respire avec la souris ---------- */
  var big = $('#bigWord');
  if (big && fine) d.querySelector('footer').addEventListener('pointermove', function (e) { var k = e.clientX / innerWidth; big.style.fontVariationSettings = '"wdth" ' + (75 + k * 25).toFixed(1) + ',"wght" ' + (500 + (1 - Math.abs(k - .5) * 2) * 300).toFixed(0); });

  /* ---------- heure de Phnom Penh : nuit, coucher de soleil, jour ---------- */
  var clk = $('#ppClock'), ppT = $('#ppTime'), ppI = $('#ppIcon'), modeIdx = -1, MODES = [['n', 0, 0, '☾'], ['d', 0, 1, '◐'], ['y', 1, 0, '☀']];
  function ppHour() { try { var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()), o = {}; p.forEach(function (x) { o[x.type] = x.value; }); return [+o.hour, +o.minute]; } catch (e) { var n = new Date(); return [n.getHours(), n.getMinutes()]; } }
  function autoMode() { var h = ppHour(), x = h[0] + h[1] / 60; return (x >= 19 || x < 5.5) ? 0 : (x >= 17 || x < 6.5) ? 1 : 2; }
  function applyMode(i, snap) { var m = MODES[i]; if (streetApi && streetApi.setTime) streetApi.setTime(m[1], m[2], snap); if (ppI) ppI.textContent = m[3]; clkUpd(); }
  function clkUpd() { if (!ppT) return; var h = ppHour(), m = MODES[modeIdx < 0 ? autoMode() : modeIdx]; ppT.textContent = 'Phnom Penh · ' + (h[0] < 10 ? '0' : '') + h[0] + ':' + (h[1] < 10 ? '0' : '') + h[1] + ' · ' + clk.dataset[m[0]]; }
  if (clk) { clk.addEventListener('click', function () { modeIdx = ((modeIdx < 0 ? autoMode() : modeIdx) + 1) % 3; applyMode(modeIdx); }); clkUpd(); setInterval(clkUpd, 30000); }

  /* ---------- rideaux de fer entre les sections ---------- */
  var shutters = $$('.shutter');
  function shutUpd() {
    shutters.forEach(function (sh) {
      if (sh.classList.contains('done')) return;
      var r = sh.parentNode.getBoundingClientRect(), k = clamp((innerHeight * .95 - r.top) / (innerHeight * .6), 0, 1);
      sh.style.setProperty('--s', (1 - k).toFixed(3));
      if (k > .02 && !sh._snd) { sh._snd = 1; if (SND && SND.enabled()) SND.shutter(0); }
      if (k >= 1) sh.classList.add('done');
    });
  }

  /* ---------- mode démo (#demo) : visite automatique, idéale en rendez-vous ---------- */
  var demoOn = /demo/.test(location.hash), demoStop = false;
  function tweenTo(y, dur, cb) {
    if (demoStop) return;
    if (lenis) { lenis.scrollTo(y, { duration: dur / 1000, easing: function (x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }, lock: false, onComplete: function () { if (cb) setTimeout(cb, 10); } }); return; }
    var y0 = scrollY, t0 = performance.now();
    (function st(n) { if (demoStop) return; var k = clamp((n - t0) / dur, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + (y - y0) * e); if (k < 1) requestAnimationFrame(st); else if (cb) cb(); })(t0);
  }
  function typeName(txt, cb) { var i = 0; tryName.value = ''; (function ty() { if (demoStop) return; tryName.value = txt.slice(0, ++i); tryName.dispatchEvent(new Event('input')); if (i < txt.length) setTimeout(ty, 140); else if (cb) setTimeout(cb, 2600); })(); }
  function runDemo() {
    var top = function (sel) { var e = $(sel); return e ? e.getBoundingClientRect().top + scrollY : 0; };
    var stEnd = top('#street') + street.offsetHeight - innerHeight, gEnd = top('#work') + gal.offsetHeight - innerHeight;
    var steps = [
      function (n) { if (tryName && innerWidth > 900) typeName(AP.lang === 'fr' ? 'Café Lotus' : 'Lotus Café', function () { tryName.value = ''; tryName.dispatchEvent(new Event('input')); setTimeout(n, 900); }); else setTimeout(n, 1500); },
      function (n) { tweenTo(stEnd, 58000, function () { setTimeout(n, 2500); }); },
      function (n) { tweenTo(gEnd, 24000, function () { setTimeout(n, 1500); }); },
      function (n) { tweenTo(top('#client') - 10, 3500, function () { setTimeout(n, 3000); }); },
      function (n) { tweenTo(top('#method') - 10, 3500, function () { setTimeout(n, 2500); }); },
      function (n) { tweenTo(top('#pricing') - 10, 3500, function () { setTimeout(n, 3500); }); },
      function (n) { tweenTo(top('#contact') - 10, 4000, function () { setTimeout(n, 3000); }); },
      function (n) { tweenTo(document.documentElement.scrollHeight - innerHeight, 3500, n); }
    ];
    var i = 0; (function next() { if (demoStop || i >= steps.length) return; steps[i++](next); })();
  }
  if (demoOn) {
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { addEventListener(ev, function () { demoStop = true; }, { passive: true, once: true }); });
    scrollTo(0, 0); setTimeout(runDemo, 3400);
  }

  /* ---------- navigation ---------- */
  var nav = $('#nav'), paperSecs = $$('.paper-sec'), navS = null, navP = null;
  function navUpd() {
    var y = 36, onPaper = paperSecs.some(function (s) { var r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
    var sol = scrollY > 40; if (sol !== navS) { navS = sol; nav.classList.toggle('solid', sol); }
    if (onPaper !== navP) { navP = onPaper; nav.classList.toggle('paper', onPaper); }
  }

  /* ---------- rue ---------- */
  var street = $('#street'), beats = $$('.beat'), bar = $('#bar'), hint = $('#hint'), posters = $$('.poster', street);
  var streetApi = null, streetVisible = true;
  function loadPosters() { $$('[data-srcset]', street).forEach(function (s) { s.srcset = s.getAttribute('data-srcset'); s.removeAttribute('data-srcset'); }); $$('img[data-src]', street).forEach(function (i) { i.src = i.getAttribute('data-src'); i.removeAttribute('data-src'); }); }
  var lastSP = -1;
  function streetUpd() {
    var p = secProg(street);
    if (p === lastSP && (p === 0 || p === 1)) return; lastSP = p; // hors de la rue : rien à réécrire
    bar.style.transform = 'scaleX(' + p + ')';
    hint.style.opacity = p > .02 ? 0 : 1;
    beats.forEach(function (b, i) {
      var a = +b.dataset.a, z = +b.dataset.b, k;
      if (i === 0) k = 1 - sstep(z - .05, z, p);
      else k = sstep(a, a + .05, p) * (1 - sstep(z - .05, z, p));
      if (z > 1) k = sstep(a, a + .05, p);
      b.style.opacity = k; b.style.transform = 'translateY(' + ((1 - k) * (p < a + .05 ? 30 : -30)) + 'px)';
      b.classList.toggle('on', k > .5);
    });
    street.classList.toggle('past1', p > .1);
    if (streetApi) streetApi.setProgress(p);
    else if (seq && seq.ready) seq.set(p);
    else if (posters.length === 3) {
      posters[1].style.opacity = sstep(.3, .42, p) * (1 - sstep(.72, .82, p));
      posters[2].style.opacity = sstep(.72, .82, p);
    }
  }

  /* ---------- mode cinéma (téléphones, mode léger) : le parcours 3D pré-calculé, image par image, piloté par le défilement ---------- */
  var seq = null;
  function startSeq() {
    if (seq || !lite) return;
    try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) { }
    if (window.__IMG && !window.__IMG['/img/seq/m/f0000.webp']) return; // démo hors ligne : posters seulement
    var stage = $('.stage', street); if (!stage) return;
    var N = 120, dir = "/img/seq/" + (innerWidth > innerHeight * 1.1 ? "d" : "m");
    var cv = document.createElement('canvas'), cx = cv.getContext('2d', { alpha: false }), cur = -1, want = 0, shown = 0, raf = 0, IW = 0, IH = 0;
    cv.className = 'seqcv'; cv.setAttribute('aria-hidden', 'true'); var pic = posters[posters.length - 1]; while (pic && pic.parentNode !== stage) pic = pic.parentNode; stage.insertBefore(cv, pic ? pic.nextSibling : stage.firstChild);
    /* Les images arrivent en blobs (compressés, légers en mémoire) et sont décodées hors du fil principal
       (createImageBitmap) : seules ~12 images décodées autour de la position sont gardées. Repli : <img>. */
    var BM = typeof createImageBitmap === 'function' && window.fetch && window.Blob;
    var src = new Array(N), dec = {}, pend = {};
    function frame(i) { return BM ? dec[i] : (src[i] && src[i].ok ? src[i] : null); }
    // canevas à la résolution des images : inutile de pousser plus de pixels que la source n'en a
    function size() { var r = stage.getBoundingClientRect(), k = IW ? Math.max(IW / r.width, IH / r.height) : 1, d = Math.max(1, Math.min(devicePixelRatio || 1, 2, k)); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); cur = -1; draw(); }
    function nearest(i) { for (var k = 0; k < N; k++) { if (frame(i - k)) return i - k; if (frame(i + k)) return i + k; } return -1; }
    function draw() {
      var i = nearest(Math.round(shown)); if (i < 0 || i === cur) return; cur = i;
      var im = frame(i), W = cv.width, H = cv.height, k = Math.max(W / IW, H / IH), w = IW * k, h = IH * k;
      cx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    }
    function ring() {
      if (!BM) return; var c = Math.round(shown), dirn = want >= shown ? 1 : -1;
      for (var k in dec) if (Math.abs(k - c) > 8) { try { dec[k].close(); } catch (e) { } delete dec[k]; }
      for (var j = -3; j <= 7; j++) decode(c + j * dirn);
    }
    function decode(i) {
      if (i < 0 || i >= N || !src[i] || dec[i] || pend[i]) return; pend[i] = 1;
      createImageBitmap(src[i]).then(function (b) {
        delete pend[i];
        if (i && Math.abs(i - Math.round(shown)) > 8) { try { b.close(); } catch (e) { } return; }
        dec[i] = b; if (!IW) { IW = b.width; IH = b.height; }
        if (i === 0 && !seq.ready) { seq.ready = true; street.classList.add('seqon'); size(); lastSP = -1; onScroll(); }
        if (Math.abs(i - shown) < 4) { cur = -1; draw(); }
      }, function () { delete pend[i]; });
    }
    function got(i) { if (Math.abs(i - Math.round(shown)) <= 8 || i === 0) decode(i); }
    function add(i, blob) {
      if (BM) { src[i] = blob; got(i); return; }
      var im = new Image(); im.decoding = 'async'; src[i] = im;
      im.onload = function () { im.ok = true; if (!IW) { IW = im.naturalWidth; IH = im.naturalHeight; } if (i === 0) { seq.ready = true; street.classList.add('seqon'); size(); lastSP = -1; onScroll(); } if (Math.abs(i - want) < 3) { cur = -1; draw(); } };
      im.src = URL.createObjectURL(blob);
    }
    // un paquet = plusieurs images : 'APSQ', n, n x (image, taille), puis les webp à la suite
    function unpack(buf) {
      var v = new DataView(buf), n = v.getUint32(4, true), off = 8 + n * 8;
      for (var k = 0; k < n; k++) { var i = v.getUint32(8 + k * 8, true), len = v.getUint32(12 + k * 8, true); add(i, new Blob([buf.slice(off, off + len)], { type: 'image/webp' })); off += len; }
    }
    function loop() { raf = 0; shown += (want - shown) * .35; if (Math.abs(want - shown) < .2) shown = want; ring(); draw(); if (shown !== want) raf = requestAnimationFrame(loop); }
    // chargement progressif en 4 paquets : une image sur 8, puis 4, 2, toutes (on s'arrête à 2 si la connexion est lente)
    var slow = false; try { var nc = navigator.connection; slow = !!nc && (/2g|3g/.test(nc.effectiveType || '') || (nc.downlink > 0 && nc.downlink < 1.5)); } catch (e) { }
    if (!window.fetch || !window.Blob || !window.DataView) return;
    (function next(k) {
      if (k > (slow ? 2 : 3)) return;
      fetch(dir + '-' + k + '.bin?v=' + (AP.ver || 1)).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (b) { unpack(b); setTimeout(function () { next(k + 1); }, 60); }, function () { });
    })(0);
    seq = { ready: false, set: function (p) { want = Math.max(0, Math.min(N - 1, p * (N - 1))); if (!raf) raf = requestAnimationFrame(loop); } };
    addEventListener('resize', function () { if (seq.ready) size(); }, { passive: true });
  }

  /* ---------- galerie ---------- */
  var gal = $('#work'), works = AP.works || [], galApi = null, gIdx = 0;
  var gCount = $('#gCount'), gName = $('#gName'), gLoc = $('#gLoc');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function setLabel(i) {
    gIdx = i; var w = works[i]; if (!w) return;
    gCount.innerHTML = pad(i + 1) + '<small>/ ' + works.length + '</small>';
    gName.textContent = w.t; gLoc.textContent = w.loc;
  }
  function galUpd() { if (galApi) galApi.setProgress(secProg(gal)); }
  function galGo(i) {
    i = clamp(i, 0, works.length - 1);
    var r = gal.getBoundingClientRect(), top = scrollY + r.top, h = r.height - innerHeight;
    scrollToY(top + h * (i / (works.length - 1)) + 2);
  }
  $('#gPrev').addEventListener('click', function () { galGo(gIdx - 1); });
  $('#gNext').addEventListener('click', function () { galGo(gIdx + 1); });
  $('#gPlay').addEventListener('click', function () { openLb(gIdx); });

  /* visionneuse */
  var lb = $('#lb'), lbV = $('#lbV'), lbT = $('#lbT');
  function openLb(i) {
    var w = works[i]; if (!w) return;
    lbV.src = w.v; lbT.textContent = pad(i + 1) + ' · ' + w.t + ' · ' + w.loc;
    AP.track('gallery_open', { preview: w.t, n: i + 1 });
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    var pr = lbV.play(); if (pr && pr.catch) pr.catch(function () { });
    if (lenis) lenis.stop();
  }
  function openVid(v, title) {
    AP.track('video_open', { preview: title || String(v).replace(/^.*\//, '') });
    lbV.src = window.__R ? window.__R(v.replace(/^img\//, '/img/')) : v; lbT.textContent = title + ' · ' + (AP.lang === 'fr' ? 'maquette Atelier Penh' : 'Atelier Penh preview');
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    var pr = lbV.play(); if (pr && pr.catch) pr.catch(function () { });
    if (lenis) lenis.stop();
  }
  function closeLb() { lbV.pause(); if (lb.close) lb.close(); else lb.removeAttribute('open'); if (lenis) lenis.start(); }
  $('#lbX').addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  lb.addEventListener('close', function () { lbV.pause(); if (lenis) lenis.start(); });
  $$('#rail figure').forEach(function (f) {
    var go = function () { openLb(+f.dataset.i); };
    f.addEventListener('click', go); f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  /* ---------- client : écran qui défile ---------- */
  var devices = $('#devices'), moana = $('#moanaLong'), caseSec = $('#client');
  function caseUpd() {
    if (!moana || !moana.naturalHeight) return;
    var r = caseSec.getBoundingClientRect(), k = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
    var scr = moana.parentNode, max = moana.clientHeight - scr.clientHeight;
    moana.style.setProperty('--sy', (-max * sstep(.2, .85, k)) + 'px');
    moana.style.transform = 'translateY(' + (-max * sstep(.2, .85, k)) + 'px)';
  }
  if (fine && devices) {
    devices.addEventListener('pointermove', function (e) { var r = devices.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; devices.style.setProperty('--ry', (x * 14 - 4) + 'deg'); devices.style.setProperty('--rx', (-y * 10 + 3) + 'deg'); });
    devices.addEventListener('pointerleave', function () { devices.style.removeProperty('--ry'); devices.style.removeProperty('--rx'); });
  }

  /* ---------- méthode : ligne qui avance ---------- */
  var steps = $('#steps'), stepEls = $$('.step');
  function stepsUpd() {
    var r = steps.getBoundingClientRect(), k = clamp((innerHeight * .8 - r.top) / (innerHeight * .6), 0, 1);
    steps.style.setProperty('--prog', k);
    stepEls.forEach(function (s, i) { s.classList.toggle('on', k >= i / stepEls.length + .02); });
  }

  /* ---------- prix qui défilent ---------- */
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      var el = e.target, raw = el.textContent, m = raw.match(/[\d][\d,  ]*/); if (!m || reduce) return;
      var num = parseInt(m[0].replace(/[^\d]/g, ''), 10), sep = (m[0].match(/[,  ]/) || [''])[0], t0 = performance.now(), dur = 1300;
      function fmt(v) { var s = String(v); if (sep && v >= 1000) s = s.slice(0, -3) + sep + s.slice(-3); return raw.replace(m[0].trim(), s); }
      (function tick(now) { var k = clamp((now - t0) / dur, 0, 1); k = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(num * k)); if (k < 1) requestAnimationFrame(tick); else el.textContent = raw; })(t0);
    });
  }, { threshold: .6 });
  $$('[data-count]').forEach(function (e) { cio.observe(e); });

  /* ---------- contact court : WhatsApp / Telegram / email, message repris du module « Et votre commerce ? » ---------- */
  var form = $('#form'), kName = $('#f-name'), kBiz = $('#f-biz'), kMsg = $('#f-msg'), kWa = $('#kWa'), kTg = $('#kTg'), kMail = $('#kMail'), waPrev = $('#waPrev'), kTouched = false;
  function kv(e) { return e ? e.value.trim() : ''; }
  function contactMsg() {
    var n = kv(kName), b = kv(kBiz), m = kv(kMsg);
    if (!kTouched || (!n && !b && !m)) return waMsg();
    var tl = shop.touched ? String(tc().label || '').toLowerCase() : '';
    var s = n ? L.hi.replace('{n}', n) + (b ? L.frm.replace('{b}', b) : '') : b ? L.for_.replace('{b}', b) : L.hello;
    if (b && tl && b.toLowerCase().indexOf(tl) < 0) s += ' (' + tl + ')';
    return s + '. ' + L.ask + (m ? '\n\n' + m : '');
  }
  function contactUpd() {
    if (!kWa) return; var m = contactMsg();
    kWa.href = 'https://wa.me/' + AP.wa + '?text=' + encodeURIComponent(m);
    if (kMail) kMail.href = 'mailto:vincent@atelierpenh.com?subject=' + encodeURIComponent(L.subj + (shop.name ? ' · ' + shop.name : '')) + '&body=' + encodeURIComponent(m);
    if (waPrev) waPrev.textContent = m;
  }
  if (form && kWa) {
    [kName, kMsg].forEach(function (e) { if (e) e.addEventListener('input', function () { kTouched = true; contactUpd(); }); });
    if (kBiz) kBiz.addEventListener('input', function () { kTouched = true; setName(kBiz.value, kBiz); contactUpd(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); contactUpd(); kWa.click(); });
    if (kTg) kTg.addEventListener('click', function () { var m = contactMsg(); try { navigator.clipboard.writeText(m).then(function () { toast(L.copied); }, function () { }); } catch (_) { } });
    if (shop.name && kBiz) kBiz.value = shop.name;
    contactUpd();
  }

  /* ---------- clics mesurés : WhatsApp, Telegram, email, langue, boutons d'appel ---------- */
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); if (!a) return;
    var h = a.getAttribute('href') || '', sc = a.closest('[data-src]'), src = sc ? sc.getAttribute('data-src') : 'other';
    if (/wa\.me\//.test(h)) AP.track('wa_click', { source: src });
    else if (/t\.me\//.test(h)) AP.track('tg_click', { source: src });
    else if (/^mailto:/.test(h)) AP.track('email_click', { source: src });
    else if (a.hasAttribute('hreflang')) {
      AP.track('lang_switch', { to: a.getAttribute('hreflang'), source: src });
      if (AP.an && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target !== '_blank') { e.preventDefault(); leaveAfter(function () { location.href = a.href; }); }
    }
    else if (/^#(contact|yours|work|pricing)$/.test(h)) AP.track('cta_click', { source: src, to: h.slice(1) });
  }, true);

  /* ---------- bouton WhatsApp flottant : après l'intro et le premier écran, jamais sur le contact, le pied ou le bouton du module ---------- */
  var fab = $('#fab'), contactSec = $('#contact'), kbOpen = false, fabPulsed = false;
  try { fabPulsed = localStorage.getItem('ap-fab') === '1'; } catch (_) { }
  function fabUpd() {
    if (!fab) return;
    var vh = innerHeight, sr = street.getBoundingClientRect(), inStreet = sr.bottom > vh * .5, show = introDone && !kbOpen;
    if (inStreet && !street.classList.contains('past1')) show = false;
    if (contactSec && contactSec.getBoundingClientRect().top < vh - 60) show = false;
    if (yStage) { var yr = $('#yours').getBoundingClientRect(); if (yr.top < vh * .8 && yr.bottom > vh * .2) show = false; }
    fab.classList.toggle('st', inStreet);
    if (show === fab._on) return;
    fab._on = show; fab.classList.toggle('on', show); fab.setAttribute('tabindex', show ? '0' : '-1'); fab.setAttribute('aria-hidden', String(!show));
    if (show && !fabPulsed) { fabPulsed = true; fab.classList.add('pulse'); setTimeout(function () { fab.classList.remove('pulse'); }, 3600); try { localStorage.setItem('ap-fab', '1'); } catch (_) { } }
  }
  if (fab) {
    fab.setAttribute('aria-hidden', 'true'); fab.href = waHref();
    if (!fine) {
      d.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input:not([type=radio]),textarea,select')) { kbOpen = true; fabUpd(); } });
      d.addEventListener('focusout', function () { kbOpen = false; setTimeout(fabUpd, 200); });
    }
  }

  /* ---------- boucle de défilement ---------- */
  var ticking = false, hovRefresh = null;
  function zoneUpd() {
    if (!SND) return; var rs = street.getBoundingClientRect(), rg = gal.getBoundingClientRect();
    var z = rs.bottom > innerHeight * .3 ? 1 : (rg.top < innerHeight && rg.bottom > 0 ? .35 : .08);
    SND.setZone(z);
  }
  function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; navUpd(); streetUpd(); galUpd(); caseUpd(); stepsUpd(); zoneUpd(); shutUpd(); fabUpd(); if (hovRefresh) hovRefresh(); }); }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () { mobile = innerWidth < 760; if (streetApi) streetApi.resize(); if (galApi) galApi.resize(); onScroll(); });
  onScroll();
  if (moana) moana.addEventListener('load', caseUpd);

  /* ---------- bouton mode léger / 3D ---------- */
  var modeBtn = $('#modeBtn');
  function setMode(m) { try { localStorage.setItem('ap-mode', m); } catch (_) { } try { sessionStorage.setItem('ap-y', String(scrollY)); } catch (_) { } AP.track('mode_switch', { to: m }); leaveAfter(function () { location.hash = ''; location.reload(); }); }
  modeBtn.textContent = lite ? AP.full : AP.lite;
  modeBtn.addEventListener('click', function () { setMode(lite ? 'full' : 'lite'); });
  try { var yy = sessionStorage.getItem('ap-y'); if (yy) { sessionStorage.removeItem('ap-y'); scrollTo(0, +yy); } } catch (_) { }
  function showModeBtn(ms) { modeBtn.classList.add('on'); clearTimeout(modeBtn._h); modeBtn._h = setTimeout(function () { modeBtn.classList.remove('on'); }, ms || 8000); }

  /* ---------- mode léger : rail 2D, posters ---------- */
  addEventListener('load', function () { setTimeout(loadPosters, lite ? 0 : 1500); if (lite) startSeq(); });
  if (lite) { setTimeout(function () { showModeBtn(6000); }, 2500); return; }
  if (!webglOK()) { goLite('gl'); return; }

  /* ---------- 3D : téléchargée avec progression (écran de chargement), exécutée après la page ---------- */
  function load3D() {
    var url = '/js/ap-3d.js?v=' + (AP.ver || 1);
    if (!window.fetch || !window.ReadableStream || !window.Blob || location.protocol === 'file:') return loadTag();
    fetch(url, { priority: 'low' }).then(function (r) {
      if (!r.ok || !r.body || !r.body.getReader) throw new Error('net');
      var tot = +r.headers.get('content-length') || 0, enc = r.headers.get('content-encoding'), rd = r.body.getReader(), parts = [], got = 0;
      if (enc && enc !== 'identity') tot = 0;
      var est = tot || 1e6;
      return (function pump() { return rd.read().then(function (x) { if (x.done) return parts; parts.push(x.value); got += x.value.length; lp('b', Math.min(got / est, .97)); return pump(); }); })();
    }).then(function (parts) {
      lp('b', 1);
      var exec = function () { var s = d.createElement('script'), u = URL.createObjectURL(new Blob(parts, { type: 'text/javascript' })); s.src = u; s.onload = function () { URL.revokeObjectURL(u); lp('i', .4); setTimeout(start3D, 40); }; s.onerror = function () { URL.revokeObjectURL(u); loadTag(); }; d.head.appendChild(s); };
      /* l'exécution bloque le fil principal : on laisse d'abord la barre rattraper la vraie progression (900 ms max) */
      var t1 = performance.now(), run = function () { if (introOn && !introDone && lpShown < lpTarget() - .02 && performance.now() - t1 < 900) return setTimeout(run, 60); if (introOn && !introDone && performance.now() > 2600) { endIntro(); setTimeout(exec, 1300); } else setTimeout(exec, 30); };
      if (d.readyState === 'complete') run(); else addEventListener('load', run);
    }).catch(function () { loadTag(); });
  }
  function loadTag() {
    var s = d.createElement('script'); s.src = '/js/ap-3d.js?v=' + (AP.ver || 1); s.async = true;
    s.onload = start3D; s.onerror = function () { html.classList.add('lite'); };
    d.head.appendChild(s);
    s.addEventListener('error', function () { goLite('net'); });
  }
  function webglOK() { try { var c = d.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return false; var dbg = g.getExtension('WEBGL_debug_renderer_info'), r = dbg ? String(g.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''; return !/swiftshader|llvmpipe|software|basic render/i.test(r) || /#full/.test(location.hash); } catch (e) { return false; } }
  function goLite(why) {
    lite = true; html.classList.add('lite'); lpAll();
    if (streetApi) { streetApi.stop(); streetApi = null; } if (galApi) { galApi.stop(); galApi = null; }
    street.classList.remove('live'); loadPosters(); startSeq(); onScroll(); showModeBtn(9000);
  }
  function start3D() {
    if (!window.THREE || !window.APStreet) return goLite('nolib');
    try {
      streetApi = window.APStreet.init($('#streetCv'), { mobile: mobile, real: window.AP_STREET_REAL, onEvent: sndEvent, onMix: function (mx) { if (window.APSound && SND && SND.setMix) SND.setMix(mx); } });
      if (shop.name) applyName();
    } catch (e) { return goLite('init'); }
    street.classList.add('live'); requestAnimationFrame(function () { requestAnimationFrame(function () { lp('i', 1); }); }); applyMode(modeIdx < 0 ? autoMode() : modeIdx, true);
    var cv = $('#streetCv');
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); goLite('lost'); });
    var sio = new IntersectionObserver(function (es) { es.forEach(function (e) { streetVisible = e.isIntersecting; if (!streetApi) return; if (e.isIntersecting) streetApi.start(); else streetApi.stop(); }); });
    sio.observe(street);
    /* survol des écrans allumés : streetApi.hover (surligne en 3D) si disponible, sinon pick */
    var ctag = $('#ctag'), ctagT = ctag && $('span', ctag), lastE = null, hovQ = 0, hovOn = null, UI = 'a,button,input,label,.tryname,.hud';
    function ndc(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1)]; }
    function hoverAt(x, y) { if (!streetApi) return null; if (streetApi.hover) return streetApi.hover(x, y); return streetApi.pick ? streetApi.pick(x, y) : null; }
    function setHov(hv) {
      var on = !!hv; cv.style.cursor = on ? 'pointer' : ''; street.classList.toggle('hov', on);
      if (ctag) { if (on && (!hovOn || hv.title !== hovOn.title)) ctagT.textContent = (Y.watch || 'Watch') + (hv.title ? ' · ' + hv.title : ''); ctag.classList.toggle('on', on); }
      hovOn = hv || null;
    }
    function doHover() {
      hovQ = 0; if (!streetApi || !lastE) return;
      var blocked = lastE.target && lastE.target.closest && lastE.target.closest(UI), q = ndc(lastE), hv = null;
      if (blocked) { if (streetApi.hover) streetApi.hover(null); } else hv = hoverAt(q[0], q[1]);
      setHov(hv);
    }
    function clearHov() { lastE = null; if (streetApi && streetApi.hover) streetApi.hover(null); setHov(null); }
    if (fine) {
      street.addEventListener('pointermove', function (e) {
        if (!streetApi) return; streetApi.setPointer(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5);
        lastE = e; if (ctag) { var cw = ctag.offsetWidth || 160, tx = e.clientX + 18 + cw > innerWidth - 8 ? e.clientX - cw - 14 : e.clientX + 18; ctag.style.transform = 'translate(' + tx + 'px,' + (e.clientY + 20) + 'px)'; }
        if (!hovQ) hovQ = setTimeout(doHover, 60);
      }, { passive: true });
      street.addEventListener('pointerleave', clearHov);
      hovRefresh = function () { if (lastE && !hovQ) hovQ = setTimeout(doHover, 90); };
    }
    street.addEventListener('click', function (e) {
      if (!streetApi || (e.target.closest && e.target.closest(UI))) return;
      var q = ndc(e), hit = streetApi.pick ? streetApi.pick(q[0], q[1]) : hoverAt(q[0], q[1]);
      if (hit) { openVid(hit.video, hit.title); street.classList.add('learned'); clearHov(); }
    });
    onScroll();
    /* surveillance : si l'appareil rame, on passe en mode léger */
    var n = 0, t0 = 0, last = 0, slow = 0;
    (function watch(now) {
      if (lite) return;
      if (streetVisible && last) { var dt = now - last; if (dt > 0 && dt < 500) { n++; if (dt > 50) slow++; } }
      last = now;
      if (!t0) t0 = now;
      if (now - t0 > 4500) { if (n > 30 && slow / n > .55) { goLite('slow'); return; } n = slow = 0; t0 = now; }
      requestAnimationFrame(watch);
    })(performance.now());
    showModeBtn(5000);
    /* galerie : quand on s'en approche */
    var built = false, gio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !built && !lite) {
          built = true;
          try {
            galApi = window.APGallery.init($('#galCv'), works.map(function (w) { return { img: w.img, video: w.v }; }), {
              mobile: mobile, onActive: function (i) { setLabel(i); if (SND && SND.enabled()) SND.tick(); }
            });
          } catch (er) { return; }
          var gcv = $('#galCv');
          gcv.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); html.classList.add('lite'); if (galApi) galApi.stop(); galApi = null; });
          gcv.addEventListener('click', function (ev) { if (!galApi) return; var i = galApi.pick(ev.clientX, ev.clientY); if (i < 0) return; if (i === gIdx) openLb(i); else galGo(i); });
          if (fine) gal.addEventListener('pointermove', function (ev) { if (galApi) galApi.setPointer(ev.clientX / innerWidth - .5, ev.clientY / innerHeight - .5); }, { passive: true });
          galUpd();
        }
        if (galApi) { if (e.isIntersecting) galApi.start(); else galApi.stop(); }
      });
    }, { rootMargin: '400px 0px' });
    gio.observe(gal);
  }
  /* écran de chargement visible : on télécharge tout de suite ; sinon on attend la page, comme avant */
  if (introOn && !introDone) load3D();
  else if (d.readyState === 'complete') setTimeout(load3D, 200);
  else addEventListener('load', function () { if (window.requestIdleCallback) requestIdleCallback(load3D, { timeout: 1500 }); else setTimeout(load3D, 300); });
})();

/* banc d'essai : ajouter #bench à l'adresse. Défile la rue tout seul et affiche les images/seconde par tronçon. */
(function () {
  if (!/bench/.test(location.hash)) return;
  var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:10px;top:70px;z-index:9999;background:rgba(0,0,0,.82);color:#7dff9a;font:13px/1.45 monospace;padding:10px 12px;border-radius:8px;white-space:pre;pointer-events:none';
  document.body.appendChild(box);
  var gpu = '?'; try { var gl = document.createElement('canvas').getContext('webgl'), e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; } catch (x) { }
  var n = 0, t0 = performance.now(), fps = 0, res = [], seg = null;
  (function loop(t) { n++; if (t - t0 >= 1000) { fps = Math.round(n * 1000 / (t - t0)); n = 0; t0 = t; if (seg) seg.s.push(fps); draw(); } requestAnimationFrame(loop); })(performance.now());
  function draw() { box.textContent = 'GPU: ' + gpu + '\nmode: ' + document.documentElement.className + '\ndpr ' + devicePixelRatio + ' · ' + innerWidth + 'x' + innerHeight + '\nFPS now: ' + fps + (seg ? '\nsegment: ' + seg.name : '') + '\n' + res.map(function (r) { return r.name + ': moy ' + r.avg + ' / min ' + r.min; }).join('\n'); }
  var st = document.getElementById('street');
  function run() {
    var H = st.offsetHeight - innerHeight, top = st.offsetTop, plan = [['intro+rue 0-20%', 0, .2], ['rue 20-40%', .2, .4], ['virage+ruelle 40-60%', .4, .6], ['resto 60-80%', .6, .8], ['final 80-100%', .8, 1]], i = 0;
    (function next() {
      if (i >= plan.length) { seg = null; box.style.color = '#ffd27a'; draw(); return; }
      var p = plan[i++]; seg = { name: p[0], s: [] }; var a = performance.now(), D = 6000;
      (function step() { var k = Math.min(1, (performance.now() - a) / D); window.scrollTo(0, top + H * (p[1] + (p[2] - p[1]) * k)); if (k < 1) requestAnimationFrame(step); else setTimeout(function () { var s = seg.s.length ? seg.s : [fps]; res.push({ name: seg.name, avg: Math.round(s.reduce(function (x, y) { return x + y; }, 0) / s.length), min: Math.min.apply(null, s) }); next(); }, 300); })();
    })();
  }
  setTimeout(run, 9000);
})();
