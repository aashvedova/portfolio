/* Vector basemap for Leaflet: draws OpenStreetMap data (roads, rail, water, woods, place names)
   from a bundled JSON into canvas tiles. Monochrome styling, light and dark palettes. */
(function(){
  const PAL = {
    light: { bg:'#e6e7ea', wood:'#dcdedc', park:'#dfe1df', water:'#cdcfd4', river:'#cdcfd4', rail:'#b4b5b9', casing:'#b9babe', road:'#fbfbfc', minor:'#d9dadd', label:'#3f3f44', halo:'rgba(230,231,234,.95)' },
    dark:  { bg:'#1b1c21', wood:'#202126', park:'#1f2025', water:'#121317', river:'#121317', rail:'#33353d', casing:'#3a3c45', road:'#2a2c34', minor:'#24262d', label:'#a9abb4', halo:'rgba(27,28,33,.95)' }
  };
  let data = null, dark = false, layers = [];
  const R = 6378137;
  const toWorld = (lat, lng) => { const s = Math.sin(lat * Math.PI / 180); return [ (lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) ]; };
  function decode(enc){ const out = []; let y = 0, x = 0; for (let i = 0; i < enc.length; i += 2) { y += enc[i]; x += enc[i + 1]; const w = toWorld(y / 1e5, x / 1e5); out.push(w[0], w[1]); } return out; }
  const ORDER = ['wood', 'park', 'water', 'river', 'rail', 'tertiary', 'secondary', 'primary', 'motorway'];
  const GRID = 96; let gx0 = 0, gy0 = 0, gw = 1, gh = 1; const cells = new Map();
  function index(){
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    data.feats.forEach(f => { minx = Math.min(minx, f.b[0]); miny = Math.min(miny, f.b[1]); maxx = Math.max(maxx, f.b[2]); maxy = Math.max(maxy, f.b[3]); });
    gx0 = minx; gy0 = miny; gw = (maxx - minx) / GRID; gh = (maxy - miny) / GRID;
    data.feats.forEach((f, i) => { const cx0 = Math.floor((f.b[0] - gx0) / gw), cx1 = Math.floor((f.b[2] - gx0) / gw), cy0 = Math.floor((f.b[1] - gy0) / gh), cy1 = Math.floor((f.b[3] - gy0) / gh); for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) { const k = cx * 1000 + cy; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); } });
  }
  function prepare(j){
    const feats = [];
    ORDER.forEach(k => (j.layers[k] || []).forEach(enc => { const c = decode(enc); let b = [1, 1, 0, 0]; for (let i = 0; i < c.length; i += 2) { if (c[i] < b[0]) b[0] = c[i]; if (c[i + 1] < b[1]) b[1] = c[i + 1]; if (c[i] > b[2]) b[2] = c[i]; if (c[i + 1] > b[3]) b[3] = c[i + 1]; } feats.push({k, c, b}); }));
    data = { feats, places: j.places, attribution: j.attribution }; index(); return data;
  }
  // The data ships as a script (window.VMAP_DATA = {...}) so it works wherever scripts are allowed but fetch() is not.
  function load(url){
    if (window.VMAP_DATA) return Promise.resolve(prepare(window.VMAP_DATA));
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = () => window.VMAP_DATA ? res(prepare(window.VMAP_DATA)) : rej(new Error('данные карты не найдены')); s.onerror = () => rej(new Error('не удалось загрузить данные')); document.head.appendChild(s); });
  }
  const W = (z, k) => { // line widths by zoom
    const f = z >= 15 ? 2.9 : z >= 14 ? 2.3 : z >= 13 ? 1.75 : z >= 12 ? 1.3 : z >= 11 ? 1 : .7;
    return {motorway: 4.5 * f, primary: 3.2 * f, secondary: 2.2 * f, tertiary: 1.4 * f, rail: 1.2 * f, river: 1.6 * f}[k] || 1;
  };
  const Base = L.GridLayer.extend({
    createTile: function(coords){
      const tile = document.createElement('canvas'); const size = this.getTileSize(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      tile.width = size.x * dpr; tile.height = size.y * dpr; tile.style.width = size.x + 'px'; tile.style.height = size.y + 'px';
      const ctx = tile.getContext('2d'); ctx.scale(dpr, dpr); const P = PAL[dark ? 'dark' : 'light'];
      ctx.fillStyle = P.bg; ctx.fillRect(0, 0, size.x, size.y);
      if (!data) return tile;
      const z = coords.z, scale = Math.pow(2, z) * size.x, ox = coords.x * size.x, oy = coords.y * size.y;
      const wx0 = ox / scale, wy0 = oy / scale, wx1 = (ox + size.x) / scale, wy1 = (oy + size.y) / scale; const pad = 8 / scale;
      const cx0 = Math.max(0, Math.floor((wx0 - pad - gx0) / gw)), cx1 = Math.min(GRID, Math.floor((wx1 + pad - gx0) / gw)), cy0 = Math.max(0, Math.floor((wy0 - pad - gy0) / gh)), cy1 = Math.min(GRID, Math.floor((wy1 + pad - gy0) / gh));
      const seen = new Set(); const byKind = {}; ORDER.forEach(k => byKind[k] = []);
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) { const list = cells.get(cx * 1000 + cy); if (!list) continue; for (const i of list) { if (seen.has(i)) continue; seen.add(i); const f = data.feats[i]; if (f.b[2] < wx0 - pad || f.b[0] > wx1 + pad || f.b[3] < wy0 - pad || f.b[1] > wy1 + pad) continue; byKind[f.k].push(f); } }
      const path = (f, close) => { const c = f.c; ctx.beginPath(); ctx.moveTo(c[0] * scale - ox, c[1] * scale - oy); for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i] * scale - ox, c[i + 1] * scale - oy); if (close) ctx.closePath(); };
      const fill = (k, col) => { if (!byKind[k].length) return; ctx.fillStyle = col; byKind[k].forEach(f => { path(f, true); ctx.fill(); }); };
      const stroke = (k, col, w, dash) => { if (!byKind[k].length || w <= 0) return; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []); byKind[k].forEach(f => { path(f, false); ctx.stroke(); }); ctx.setLineDash([]); };
      if (z >= 9) { fill('wood', P.wood); fill('park', P.park); }
      fill('water', P.water); stroke('river', P.river, z >= 11 ? W(z, 'river') : 1);
      if (z >= 10) stroke('rail', P.rail, W(z, 'rail'), [6, 4]);
      const roads = z >= 13 ? ['tertiary', 'secondary', 'primary', 'motorway'] : z >= 11 ? ['secondary', 'primary', 'motorway'] : z >= 9 ? ['primary', 'motorway'] : ['motorway'];
      if (z >= 11) roads.forEach(k => stroke(k, P.casing, W(z, k) + (z >= 13 ? 2.4 : 1.6)));        // casing
      roads.forEach(k => stroke(k, z >= 11 ? P.road : P.casing, W(z, k)));       // fill
      return tile;
    }
  });
  function labelsLayer(map){
    const g = L.layerGroup(); if (!data) return g;
    data.places.forEach(p => { const m = L.marker(p.p, { icon: L.divIcon({ className: 'vlbl c-' + p.c, html: '<span>' + p.n + '</span>', iconSize: [0, 0] }), interactive: false, keyboard: false }); g.addLayer(m); });
    return g;
  }
  function create(el, opts = {}){
    const map = L.map(el, { zoomControl: opts.zoomControl !== false, attributionControl: false, dragging: opts.interactive !== false, scrollWheelZoom: opts.interactive !== false, doubleClickZoom: opts.interactive !== false, touchZoom: opts.interactive !== false, boxZoom: false, keyboard: opts.interactive !== false, minZoom: opts.minZoom || 8, maxZoom: opts.maxZoom || 16, zoomSnap: .5, wheelPxPerZoomLevel: 90, fadeAnimation: true, zoomAnimation: true, inertiaMaxSpeed: 1500, maxBounds: opts.maxBounds || [[55.2, 36.7], [56.35, 38.85]], maxBoundsViscosity: .6 });
    el.classList.add('vmap'); el.classList.toggle('dark', dark); map.setView(opts.center || [55.75, 37.62], opts.zoom || 10);
    const base = new Base({ tileSize: 256, updateWhenIdle: false, keepBuffer: 3, className: 'vtiles' }); base.addTo(map); layers.push(base);
    if (opts.labels !== false) { const lg = labelsLayer(map); lg.addTo(map); map._vlabels = lg; }
    const setZ = () => { el.dataset.z = Math.round(map.getZoom()); }; map.on('zoomend', setZ); setZ();
    if (opts.attribution !== false) L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution(data ? data.attribution : '© OpenStreetMap contributors').addTo(map);
    map._vbase = base; return map;
  }
  function setDark(v){ dark = !!v; layers.forEach(l => l.redraw()); document.querySelectorAll('.vmap').forEach(el => el.classList.toggle('dark', dark)); }
  window.VMap = { load, create, setDark, toWorld, get data(){ return data; } };
})();

