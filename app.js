(function () {
  'use strict';
  const D = window.D, $ = id => document.getElementById(id);
  const f = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const sg = n => (n >= 0 ? '+' : '−') + f(Math.abs(n));
  const pc = (a, b) => { const c = (a / b - 1) * 100; return (c >= 0 ? '▲ ' : '▼ ') + f(Math.abs(c)) + '%'; };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const keys = Object.keys(D.c);
  const tot = k => D.c[k].t[0] + D.c[k].t[1];
  const ranked = keys.slice().sort((a, b) => tot(b) - tot(a));
  const top15 = ranked.slice(0, 15);
  const isoKey = {}; keys.forEach(k => { isoKey[D.c[k].i] = k; });
  const state = { sel: null, proj: 'eq', metric: 'tot' };

  // ---------- peta ----------
  const FONT = 'IBM Plex Sans, system-ui, sans-serif', BG = '#e4e9ef';
  const A = [118, -2], IDN_BB = [95, 141, -11, 6];
  const TYPE = { eq: 'equal earth', me: 'mercator' };
  const BLUE = [[0, '#eaf1fb'], [0.35, '#b7d3f6'], [0.7, '#2a78d6'], [1, '#0d366b']];
  const ORG = [[0, '#fdf0e9'], [0.35, '#f8c4ac'], [0.7, '#eb6834'], [1, '#8f3513']];
  const DIV = [[0, '#8f3513'], [0.2, '#eb6834'], [0.42, '#f8d5c5'], [0.5, '#f1f0ec'], [0.58, '#cfe0f6'], [0.8, '#2a78d6'], [1, '#0d366b']];
  const lg10 = v => Math.log10(v + 0.05);
  const MET = {
    tot: { val: c => c.t[0] + c.t[1], z: lg10, lo: -1.3, hi: 2.2, sc: BLUE, lg: ['0,1', '100', 'US$ miliar'], cap: 'Warna negara = total dagang 2025 (ekspor + impor), skala logaritma' },
    ex: { val: c => c.t[0], z: lg10, lo: -1.3, hi: 2.0, sc: BLUE, lg: ['0,1', '100', 'US$ miliar'], cap: 'Warna negara = nilai ekspor Indonesia ke negara itu, 2025' },
    im: { val: c => c.t[1], z: lg10, lo: -1.3, hi: 2.0, sc: ORG, lg: ['0,1', '100', 'US$ miliar'], cap: 'Warna negara = nilai impor Indonesia dari negara itu, 2025' },
    bal: { val: c => c.t[0] - c.t[1], z: x => Math.sign(x) * Math.log10(1 + Math.abs(x) * 5), lo: -2.2, hi: 2.2, sc: DIV, lg: ['defisit', 'surplus', ''], cap: 'Biru = surplus bagi Indonesia, oranye = defisit (ekspor dikurangi impor), 2025' }
  };
  const base = { showland: true, landcolor: '#fcfcfb', showocean: false, showlakes: false, showcountries: true, countrycolor: '#c3c2ba', countrywidth: 0.5, showcoastlines: true, coastlinecolor: '#b3b2aa', coastlinewidth: 0.5, showframe: false, bgcolor: BG, domain: { x: [0, 1], y: [0, 1] } };
  const gray = { ...base, landcolor: '#ecebe6', countrycolor: '#fff', countrywidth: 0.6, coastlinecolor: '#d6d5cd' };
  const mk = (geo, w, h) => ({ geo, width: w, height: h, margin: { l: 0, r: 0, t: 0, b: 0 }, paper_bgcolor: BG, dragmode: false, font: { family: FONT }, hoverlabel: { bgcolor: '#fcfcfb', bordercolor: '#c3c2ba', font: { family: FONT, size: 12, color: '#0b0b0b' } } });
  const CFG = { displayModeBar: false, scrollZoom: false, doubleClick: false, showTips: false };
  const flat = col => ({ colorscale: [[0, col], [1, col]], zmin: 0, zmax: 1, showscale: false });
  const idnPoly = () => ({ type: 'choropleth', locationmode: 'ISO-3', locations: ['IDN'], z: [1], ...flat('#0d366b'), hoverinfo: 'skip', marker: { line: { color: '#fff', width: 0.5 } } });
  const dotTrace = (lon, lat, size, color) => ({ type: 'scattergeo', mode: 'markers', lon: [lon], lat: [lat], marker: { size, color, line: { color: '#fff', width: 2 } }, hoverinfo: 'skip', showlegend: false });
  const hoverText = k => { const c = D.c[k]; return '<b>' + esc(c.n) + '</b><br>Ekspor ' + f(c.t[0]) + ' · Impor ' + f(c.t[1]) + '<br>Neraca ' + sg(c.t[0] - c.t[1]) + ' (US$ miliar)'; };

  const mapBox = $('map'), wrap = $('wrap'), plot = $('plot'), ov = $('ov'), chips = $('chips'), mini = $('mini');
  const LAT = { eq: [-90, 90], me: [-58, 75] }, TOP = 44, BOT = 20; // pita atas (tombol kembali) dan bawah (keterangan) yang dikosongkan
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  // view: kanvas tetap untuk ukuran+proyeksi saat ini; cam: kamera yang sedang tampil {lon, lat, k}
  let token = 0, raf = 0, view = null, cam = null;

  function globalTraces() {
    const m = MET[state.metric], poly = keys.filter(k => !D.c[k].pt), pts = keys.filter(k => D.c[k].pt && D.c[k].ll);
    const t = [{ type: 'choropleth', locationmode: 'ISO-3', locations: poly.map(k => D.c[k].i), z: poly.map(k => m.z(m.val(D.c[k]))), text: poly.map(hoverText), hovertemplate: '%{text}<extra></extra>', zmin: m.lo, zmax: m.hi, colorscale: m.sc, showscale: false, marker: { line: { color: '#fff', width: 0.4 } } }];
    if (pts.length) t.push({ type: 'scattergeo', mode: 'markers', lon: pts.map(k => D.c[k].ll[0]), lat: pts.map(k => D.c[k].ll[1]), customdata: pts, text: pts.map(hoverText), hovertemplate: '%{text}<extra></extra>', showlegend: false, marker: { size: 8, color: pts.map(k => m.z(m.val(D.c[k]))), colorscale: m.sc, cmin: m.lo, cmax: m.hi, showscale: false, line: { color: '#fff', width: 1 } } });
    t.push(dotTrace(A[0], A[1], 11, '#0d366b'));
    return t;
  }
  function zoomTraces(k) {
    const c = D.c[k], poly = keys.filter(x => !D.c[x].pt);
    const clear = [[0, 'rgba(255,255,255,0.01)'], [1, 'rgba(255,255,255,0.01)']];
    const t = [{ type: 'choropleth', locationmode: 'ISO-3', locations: poly.map(x => D.c[x].i), z: poly.map(() => 0), zmin: 0, zmax: 1, colorscale: clear, showscale: false, text: poly.map(hoverText), hovertemplate: '%{text}<extra></extra>', marker: { line: { width: 0 } } }];
    if (!c.pt) t.push({ type: 'choropleth', locationmode: 'ISO-3', locations: [c.i], z: [MET.tot.z(tot(k))], zmin: -1.3, zmax: 2.2, colorscale: BLUE, showscale: false, text: [hoverText(k)], hovertemplate: '%{text}<extra></extra>', marker: { line: { color: '#0b0b0b', width: 2.2 } } });
    t.push(idnPoly());
    return t;
  }

  const unwrap = lon => 118 + ((lon - 118 + 540) % 360) - 180;
  function bounds(k) {
    const c = D.c[k], sh = unwrap(c.ll[0]) - c.ll[0], bb = c.bb || [c.ll[0] - 1, c.ll[0] + 1, c.ll[1] - 1, c.ll[1] + 1];
    return { lon: [Math.min(IDN_BB[0], bb[0] + sh), Math.max(IDN_BB[1], bb[1] + sh)], lat: [Math.min(IDN_BB[2], bb[2]), Math.max(IDN_BB[3], bb[3])], sh };
  }
  const sub = () => plot._fullLayout.geo._subplot, gp = () => sub().projection;
  const n180 = x => ((x % 360) + 540) % 360 - 180;
  const sw = v => 2.5 + 9 * Math.sqrt(v / 90);
  const bez = (p0, c, p1, t) => { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; };
  // panah melengkung p0 -> p1 dalam piksel; berhenti `stop` px sebelum ujung, kepala segitiga di ujungnya
  function arrow(p0, p1, w, stop) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const c = [(p0[0] + p1[0]) / 2 + nx * 0.2 * L, (p0[1] + p1[1]) / 2 + ny * 0.2 * L], d = (q, r) => Math.hypot(q[0] - r[0], q[1] - r[1]);
    let te = 1; while (te > 0.5 && d(bez(p0, c, p1, te), p1) < stop) te -= 0.005;
    const tip = bez(p0, c, p1, te), u = 1 - te, tx = 2 * u * (c[0] - p0[0]) + 2 * te * (p1[0] - c[0]), ty = 2 * u * (c[1] - p0[1]) + 2 * te * (p1[1] - c[1]), tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
    const hl = 11 + w * 1.3, hw = 5.5 + w * 0.8, bx = tip[0] - ux * hl, by = tip[1] - uy * hl;
    let tb = te; while (tb > 0.05 && d(bez(p0, c, p1, tb), tip) < hl * 0.8) tb -= 0.005;
    const e = bez(p0, c, p1, tb), c2 = [p0[0] + (c[0] - p0[0]) * tb, p0[1] + (c[1] - p0[1]) * tb], mid = bez(p0, c, p1, 0.5);
    const n1 = v => v.toFixed(1);
    return { d: 'M' + n1(p0[0]) + ' ' + n1(p0[1]) + ' Q' + n1(c2[0]) + ' ' + n1(c2[1]) + ' ' + n1(e[0]) + ' ' + n1(e[1]),
      head: 'M' + n1(tip[0]) + ' ' + n1(tip[1]) + ' L' + n1(bx - uy * hw) + ' ' + n1(by + ux * hw) + ' L' + n1(bx + uy * hw) + ' ' + n1(by - ux * hw) + ' Z', mid, o: [nx, ny], w };
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  function chip(cls, html, x, y, tx, ty) {
    const s = document.createElement('span'); s.className = 'ac fi ' + cls; s.innerHTML = html;
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.transform = 'translate(' + tx + ',' + ty + ')'; chips.appendChild(s);
  }
  function sideChip(a, cls, html) {
    const e = a.w / 2 + 8, x = a.mid[0] + a.o[0] * e, y = a.mid[1] + a.o[1] * e, hz = Math.abs(a.o[0]) >= Math.abs(a.o[1]);
    chip(cls, html, x.toFixed(1), y.toFixed(1), hz ? (a.o[0] > 0 ? '0' : '-100%') : '-50%', hz ? '-50%' : (a.o[1] > 0 ? '0' : '-100%'));
  }
  function clearOverlay() { ov.replaceChildren(); chips.replaceChildren(); }
  function overlay(P, k) {
    const c = D.c[k], sh = bounds(k).sh, a = P(A), q = P([c.ll[0] + sh, c.ll[1]]);
    const eA = arrow(a, q, sw(c.t[0]), 12), iA = arrow(q, a, sw(c.t[1]), 12);
    for (const [ar, col] of [[eA, '#2a78d6'], [iA, '#eb6834']]) {
      // panah "tergambar" dari pangkal ke ujung (CSS .drw memakai panjang lintasan --l)
      const p = ov.appendChild(svgEl('path', { class: 'fl drw', d: ar.d, stroke: col, 'stroke-width': ar.w.toFixed(1) }));
      p.style.setProperty('--l', p.getTotalLength().toFixed(1));
      ov.appendChild(svgEl('path', { class: 'fi', d: ar.head, fill: col }));
      ov.appendChild(svgEl('path', { class: 'dsh', d: ar.d }));
    }
    ov.appendChild(svgEl('circle', { class: 'fi f0', cx: a[0], cy: a[1], r: 5.5, fill: '#0d366b', stroke: '#fff', 'stroke-width': 2 }));
    ov.appendChild(svgEl('circle', { class: 'fi f0', cx: q[0], cy: q[1], r: 6.5, fill: '#eb6834', stroke: '#fff', 'stroke-width': 2 }));
    sideChip(eA, 'cb', 'Ekspor <b>' + f(c.t[0]) + '</b>');
    sideChip(iA, 'co', 'Impor <b>' + f(c.t[1]) + '</b>');
    chip('nm0', '<b>' + esc(c.n) + '</b>', q[0].toFixed(1), (q[1] - 24).toFixed(1), '-50%', '-50%');
    return [a, q];
  }
  function setBox(W, H, ox, oy) {
    for (const el of [wrap, plot, chips]) { el.style.width = W + 'px'; el.style.height = H + 'px'; }
    wrap.style.left = -ox + 'px'; wrap.style.top = -oy + 'px';
    ov.setAttribute('width', W); ov.setAttribute('height', H); ov.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  function bindClick() {
    plot.on('plotly_click', e => {
      const p = e.points && e.points[0]; if (!p) return;
      const k = p.customdata || isoKey[p.location];
      if (k && D.c[k]) select(k === state.sel ? null : k);
    });
  }
  async function drawMini(k, my) {
    const c = D.c[k], b = bounds(k), midLon = (b.lon[0] + b.lon[1]) / 2, ring = [];
    const edge = (a, z) => { for (let i = 0; i < 24; i++) ring.push([a[0] + (z[0] - a[0]) * i / 24, a[1] + (z[1] - a[1]) * i / 24]); };
    const [lo, hi, la0, la1] = [b.lon[0], b.lon[1], b.lat[0], b.lat[1]];
    edge([lo, la0], [hi, la0]); edge([hi, la0], [hi, la1]); edge([hi, la1], [lo, la1]); edge([lo, la1], [lo, la0]); ring.push([lo, la0]);
    const t = [];
    if (!c.pt) t.push({ type: 'choropleth', locationmode: 'ISO-3', locations: [c.i], z: [1], ...flat('#2a78d6'), hoverinfo: 'skip', marker: { line: { color: '#fff', width: 0.3 } } });
    t.push(idnPoly(), { type: 'scattergeo', mode: 'lines', lon: ring.map(p => p[0]), lat: ring.map(p => p[1]), fill: 'toself', fillcolor: 'rgba(13,54,107,.12)', line: { color: '#0b0b0b', width: 2 }, hoverinfo: 'skip', showlegend: false });
    const mw = mapBox.clientHeight < 380 ? 190 : 240, mh = Math.round(mw * 0.517);
    mini.style.width = mw + 'px'; mini.style.height = mh + 'px'; Plotly.purge(mini);
    await Plotly.newPlot(mini, t, mk({ ...gray, projection: { type: 'equal earth', rotation: { lon: midLon }, scale: 1 } }, mw - 4, mh - 4), { staticPlot: true, displayModeBar: false });
    return my === token;
  }
  // peta mini di pojok yang tidak menutupi titik Indonesia, negara terpilih, atau tombol kembali (kiri atas)
  function placeMini(pts, w, h) {
    const mw = mapBox.clientHeight < 380 ? 190 : 240, mh = Math.round(mw * 0.517), m = 12, pad = 50;
    const spots = [['left', 'bottom'], ['right', 'top'], ['left', 'top']];
    const rect = ([x, y]) => [x === 'left' ? m : w - m - mw, y === 'top' ? (x === 'left' ? TOP : m) : h - m - mh];
    const hits = sp => { const [rx, ry] = rect(sp); return pts.filter(p => p[0] > rx - pad && p[0] < rx + mw + pad && p[1] > ry - pad && p[1] < ry + mh + pad).length; };
    const best = spots.map(sp => [hits(sp), sp]).sort((a, b) => a[0] - b[0])[0][1], [rx, ry] = rect(best);
    mini.style.left = rx + 'px'; mini.style.top = ry + 'px'; mini.style.right = mini.style.bottom = 'auto';
  }

  // ---------- kamera ----------
  const lay = (zoom, v) => mk({ ...(zoom ? gray : base), projection: { type: TYPE[state.proj], rotation: { lon: n180(v.lon) }, scale: v.k }, center: { lon: n180(v.lon), lat: v.lat }, lataxis: { range: LAT[state.proj] } }, view.RW, view.RH);
  // Plotly memotong peta ke persegi dunia (clipExtent) sesuai ukuran kanvas saat dibuat. Kanvas dibuat sekali,
  // diperbesar lalu dipotong .map supaya potongan itu selalu menutupi kotak; ukurannya tetap selama animasi.
  // Kecocokan (fitScale, persegi dunia) tidak bergantung pada rotasi/pusat/skala, jadi kamera bebas digerakkan.
  async function setup(my, w, h) {
    view = null; clearOverlay(); setBox(w, h, 0, 0); Plotly.purge(plot);
    await Plotly.newPlot(plot, globalTraces(), mk({ ...base, projection: { type: TYPE[state.proj] }, lataxis: { range: LAT[state.proj] } }, w, h), CFG);
    if (my !== token) return false;
    bindClick();
    const s0 = sub(), M = s0.bounds, f0 = s0.fitScale, lat = plot._fullLayout.geo.center.lat;
    const sc = Math.max(1, w / (M[1][0] - M[0][0]), h / (M[1][1] - M[0][1]));
    const RW = Math.ceil(w * sc), RH = Math.ceil(h * sc), ox = (RW - w) / 2, oy = (RH - h) / 2;
    setBox(RW, RH, ox, oy);
    await Plotly.relayout(plot, { width: RW, height: RH, 'geo.projection.scale': 1 / sc });
    if (my !== token) return false;
    const s1 = sub(), M1 = s1.bounds;
    // ppd: piksel per derajat bujur di khatulistiwa pada skala 1; home: tampilan dunia penuh seperti peta global biasa
    view = { key: state.proj + w + 'x' + h, w, h, RW, RH, ox, oy, ppd: (M1[1][0] - M1[0][0]) / 360, home: { lon: 0, lat, k: f0 / s1.fitScale } };
    cam = { ...view.home };
    return true;
  }
  // kamera yang membingkai Indonesia + negara k di antara pita atas dan bawah
  function target(k) {
    const b = bounds(k), lon = (b.lon[0] + b.lon[1]) / 2, lat = (b.lat[0] + b.lat[1]) / 2;
    const s = sub(), P = s.projection, r0 = P.rotate(), c0 = P.center(), k0 = P.scale(), xs = [], ys = [];
    P.rotate([-lon, 0, 0]).center([0, lat]).scale(s.fitScale);
    for (const lo of [b.lon[0], lon, b.lon[1]]) for (const la of [b.lat[0], lat, b.lat[1]]) { const p = P([lo, la]); xs.push(p[0]); ys.push(p[1]); }
    const z = Math.max(1, Math.min(view.w * 0.8 / (Math.max(...xs) - Math.min(...xs)), (view.h - TOP - BOT) * 0.88 / (Math.max(...ys) - Math.min(...ys))));
    P.scale(s.fitScale * z);
    const cl = P.invert([s.midPt[0], s.midPt[1] - (TOP - BOT) / 2])[1];
    P.rotate(r0).center(c0).scale(k0);
    return { lon, lat: cl, k: z };
  }
  // pasang kamera langsung ke proyeksi Plotly lalu gambar ulang path saja (cara yang sama dipakai zoom bawaan Plotly).
  // fast: selama terbang hanya daratan, negara terpilih, dan Indonesia yang digambar ulang; batas negara, garis pantai,
  // dan lapisan hover disembunyikan lewat .fly (CSS) lalu muncul lagi setelah mendarat. Hemat ±2/3 kerja per frame.
  function apply(v, fast) {
    const s = sub(), P = s.projection.rotate([-v.lon, 0, 0]).center([0, v.lat]).scale(s.fitScale * v.k);
    if (!fast) return s.render();
    const path = P.getPath();
    if (s.basePaths.land) s.basePaths.land.attr('d', path);
    plot.querySelectorAll('.choroplethlayer .trace:not(:first-child) path').forEach(e => e.setAttribute('d', path(e.__data__.geojson) || ''));
  }
  // jalur zoom-pan halus van Wijk & Nuij (seperti d3.interpolateZoom); p = [lon, lat, lebar pandang dalam derajat]
  function zpath(p0, p1) {
    const [x0, y0, w0] = p0, [x1, y1, w1] = p1, dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy, R = Math.SQRT2;
    if (d2 < 1e-6) { const S = Math.log(w1 / w0) / R, f = t => [x0 + t * dx, y0 + t * dy, w0 * Math.exp(R * t * S)]; f.S = Math.abs(S); return f; }
    const d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (4 * w0 * d1), b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (4 * w1 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), S = (r1 - r0) / R;
    const f = t => { const s = t * S, u = w0 / (2 * d1) * (Math.cosh(r0) * Math.tanh(R * s + r0) - Math.sinh(r0)); return [x0 + u * dx, y0 + u * dy, w0 * Math.cosh(r0) / Math.cosh(R * s + r0)]; };
    f.S = S; return f;
  }
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // luncurkan kamera dari cam ke `to`; berhenti diam-diam kalau token berganti (pilihan baru mulai dari cam terkini)
  function glide(to, my) {
    const W = k => view.w / (view.ppd * k), path = zpath([cam.lon, cam.lat, W(cam.k)], [to.lon, to.lat, W(to.k)]);
    const dur = path.S < 0.01 ? 0 : Math.min(1500, 600 + 400 * path.S);
    mapBox.classList.add('fly');
    return new Promise(res => {
      let t0 = 0;
      const step = now => {
        if (my !== token) return res();
        t0 = t0 || now;
        const t = dur ? Math.min(1, (now - t0) / dur) : 1, p = path(ease(t));
        cam = t < 1 ? { lon: p[0], lat: p[1], k: view.w / (view.ppd * p[2]) } : { ...to };
        apply(cam, t < 1);
        if (t < 1) raf = requestAnimationFrame(step); else { mapBox.classList.remove('fly'); res(); }
      };
      raf = requestAnimationFrame(step);
    });
  }
  async function drawMap(anim) {
    const my = ++token, w = mapBox.clientWidth, h = mapBox.clientHeight;
    if (!w || !h) return;
    cancelAnimationFrame(raf);
    mapBox.classList.add('mv');
    if (view) Plotly.Fx.unhover(plot); // label hover lama tidak ikut terbang
    if (!view || view.key !== state.proj + w + 'x' + h) { if (!(await setup(my, w, h))) return; }
    const k = state.sel, c = k && D.c[k], zoom = !!(c && c.ll), to = zoom ? target(k) : { ...view.home }, fly = anim && !RM.matches;
    to.lon = cam.lon + n180(to.lon - cam.lon); // bujur lewat jalur terpendek (melintasi garis tanggal bila perlu)
    if (fly) {
      // ganti data dulu (abu-abu + negara terpilih), kamera belakangan
      if (zoom) { await Plotly.react(plot, zoomTraces(k), lay(true, cam), CFG); if (my !== token) return; }
      await glide(to, my); if (my !== token) return;
    }
    // tanpa animasi, atau mendarat di global: pasang data + kamera akhir sekaligus (warna choropleth global muncul di sini)
    if (!fly || !zoom) { cam = to; mapBox.classList.remove('fly'); await Plotly.react(plot, zoom ? zoomTraces(k) : globalTraces(), lay(zoom, cam), CFG); if (my !== token) return; }
    clearOverlay();
    if (!zoom) { mini.classList.add('hide'); mapBox.classList.remove('mv'); return; }
    const pts = overlay(gp(), k).map(p => [p[0] - view.ox, p[1] - view.oy]);
    placeMini(pts, w, h);
    mini.classList.add('fo'); mini.classList.remove('hide'); mapBox.classList.remove('mv');
    if (await drawMini(k, my)) mini.classList.remove('fo');
  }

  // ---------- panel ----------
  function kpis() {
    const k = state.sel, c = k && D.c[k], t = c ? c.t : D.tot, nm = c ? c.n : '';
    const T = D.tot[0] + D.tot[1];
    const list = c ? [
      ['Ekspor RI ke ' + nm, f(t[0]), pc(t[0], t[2]) + ' dari ' + f(t[2]) + ' (2024)', ''],
      ['Impor RI dari ' + nm, f(t[1]), pc(t[1], t[3]) + ' dari ' + f(t[3]) + ' (2024)', ''],
      ['Neraca bilateral', sg(t[0] - t[1]), 'dari ' + sg(t[2] - t[3]) + ' (2024)', 'dk'],
      ['Total perdagangan', f(t[0] + t[1]), pc(t[0] + t[1], t[2] + t[3]) + ' dari ' + f(t[2] + t[3]) + ' (2024)', ''],
      ['Peringkat mitra', '#' + (ranked.indexOf(k) + 1), f((t[0] + t[1]) / T * 100) + '% dari total perdagangan RI', '']
    ] : [
      ['Ekspor 2025', f(t[0]), pc(t[0], t[2]) + ' dari ' + f(t[2]) + ' (2024)', ''],
      ['Impor 2025', f(t[1]), pc(t[1], t[3]) + ' dari ' + f(t[3]) + ' (2024)', ''],
      ['Neraca (ekspor − impor)', sg(t[0] - t[1]), pc(t[0] - t[1], t[2] - t[3]) + ' dari ' + sg(t[2] - t[3]) + ' (2024)', 'dk'],
      ['Total perdagangan', f(t[0] + t[1]), pc(t[0] + t[1], t[2] + t[3]) + ' dari ' + f(t[2] + t[3]) + ' (2024)', ''],
      ['Mitra terbesar', D.c[ranked[0]].n, f(tot(ranked[0]) / T * 100) + '% dari total perdagangan RI', '']
    ];
    $('kpis').innerHTML = list.map(([l, v, d, cls]) => '<div class="kp ' + cls + '"><span class="l">' + esc(l) + '</span><span class="v">' + esc(v) + '</span><span class="d">' + esc(d) + '</span></div>').join('');
  }
  function rows() {
    const mx = Math.max(...top15.map(k => Math.max(D.c[k].t[0], D.c[k].t[1])));
    $('rows').innerHTML = top15.map(k => {
      const e = D.c[k].t[0], i = D.c[k].t[1];
      return '<button class="r' + (k === state.sel ? ' on' : '') + '" type="button" data-k="' + k + '"><div class="lf"><span>' + f(i) + '</span><i style="width:' + (i / mx * 62) + '%"></i></div><span class="nm">' + esc(D.c[k].n) + '</span><div class="rt"><i style="width:' + (e / mx * 62) + '%"></i><span>' + f(e) + '</span></div><span class="bl">' + sg(e - i) + '</span></button>';
    }).join('');
  }
  function products() {
    const k = state.sel, c = k && D.c[k], P = c ? c.p : D.w, t = c ? c.t : D.tot;
    const mkList = (slot, color, total) => {
      const rs = Object.keys(P).map(ch => [D.ch[ch] || ('HS ' + ch), P[ch][slot], P[ch][slot + 2]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
      return rs.map((r, i) => {
        const cur = r[1], prev = r[2];
        let chg, cls;
        if (prev < 0.005) { chg = cur < 0.005 ? '–' : 'baru'; cls = 'nw'; }
        else { const q = (cur / prev - 1) * 100; chg = (q >= 0 ? '▲' : '▼') + f(Math.abs(q)) + '%'; cls = q >= 0 ? 'up' : 'dn'; }
        return '<div class="dr"><span class="rk' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span><span class="nm2" title="' + esc(r[0]) + '">' + esc(r[0]) + '</span><div class="tr2"><i style="width:' + (cur / (rs[0][1] || 1) * 100) + '%;background:' + color + '"></i></div><span class="pv">' + f(cur, cur < 1 ? 2 : 1) + '</span><span class="ps">' + f(cur / total * 100) + '%</span><span class="chip ' + cls + '">' + chg + '</span></div>';
      }).join('');
    };
    $('expP').innerHTML = mkList(0, '#2a78d6', t[0]);
    $('impP').innerHTML = mkList(1, '#eb6834', t[1]);
    $('expTitle').textContent = c ? 'Ekspor RI ke ' + c.n + ': produk teratas' : 'Produk ekspor teratas';
    $('impTitle').textContent = c ? 'Impor RI dari ' + c.n + ': produk teratas' : 'Produk impor teratas';
  }
  function chrome() {
    const k = state.sel, c = k && D.c[k], zoom = !!(c && c.ll), m = MET[state.metric];
    $('back').classList.toggle('hide', !zoom); $('tail').classList.toggle('hide', !c); $('tailNm').textContent = c ? c.n : '';
    $('gBtn').classList.toggle('on', !c); $('cBtn').classList.toggle('on', !!c);
    $('cBtn').textContent = c ? 'Negara: ' + c.n : 'Klik negara untuk detail';
    $('cBtn').title = c ? c.n : '';
    $('metSeg').classList.toggle('hide', zoom);
    $('lgd').classList.toggle('hide', zoom);
    $('mapSub').textContent = zoom ? 'zoom ke Indonesia dan mitra · panah bergerak, tebal = nilai' : c ? 'negara ini terlalu kecil untuk tampil di peta' : 'klik negara di peta atau di daftar kanan';
    const cap = $('cap'); cap.classList.toggle('capr', zoom);
    cap.textContent = zoom ? 'Biru = ekspor RI, oranye = impor RI (US$ miliar). Klik negara lain untuk pindah, klik lagi untuk kembali.' : m.cap;
    const grad = 'linear-gradient(90deg,' + m.sc.map(([p, col]) => col + ' ' + p * 100 + '%').join(',') + ')';
    $('lgd').innerHTML = '<span>' + m.lg[0] + '</span><i style="background:' + grad + '"></i><span>' + m.lg[1] + '</span>' + (m.lg[2] ? '<span>' + m.lg[2] + '</span>' : '');
    document.querySelectorAll('#projSeg .sg').forEach(b => b.classList.toggle('on', b.dataset.p === state.proj));
    document.querySelectorAll('#metSeg .sg').forEach(b => b.classList.toggle('on', b.dataset.m === state.metric));
  }
  function render(redraw = true) { chrome(); kpis(); rows(); products(); if (redraw) drawMap(true); }
  function select(k) {
    state.sel = k;
    try { history.replaceState(null, '', k ? '#' + k : location.pathname + location.search); } catch (e) { /* file:// atau iframe */ }
    render();
  }

  // ---------- event ----------
  $('rows').addEventListener('click', e => { const b = e.target.closest('.r'); if (b) select(b.dataset.k === state.sel ? null : b.dataset.k); });
  $('back').addEventListener('click', () => select(null));
  $('gBtn').addEventListener('click', () => select(null));
  $('projSeg').addEventListener('click', e => { const b = e.target.closest('.sg'); if (b) { state.proj = b.dataset.p; render(); } });
  $('metSeg').addEventListener('click', e => { const b = e.target.closest('.sg'); if (b) { state.metric = b.dataset.m; render(); } });
  const byName = {}; keys.forEach(k => { byName[D.c[k].n.toLowerCase()] = k; });
  $('dl').innerHTML = keys.map(k => D.c[k].n).sort((a, b) => a.localeCompare(b, 'id')).map(n => '<option value="' + esc(n) + '">').join('');
  $('srch').addEventListener('change', e => { const k = byName[e.target.value.trim().toLowerCase()]; if (k) { select(k); e.target.value = ''; e.target.blur(); } });
  let rt, lw = 0, lh = 0;
  new ResizeObserver(() => {
    if (mapBox.clientWidth === lw && mapBox.clientHeight === lh) return;
    lw = mapBox.clientWidth; lh = mapBox.clientHeight;
    clearTimeout(rt); rt = setTimeout(() => drawMap(false), 150);
  }).observe(mapBox);

  const h0 = decodeURIComponent((location.hash || '').slice(1));
  if (D.c[h0]) state.sel = h0;
  render(false);
})();
