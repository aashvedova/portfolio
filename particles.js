// A case picture that assembles from particles while its card scrolls into view, and scatters again
// when scrolled back. Progress follows the scroll position, so the reader drives it.
// Canvas 2D, one pixel buffer per card at 1x; the particle grid is coarser on phones.
// Reduced motion, or no canvas support: the picture is simply shown.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 900px)').matches;
  var dpr = 1;                                 // dots do not need retina resolution; keeps the per-frame fill cheap
  var STEP = small ? 7 : 5;                    // CSS px between particles
  var items = [], raf = 0;

  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function build(host) {
    var img = host.querySelector('img');
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return null;
    var cols = Math.floor(w / STEP), rows = Math.floor(h / STEP);
    var probe = document.createElement('canvas'); probe.width = cols; probe.height = rows;
    var pc = probe.getContext('2d');
    var ir = img.naturalWidth / img.naturalHeight, br = cols / rows, sw, sh, sx, sy;
    if (ir > br) { sh = img.naturalHeight; sw = sh * br; sx = (img.naturalWidth - sw) / 2; sy = 0; }
    else { sw = img.naturalWidth; sh = sw / br; sx = 0; sy = (img.naturalHeight - sh) / 2; }
    pc.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
    var data;
    try { data = pc.getImageData(0, 0, cols, rows).data; } catch (e) { return null; }
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var n = cols * rows, P = new Float32Array(n * 5), C = new Uint32Array(n);
    var s = STEP * dpr, cw = canvas.width, ch = canvas.height;
    for (var i = 0; i < n; i++) {
      var x = i % cols, y = (i / cols) | 0, o = i * 4;
      var a = Math.random() * Math.PI * 2, r = (0.6 + Math.random()) * Math.max(cw, ch) * 0.6;
      P[i * 5] = (x + 0.5) * s; P[i * 5 + 1] = (y + 0.5) * s;                    // target
      P[i * 5 + 2] = cw / 2 + Math.cos(a) * r; P[i * 5 + 3] = ch / 2 + Math.sin(a) * r; // start, scattered round the card
      P[i * 5 + 4] = Math.random() * 0.35;                                        // delay
      C[i] = (255 << 24) | (data[o + 2] << 16) | (data[o + 1] << 8) | data[o];
    }
    host.classList.add('has-particles');
    return { host: host, canvas: canvas, ctx: ctx, P: P, C: C, n: n, size: Math.max(1, Math.round(s * 0.62)), p: 0, shown: -1, buf: ctx.createImageData(cw, ch) };
  }
  function draw(it) {
    var buf = it.buf, px = new Uint32Array(buf.data.buffer), cw = buf.width, ch = buf.height;
    px.fill(0);
    var P = it.P, C = it.C, sz = it.size, p = it.p;
    for (var i = 0; i < it.n; i++) {
      var k = ease(Math.max(0, Math.min(1, (p - P[i * 5 + 4]) / 0.65)));
      if (k <= 0) continue;
      var x = (P[i * 5 + 2] + (P[i * 5] - P[i * 5 + 2]) * k) | 0, y = (P[i * 5 + 3] + (P[i * 5 + 1] - P[i * 5 + 3]) * k) | 0;
      var c = C[i];
      for (var dy = 0; dy < sz; dy++) {
        var yy = y + dy; if (yy < 0 || yy >= ch) continue;
        var row = yy * cw;
        for (var dx = 0; dx < sz; dx++) { var xx = x + dx; if (xx >= 0 && xx < cw) px[row + xx] = c; }
      }
    }
    it.ctx.putImageData(buf, 0, 0);
    it.host.classList.toggle('is-whole', p >= 0.999);
    it.canvas.style.opacity = p >= 0.999 ? '0' : '1';
  }
  function target(it) {
    var r = it.host.getBoundingClientRect(), vh = window.innerHeight;
    return Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.75)));
  }
  function tick() {
    raf = 0;
    var busy = false;
    items.forEach(function (it) {
      if (!it.host.isConnected) return;
      var t = target(it), d = t - it.p;
      it.p = Math.abs(d) < 0.002 ? t : it.p + d * 0.12;
      if (it.p !== it.shown) { draw(it); it.shown = it.p; }
      if (it.p !== t) busy = true;
    });
    if (busy) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick);

  window.particlesInit = function () {
    items = items.filter(function (it) { return it.host.isConnected; });
    if (reduce) return;
    document.querySelectorAll('[data-particles]').forEach(function (host) {
      if (host.classList.contains('has-particles')) return;
      var img = host.querySelector('img');
      if (!img) return;
      img.loading = 'eager';
      function go() { var it = build(host); if (it) { items.push(it); kick(); } }
      if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
    });
  };
  window.particlesInit();
})();
