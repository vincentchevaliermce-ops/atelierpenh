/* Atelier Penh · son de la rue (WebAudio, tout est synthétisé, rien à télécharger)
   APSound.enable() / disable() / setZone(0..1) / shutter(pan) / pop() / chime(i) / tick() / whoosh() */
(function () {
  'use strict';
  var ctx = null, master, comp, beds, sfx, rev, on = false, zone = 1, timers = [], bedNodes = [];
  function now() { return ctx.currentTime; }
  function noiseBuf(sec, color) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (var i = 0; i < n; i++) {
        var w = Math.random() * 2 - 1;
        if (color === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
        else if (color === 'pink') { b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .2; }
        else d[i] = w;
      }
    }
    return b;
  }
  function impulse(sec, decay) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function loop(buf, gain, filt) {
    var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    var g = ctx.createGain(); g.gain.value = gain; var last = s;
    (filt || []).forEach(function (f) { var bq = ctx.createBiquadFilter(); bq.type = f[0]; bq.frequency.value = f[1]; if (f[2]) bq.Q.value = f[2]; last.connect(bq); last = bq; });
    last.connect(g); g.connect(beds); s.start(); bedNodes.push(s); return g;
  }
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 0; master.connect(comp); comp.connect(ctx.destination);
    beds = ctx.createGain(); beds.gain.value = 1; beds.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(3.2, 2.6); var rg = ctx.createGain(); rg.gain.value = .35; rev.connect(rg); rg.connect(master);
    var white = noiseBuf(4, 'white'), pink = noiseBuf(5, 'pink'), brown = noiseBuf(6, 'brown');
    // pluie : souffle + crépitement
    synthRain = [loop(pink, .2, [['highpass', 700], ['lowpass', 6500]]), loop(white, .03, [['bandpass', 3800, .6]])];
    // ville au loin : grondement
    var rum = loop(brown, .55, [['lowpass', 170]]); synthRain.push(rum);
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = .18; lfo.connect(lg); lg.connect(rum.gain); lfo.start(); bedNodes.push(lfo);
    // néons : bourdonnement très léger
    var hum = ctx.createOscillator(), hf = ctx.createBiquadFilter(), hg = ctx.createGain(); hum.type = 'sawtooth'; hum.frequency.value = 100; hf.type = 'lowpass'; hf.frequency.value = 420; hg.gain.value = .012;
    hum.connect(hf); hf.connect(hg); hg.connect(beds); hum.start(); bedNodes.push(hum);
    insects(); boatEngine();
    // nappe musicale très douce (gamme pentatonique)
    pad();
    schedule();
  }
  var SCALE = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37, 659.25, 739.99];
  function pad() {
    var g = ctx.createGain(); g.gain.value = .0; g.connect(beds); g.connect(rev);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
    [110, 164.81, 220, 277.18].forEach(function (f, i) {
      [-4, 4].forEach(function (dt) { var o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = dt; var og = ctx.createGain(); og.gain.value = .05 / (i + 1); o.connect(og); og.connect(lp); o.start(); bedNodes.push(o); });
    });
    g.gain.setTargetAtTime(.32, now(), 4);
  }
  function pluck(f, t, v) {
    var o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
    o.connect(lp); lp.connect(g); g.connect(beds); g.connect(rev); o.start(t); o.stop(t + 2.5);
  }
  function horn(pv) {
    var t = now() + .05, g = ctx.createGain(), lp = ctx.createBiquadFilter(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .03); g.gain.setValueAtTime(.05, t + .32); g.gain.linearRampToValueAtTime(0, t + .4);
    [392, 494].forEach(function (f) { var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + .45); });
    lp.connect(g); if (pan) { pan.pan.value = pv == null ? Math.random() * 1.6 - .8 : pv; g.connect(pan); pan.connect(beds); pan.connect(rev); } else { g.connect(beds); }
  }
  function passBy() { // moto qui passe
    if (bufs.moto) { playS('moto', rnd(-.8, .8), rnd(.12, .3), rnd(.85, 1.15)); return; }
    var t = now() + .05, s = ctx.createBufferSource(); s.buffer = noiseBuf(3, 'brown');
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(180, t); bp.frequency.linearRampToValueAtTime(420, t + 1.3); bp.frequency.linearRampToValueAtTime(150, t + 2.8);
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(95, t + 1.3); o.frequency.linearRampToValueAtTime(60, t + 2.8);
    var og = ctx.createGain(); og.gain.value = .25; o.connect(og); og.connect(bp);
    var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + 1.3); g.gain.linearRampToValueAtTime(0, t + 2.8);
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.connect(bp); bp.connect(g);
    if (pan) { var dir = Math.random() < .5 ? -1 : 1; pan.pan.setValueAtTime(-.9 * dir, t); pan.pan.linearRampToValueAtTime(.9 * dir, t + 2.8); g.connect(pan); pan.connect(beds); } else g.connect(beds);
    s.start(t); s.stop(t + 3); o.start(t); o.stop(t + 3);
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function panner(v) { var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) p.pan.value = v; return p; }
  function out(node, pan, wet) { var p = panner(pan || 0); if (p) { node.connect(p); p.connect(beds); if (wet) p.connect(rev); } else { node.connect(beds); if (wet) node.connect(rev); } }
  /* grillons et insectes */
  function insects() {
    [4700, 5300, 6100].forEach(function (f, i) {
      var o = ctx.createOscillator(), am = ctx.createOscillator(), amg = ctx.createGain(), g = ctx.createGain(), slow = ctx.createOscillator(), sg = ctx.createGain();
      o.frequency.value = f; am.type = "square"; am.frequency.value = 24 + i * 7; amg.gain.value = .006; g.gain.value = 0;
      slow.frequency.value = .35 + i * .21; sg.gain.value = .006;
      am.connect(amg); amg.connect(g.gain); slow.connect(sg); sg.connect(g.gain);
      o.connect(g); out(g, [-.7, .2, .8][i]); [o, am, slow].forEach(function (n) { n.start(); bedNodes.push(n); });
    });
  }
  /* gecko « tokay » */
  function gecko() {
    var t = now() + .1, n = 3 + Math.floor(Math.random() * 4), pan = rnd(-.8, .8);
    for (var i = 0; i < n; i++) {
      var t0 = t + i * .95, v = .14 * (1 - i / (n + 2));
      [[0, .13, 520, 260], [.17, .2, 1150, 340]].forEach(function (sy) {
        var o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(sy[3], t0 + sy[0]); o.frequency.exponentialRampToValueAtTime(sy[3] * .75, t0 + sy[0] + sy[1]);
        bp.type = 'bandpass'; bp.frequency.value = sy[2]; bp.Q.value = 5;
        g.gain.setValueAtTime(0, t0 + sy[0]); g.gain.linearRampToValueAtTime(v, t0 + sy[0] + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + sy[0] + sy[1]);
        o.connect(bp); bp.connect(g); out(g, pan, true); o.start(t0 + sy[0]); o.stop(t0 + sy[0] + sy[1] + .05);
      });
    }
  }
  /* chats qui se battent */
  /* combat de chats : face-à-face (miaulements graves qui ondulent), grognement, feulement, crachats, mêlée, fuite */
  var NB = {};
  function nb(c) { return NB[c] || (NB[c] = noiseBuf(2, c)); }
  function env(p, pts, t0, d) { p.setValueAtTime(pts[0][1], t0); for (var i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i][1], t0 + pts[i][0] * d); }
  function noiseSrc(c, t0, d) { var s = ctx.createBufferSource(); s.buffer = nb(c); s.loop = true; s.start(t0, Math.random()); s.stop(t0 + d + .05); return s; }
  // une voix de chat : source riche + jitter + raucité + 3 formants qui suivent l'ouverture de la gueule ("mrrraaoooww")
  function catVoice(t0, d, f0, mouth, o) {
    var pan = o.pan || 0, vol = o.g || .12, rough = o.rough || .4, mix = ctx.createGain(), amp = ctx.createGain(), g = ctx.createGain(), nodes = [];
    [[1, 'sawtooth', .55], [1.004, 'sawtooth', .4], [.5, 'square', .22 * rough]].forEach(function (v) {
      var osc = ctx.createOscillator(), og = ctx.createGain(); osc.type = v[1]; og.gain.value = v[2];
      env(osc.frequency, f0.map(function (p) { return [p[0], p[1] * v[0]]; }), t0, d); osc.connect(og); og.connect(mix); nodes.push(osc);
    });
    // jitter (voix instable) + vibrato lent
    var jn = noiseSrc('white', t0, d), jl = ctx.createBiquadFilter(), jg = ctx.createGain(); jl.type = 'lowpass'; jl.frequency.value = 14; jg.gain.value = 260 * (.5 + rough);
    jn.connect(jl); jl.connect(jg);
    var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = rnd(4.5, 7); vg.gain.value = 30; vib.connect(vg);
    nodes.forEach(function (n) { jg.connect(n.detune); vg.connect(n.detune); });
    // raucité : modulation d'amplitude rapide et irrégulière (voix "fry")
    var rl = ctx.createOscillator(), rg = ctx.createGain(); rl.type = 'triangle'; rl.frequency.setValueAtTime(rnd(28, 40), t0); rl.frequency.linearRampToValueAtTime(rnd(22, 48), t0 + d);
    amp.gain.value = 1 - rough * .35; rg.gain.value = rough * .35; rl.connect(rg); rg.connect(amp.gain);
    // un peu de souffle dans la voix
    var br = noiseSrc('white', t0, d), bbp = ctx.createBiquadFilter(), bg = ctx.createGain(); bbp.type = 'bandpass'; bbp.frequency.value = 3200; bbp.Q.value = .8; bg.gain.value = .05 + rough * .06; br.connect(bbp); bbp.connect(bg); bg.connect(amp);
    mix.connect(amp);
    // formants (gueule fermée -> ouverte)
    [[420, 680, 6, 1], [1150, 820, 8, .55], [2700, 450, 10, .3]].forEach(function (F) {
      var bp = ctx.createBiquadFilter(), fg = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = F[2]; fg.gain.value = F[3] * 3;
      env(bp.frequency, mouth.map(function (p) { return [p[0], F[0] + p[1] * F[1]]; }), t0, d); amp.connect(bp); bp.connect(fg); fg.connect(g);
    });
    var lp = ctx.createBiquadFilter(), lg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 700; lg.gain.value = .25; amp.connect(lp); lp.connect(lg); lg.connect(g);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * .6, t0 + Math.min(.18, d * .2)); g.gain.linearRampToValueAtTime(vol, t0 + d * .45); g.gain.setValueAtTime(vol, t0 + d * .8); g.gain.linearRampToValueAtTime(0, t0 + d);
    out(g, pan, true);
    nodes.concat([vib, rl]).forEach(function (n) { n.start(t0); n.stop(t0 + d + .05); });
  }
  // grognement de gorge, grave et pulsé
  function growl(t0, d, pan, vol) {
    var o = ctx.createOscillator(), am = ctx.createOscillator(), ag = ctx.createGain(), a = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(95, 115), t0); o.frequency.linearRampToValueAtTime(rnd(120, 150), t0 + d * .6); o.frequency.linearRampToValueAtTime(100, t0 + d);
    am.type = 'square'; am.frequency.value = rnd(22, 28); ag.gain.value = .45; a.gain.value = .55; am.connect(ag); ag.connect(a.gain);
    lp.type = 'lowpass'; lp.frequency.value = 850; lp.Q.value = 2;
    var n = noiseSrc('pink', t0, d), nb2 = ctx.createBiquadFilter(), ng = ctx.createGain(); nb2.type = 'bandpass'; nb2.frequency.value = 380; nb2.Q.value = 1.5; ng.gain.value = .6; n.connect(nb2); nb2.connect(ng); ng.connect(a);
    o.connect(a); a.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .25); g.gain.setValueAtTime(vol, t0 + d - .3); g.gain.linearRampToValueAtTime(0, t0 + d);
    out(g, pan, true); o.start(t0); am.start(t0); o.stop(t0 + d + .05); am.stop(t0 + d + .05);
  }
  // feulement (hhhhhh) et crachat (ktch!)
  function hiss(t0, d, pan, vol, spit) {
    var n = noiseSrc('white', t0, d), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(spit ? 2600 : 4200, t0); bp.frequency.linearRampToValueAtTime(spit ? 3800 : 5600, t0 + d); bp.Q.value = spit ? 1.2 : .7;
    hp.type = 'highpass'; hp.frequency.value = spit ? 1200 : 2200;
    if (spit) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .006); g.gain.exponentialRampToValueAtTime(vol * .25, t0 + .05); g.gain.exponentialRampToValueAtTime(.0005, t0 + d); }
    else { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .06); g.gain.linearRampToValueAtTime(vol * .7, t0 + d * .7); g.gain.exponentialRampToValueAtTime(.0005, t0 + d); }
    n.connect(bp); bp.connect(hp); hp.connect(g); out(g, pan, true);
  }
  // mêlée : coups de pattes, corps qui roulent, griffes sur le trottoir
  function scuffle(t0, d, pan) {
    var t = t0; while (t < t0 + d) {
      var k = rnd(.025, .09), n = noiseSrc(Math.random() < .5 ? 'pink' : 'brown', t, k), lp = ctx.createBiquadFilter(), g = ctx.createGain(), v = rnd(.12, .32);
      lp.type = Math.random() < .3 ? 'bandpass' : 'lowpass'; lp.frequency.value = lp.type === 'bandpass' ? rnd(2500, 5000) : rnd(700, 1800); lp.Q.value = 1;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + k);
      n.connect(lp); lp.connect(g); out(g, pan + rnd(-.15, .15), false);
      t += rnd(.03, .12);
    }
  }
  /* tuk-tuk dans la flaque : vague d'eau + gouttes qui retombent */
  function splash(pan) {
    var p = +pan || 0, t = now() + .02;
    var n = noiseSrc('white', t, 1.2), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = .9; bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(2600, t + .12); bp.frequency.exponentialRampToValueAtTime(900, t + .9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .04); g.gain.exponentialRampToValueAtTime(.08, t + .35); g.gain.exponentialRampToValueAtTime(.001, t + 1.1);
    n.connect(bp); bp.connect(g); out(g, p, true);
    var lw = noiseSrc('brown', t, .5), lp = ctx.createBiquadFilter(), lg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 400;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(.35, t + .03); lg.gain.exponentialRampToValueAtTime(.001, t + .45); lw.connect(lp); lp.connect(lg); out(lg, p, false);
    for (var i = 0; i < 26; i++) { // gouttes qui retombent
      var td = t + .25 + Math.random() * .9, o = ctx.createOscillator(), og = ctx.createGain(), f = rnd(900, 2600);
      o.type = 'sine'; o.frequency.setValueAtTime(f, td); o.frequency.exponentialRampToValueAtTime(f * 1.8, td + .03);
      og.gain.setValueAtTime(0, td); og.gain.linearRampToValueAtTime(rnd(.01, .035), td + .003); og.gain.exponentialRampToValueAtTime(.0005, td + .05);
      o.connect(og); out(og, p + rnd(-.3, .5), false); o.start(td); o.stop(td + .06);
    }
  }
  /* vrai enregistrement (CC0, freesound #675401 craigsmith) ; synthèse en secours si le fichier ne charge pas */
  var catBuf = null, catLoading = false;
  function loadCats() {
    if (catBuf || catLoading || !window.fetch) return; catLoading = true;
    var u = window.__R ? window.__R('/img/cat-fight.mp3') : 'img/cat-fight.mp3';
    fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (ok, ko) { var p = ctx.decodeAudioData(ab, ok, ko); if (p && p.then) p.then(ok, ko); });
    }).then(function (b) { catBuf = b; }).catch(function () { catLoading = false; });
  }
  function catsReal(pan) {
    var src = ctx.createBufferSource(), g = ctx.createGain(), t = now() + .02; src.buffer = catBuf;
    g.gain.value = .55; src.connect(g); out(g, Math.max(-.8, Math.min(.8, +pan || 0)), true); src.start(t);
  }
  function catsSynth(pan) {
    var p = Math.max(-.8, Math.min(.8, +pan || 0)), t = now() + .05;
    // 1. face-à-face : deux miaulements graves qui ondulent, l'un répond à l'autre
    catVoice(t, 2.3, [[0, 240], [.2, 330], [.38, 290], [.6, 410], [.8, 360], [1, 280]], [[0, .1], [.2, .7], [.38, .35], [.6, .95], [.8, .6], [1, .15]], { pan: p - .18, g: .11, rough: .45 });
    growl(t + .4, 1.7, p - .18, .045);
    catVoice(t + 1.1, 2.0, [[0, 360], [.25, 500], [.45, 440], [.7, 620], [1, 430]], [[0, .15], [.25, .8], [.45, .4], [.7, 1], [1, .2]], { pan: p + .18, g: .1, rough: .35 });
    // 2. ça monte
    catVoice(t + 2.5, 1.2, [[0, 330], [.5, 560], [.85, 760], [1, 700]], [[0, .2], [.5, .7], [.85, 1], [1, .8]], { pan: p - .18, g: .12, rough: .55 });
    hiss(t + 2.7, .75, p + .18, .09, false);
    // 3. crachats puis bagarre
    hiss(t + 3.45, .12, p - .15, .2, true); hiss(t + 3.55, .1, p + .15, .18, true);
    catVoice(t + 3.6, .8, [[0, 820], [.3, 1350], [.6, 1100], [1, 700]], [[0, .9], [.3, 1], [1, .6]], { pan: p - .1, g: .13, rough: .9 });
    catVoice(t + 3.75, .7, [[0, 980], [.35, 1500], [.7, 1250], [1, 850]], [[0, 1], [1, .7]], { pan: p + .1, g: .12, rough: 1 });
    scuffle(t + 3.6, 1.1, p);
    catVoice(t + 4.35, .45, [[0, 1100], [.5, 1400], [1, 800]], [[0, 1], [1, .6]], { pan: p, g: .1, rough: 1 });
    // 4. l'un s'enfuit en râlant
    catVoice(t + 5.0, 1.3, [[0, 460], [.4, 520], [1, 300]], [[0, .7], [.4, .9], [1, .1]], { pan: p + .45, g: .055, rough: .5 });
  }
  /* chariot de glaces : petite boîte à musique qui passe (mélodie originale) */
  var JINGLE = [659, 784, 880, 784, 659, 587, 659, 0, 523, 587, 659, 784, 659, 587, 523, 0];
  function iceCream() {
    var t = now() + .1, dur = 14, step = .22, p = panner(0), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = .7;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + dur * .45); g.gain.linearRampToValueAtTime(0, t + dur);
    if (p) { var dir = Math.random() < .5 ? -1 : 1; p.pan.setValueAtTime(-.9 * dir, t); p.pan.linearRampToValueAtTime(.9 * dir, t + dur); bp.connect(g); g.connect(p); p.connect(beds); p.connect(rev); } else { bp.connect(g); g.connect(beds); }
    for (var i = 0; i * step < dur; i++) {
      var f = JINGLE[i % JINGLE.length]; if (!f) continue; var t0 = t + i * step;
      var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'square'; o.frequency.value = f;
      og.gain.setValueAtTime(0, t0); og.gain.linearRampToValueAtTime(.35, t0 + .005); og.gain.exponentialRampToValueAtTime(.001, t0 + step * .95);
      o.connect(og); og.connect(bp); o.start(t0); o.stop(t0 + step);
    }
  }
  /* karaoké au loin, étouffé */
  function karaoke() {
    var t = now() + .1, bars = 16, bpm = 96, beat = 60 / bpm, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 380; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + 3); g.gain.setValueAtTime(.22, t + bars * beat * 4 - 3); g.gain.linearRampToValueAtTime(0, t + bars * beat * 4);
    lp.connect(g); out(g, rnd(-.6, .6), true);
    var chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]];
    for (var b = 0; b < bars * 4; b++) {
      var tb = t + b * beat;
      var k = ctx.createOscillator(), kg = ctx.createGain(); k.frequency.setValueAtTime(110, tb); k.frequency.exponentialRampToValueAtTime(45, tb + .15); kg.gain.setValueAtTime(.9, tb); kg.gain.exponentialRampToValueAtTime(.001, tb + .2); k.connect(kg); kg.connect(lp); k.start(tb); k.stop(tb + .22);
      if (b % 4 === 0) { chords[(b / 4) % 4].forEach(function (f) { var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; og.gain.setValueAtTime(.06, tb); og.gain.linearRampToValueAtTime(.0, tb + beat * 4); o.connect(og); og.connect(lp); o.start(tb); o.stop(tb + beat * 4); }); }
    }
  }
  function beep() {
    var t = now() + .05, p = rnd(-.7, .7);
    [0, .16].forEach(function (d) { var o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'square'; o.frequency.value = 1180; lp.type = 'lowpass'; lp.frequency.value = 2200; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.035, t + d + .01); g.gain.setValueAtTime(.035, t + d + .1); g.gain.linearRampToValueAtTime(0, t + d + .12); o.connect(lp); lp.connect(g); out(g, p, true); o.start(t + d); o.stop(t + d + .14); });
  }
  /* bateau : moteur qui toussote sur le fleuve */
  function boatEngine() {
    var s3 = ctx.createBufferSource(); s3.buffer = noiseBuf(4, 'brown'); s3.loop = true; var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    var g = ctx.createGain(); g.gain.value = 0; var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'square'; lfo.frequency.value = 5.5; lg.gain.value = .12; lfo.connect(lg); lg.connect(g.gain);
    s3.connect(lp); lp.connect(g); out(g, .75); s3.start(); lfo.start(); bedNodes.push(s3, lfo);
  }

  /* ---------- vrais enregistrements (CC0, freesound) : ambiances en boucle + bruitages ---------- */
  var synthRain = [], bufs = {}, bedG = {}, lpOut = null, sLoading = false;
  var LOOPS = { rain: .55, traffic: .5, market: .75, resto: .8, grill: .7 }, MIX = { rain: 1, traffic: .6, market: 0, resto: 0, grill: 0, inside: 0 };
  function sURL(n) { var u = '/img/' + n + '.mp3'; return window.__R ? window.__R(u) : 'img/' + n + '.mp3'; }
  function decode(ab) { return new Promise(function (ok, ko) { var p = ctx.decodeAudioData(ab, ok, ko); if (p && p.then) p.then(ok, ko); }); }
  function loadSamples() {
    if (sLoading || !window.fetch) return; sLoading = true;
    lpOut = ctx.createBiquadFilter(); lpOut.type = 'lowpass'; lpOut.frequency.value = 16000; lpOut.connect(beds);
    ['rain', 'traffic', 'market', 'resto', 'grill', 'moto', 'bark', 'tuktuk'].forEach(function (k) {
      fetch(sURL('snd-' + k)).then(function (r) { return r.arrayBuffer(); }).then(decode).then(function (b) {
        bufs[k] = b; if (!(k in LOOPS)) return;
        var src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = b; src.loop = true; g.gain.value = 0;
        src.connect(g); g.connect(k === 'resto' ? beds : lpOut); src.start(now() + .05, Math.random() * b.duration); bedG[k] = g; bedNodes.push(src);
        if (k === 'rain') synthRain.forEach(function (sg) { sg.gain.setTargetAtTime(0, now(), 1.5); });
        applyMix(2);
      }).catch(function () { });
    });
  }
  function applyMix(tc) {
    if (!ctx) return; var t = now();
    Object.keys(bedG).forEach(function (k) { bedG[k].gain.setTargetAtTime(LOOPS[k] * Math.max(0, Math.min(1, MIX[k] || 0)), t, tc || .6); });
    if (lpOut) lpOut.frequency.setTargetAtTime(MIX.inside > .5 ? 650 : 16000, t, .4);
  }
  function playS(k, pan, vol, rate) {
    if (!bufs[k]) return false; var src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = bufs[k]; src.playbackRate.value = rate || 1; g.gain.value = vol == null ? .5 : vol;
    src.connect(g); var p = panner(Math.max(-.9, Math.min(.9, pan || 0))); if (p) { g.connect(p); p.connect(MIX.inside > .5 ? lpOut || sfx : sfx); p.connect(rev); } else g.connect(sfx); src.start(now() + .01); return true;
  }
  /* notification de message (ping maison, deux notes) + petit buzz du téléphone sur la table */
  function waPing() {
    var t = now() + .02;
    [[1046.5, 0], [1568, .11]].forEach(function (a) { [1, 2.01, 3.98].forEach(function (m, j) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = a[0] * m; g.gain.setValueAtTime(0, t + a[1]); g.gain.linearRampToValueAtTime(.14 / (j * 2 + 1), t + a[1] + .004); g.gain.exponentialRampToValueAtTime(.0005, t + a[1] + .35 / (j + 1)); o.connect(g); g.connect(sfx); g.connect(rev); o.start(t + a[1]); o.stop(t + a[1] + .4); }); });
    for (var i = 0; i < 2; i++) { var tb = t + .45 + i * .32, n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g2 = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain(); n.buffer = noiseBuf(.3, 'brown'); lp.type = 'lowpass'; lp.frequency.value = 260; am.frequency.value = 160; ag.gain.value = .5; g2.gain.setValueAtTime(0, tb); g2.gain.linearRampToValueAtTime(.35, tb + .02); g2.gain.setValueAtTime(.35, tb + .2); g2.gain.linearRampToValueAtTime(0, tb + .24); am.connect(ag); ag.connect(g2.gain); n.connect(lp); lp.connect(g2); g2.connect(sfx); n.start(tb); n.stop(tb + .26); am.start(tb); am.stop(tb + .26); }
  }
  function every(fn, a, b) { var h = { id: 0 }; (function go() { h.id = setTimeout(function () { if (on && zone > .2) fn(); go(); }, rnd(a, b) * 1000); })(); timers.push(h); }
  function schedule() {
    every(horn, 9, 22);
    every(passBy, 4, 9);
    every(gecko, 14, 30);
    every(iceCream, 30, 55);
    every(karaoke, 45, 80);
    every(beep, 6, 14);
    every(function () { var t = now(); var n = 2 + Math.floor(Math.random() * 3); for (var i = 0; i < n; i++) pluck(SCALE[Math.floor(Math.random() * SCALE.length)], t + i * rnd(.25, .5), .03); }, 12, 24);
  }

  var api = {
    enabled: function () { return on; },
    catReady: function () { return !!catBuf; },
    loaded: function () { return Object.keys(bufs); },
    setMix: function (m) { for (var k in m) MIX[k] = m[k]; if (on) applyMix(); },
    moto: function (pan) { if (on && ctx) playS('moto', pan, .45, .9 + Math.random() * .25); },
    tuktuk: function (pan) { if (on && ctx) playS('tuktuk', pan, .35, 1); },
    bark: function (pan) { if (on && ctx) playS('bark', pan, .5, .9 + Math.random() * .2); },
    wa: function () { if (on && ctx) waPing(); },
    enable: function () {
      if (!ctx) build();
      if (ctx.state === 'suspended') ctx.resume();
      on = true; loadCats(); loadSamples(); master.gain.cancelScheduledValues(now()); master.gain.setTargetAtTime(.9 * zone, now(), .6);
    },
    disable: function () { if (!ctx) return; on = false; master.gain.cancelScheduledValues(now()); master.gain.setTargetAtTime(0, now(), .25); },
    setZone: function (z) { zone = z; if (ctx && on) master.gain.setTargetAtTime(.9 * z, now(), .5); },
    /* rideau de fer qui remonte */
    shutter: function (pan) {
      if (!on || !ctx) return; var t = now() + .02, dur = .95;
      var s = ctx.createBufferSource(); s.buffer = noiseBuf(1.2, 'white');
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1400, t); bp.frequency.linearRampToValueAtTime(2600, t + dur); bp.Q.value = 2.5;
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      for (var k = 0; k < 26; k++) { var tk = t + k * (dur / 26); g.gain.setValueAtTime(.32 * (1 - k / 40), tk); g.gain.exponentialRampToValueAtTime(.02, tk + dur / 26 * .8); }
      g.gain.setValueAtTime(0, t + dur);
      var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) p.pan.value = pan || 0;
      s.connect(bp); bp.connect(g); if (p) { g.connect(p); p.connect(sfx); p.connect(rev); } else g.connect(sfx);
      s.start(t); s.stop(t + dur + .1);
      // le « clac » final
      var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(140, t + dur); o.frequency.exponentialRampToValueAtTime(60, t + dur + .12);
      og.gain.setValueAtTime(.12, t + dur); og.gain.exponentialRampToValueAtTime(.001, t + dur + .15); o.connect(og); og.connect(sfx); o.start(t + dur); o.stop(t + dur + .2);
    },
    /* bulle WhatsApp */
    pop: function () {
      if (!on || !ctx) return; var t = now() + .01;
      [[880, 0], [1320, .07]].forEach(function (a) { var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(a[0], t + a[1]); o.frequency.exponentialRampToValueAtTime(a[0] * 1.25, t + a[1] + .06); g.gain.setValueAtTime(0, t + a[1]); g.gain.linearRampToValueAtTime(.16, t + a[1] + .005); g.gain.exponentialRampToValueAtTime(.001, t + a[1] + .14); o.connect(g); g.connect(sfx); o.start(t + a[1]); o.stop(t + a[1] + .16); });
    },
    /* épingle qui tombe */
    chime: function (i) {
      if (!on || !ctx) return; var t = now() + .01, f = SCALE[(i || 0) % SCALE.length] * 2;
      [1, 2.76, 5.4].forEach(function (m, j) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08 / (j + 1), t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6 / (j + 1)); o.connect(g); g.connect(sfx); g.connect(rev); o.start(t); o.stop(t + 1.7); });
    },
    cats: function (pan) { if (on && ctx) { if (catBuf) catsReal(pan); else catsSynth(pan); } },
    horn: function (pan) { if (on && ctx) horn(pan); },
    splash: function (pan) { if (on && ctx) splash(pan); },
    tick: function () {
      if (!on || !ctx) return; var t = now(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 1800; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + .06);
    },
    whoosh: function () {
      if (!on || !ctx) return; var t = now(), s = ctx.createBufferSource(); s.buffer = noiseBuf(1, 'pink'); var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .8; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + .5);
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + .25); g.gain.linearRampToValueAtTime(0, t + .7); s.connect(bp); bp.connect(g); g.connect(sfx); s.start(t); s.stop(t + .8);
    }
  };
  window.APSound = api;
})();
