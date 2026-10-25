/* MX Tycoon - DOM helpers and pixel-art icon set (drawn on canvas from pixel maps). */
(function (MX) {
  'use strict';

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  const PAL = {
    k: '#1a1410', w: '#ffffff', l: '#c8c8c8', s: '#8a8a8a', S: '#4a4a4a', o: '#ff6a13', y: '#ffd22e', r: '#e53935', R: '#9c1f1f',
    g: '#5cc26a', G: '#2e7d32', b: '#42a5f5', B: '#1e5aa8', n: '#b07a45', N: '#6b4a2b', p: '#f2c094', c: '#7fdcff', m: '#ffe9a8', v: '#ab47bc'
  };
  const ICONS = {
    track: [
      '............', '...kkkkkk...', '.kknnnnnnkk.', 'knnkkkkkknnk', 'knk......knk', 'knk..kk..knk',
      'knk..kk..knk', 'knk......knk', 'knnkkkkkknnk', '.kknnnnnnkk.', '...kkkkkk...', '............'],
    terrain: [
      '............', '............', '.....kk.....', '....kggk....', '...kgggGk...', '..kggGgGGk..',
      '.kgggGGGGGk.', 'kgnngGGnnGGk', 'knnnnnnnnnnk', 'knNNnnnNNnnk', 'kkkkkkkkkkkk', '............'],
    build: [
      '.....kk.....', '....krrk....', '...krrrrk...', '..krrrrrrk..', '.krrrrrrrrk.', 'kkkkkkkkkkkk',
      '.kwwwwwwwwk.', '.kwbbwwnnwk.', '.kwbbwwnnwk.', '.kwwwwwnnwk.', '.kkkkkkkkkk.', '............'],
    path: [
      '............', '.kkkkkkkkk..', '.klllslllk..', '.klslllslk..', '.kkkkkkkkk..', '..klllslk...',
      '..klslllk...', '..kkkkkkk...', '...klllk....', '...klslk....', '...kkkkk....', '............'],
    decor: [
      '....kkkk....', '...kggggk...', '..kgggGggk..', '.kggGgggGgk.', '.kgggggGggk.', '.kgGggggggk.',
      '..kggGggGk..', '...kkggkk...', '.....kk.....', '.....nn.....', '....knnk....', '....kkkk....'],
    demolish: [
      '............', '............', '.kkkk.......', '.kyyk.......', '.kyykkkkkk..', 'kyyyyyyyyk..',
      'kyyyyyyyykkk', 'kyyyyyyyyksk', 'kkkkkkkkkksk', 'kSsSsSsSk.kk', '.kkkkkkkk...', '............'],
    staff: [
      '............', '..kk....kk..', '.kppk..kppk.', '.kppk..kppk.', '..kk....kk..', '.kook..kbbk.',
      'kookoookbbbk', 'kookoookbbbk', '.kook..kbbk.', '.kSSk..kSSk.', '.kSSk..kSSk.', '.kk.k..k.kk.'],
    finance: [
      '............', '....kkkk....', '..kkyyyykk..', '.kyyykkyyyk.', '.kyykyyyyyk.', '.kykkkkyyyk.',
      '.kyykyyyyyk.', '.kykkkkyyyk.', '.kyykyyyyyk.', '.kyyykkyyyk.', '..kkyyyykk..', '....kkkk....'],
    events: [
      '............', '.lkkkkkkkkk.', '.lwSwSwSwSk.', '.lSwSwSwSwk.', '.lwSwSwSwSk.', '.lSwSwSwSwk.',
      '.lkkkkkkkkk.', '.l..........', '.l..........', '.l..........', '.l..........', 'lll.........'],
    research: [
      '............', '....kkkk....', '....kssk....', '....kssk....', '....kssk....', '...kgsssk...',
      '..kgggggsk..', '.kggggggggk.', '.kgwgggggggk', '.kggggggggk.', '..kkkkkkkk..', '............'],
    objectives: [
      '............', '...kkkkkk...', '..krrrrrrk..', '.krrwwwwrrk.', '.krwwrrwwrk.', '.krwrrrrwrk.',
      '.krwrrrrwrk.', '.krwwrrwwrk.', '.krrwwwwrrk.', '..krrrrrrk..', '...kkkkkk...', '............'],
    park: [
      '............', '.kkkkkkkkkk.', '.koooooooook', '.kowwowwwook', '.kowwowooook', '.kowwowwwook',
      '.koooooooook', '.kkkkkkkkkk.', '.....kk.....', '.....kk.....', '....kkkk....', '............'],
    pause: ['............', '............', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '...kk..kk...', '............', '............'],
    play: ['............', '............', '...k........', '...kk.......', '...kkk......', '...kkkk.....', '...kkkk.....', '...kkk......', '...kk.......', '...k........', '............', '............'],
    fast: ['............', '............', '.k....k.....', '.kk...kk....', '.kkk..kkk...', '.kkkk.kkkk..', '.kkkk.kkkk..', '.kkk..kkk...', '.kk...kk....', '.k....k.....', '............', '............'],
    faster: ['............', '............', 'k...k...k...', 'kk..kk..kk..', 'kkk.kkk.kkk.', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk', 'kkk.kkk.kkk.', 'kk..kk..kk..', 'k...k...k...', '............', '............'],
    turbo: ['............', '.......kk...', '......kyk...', '.....kyyk...', '....kyyk....', '...kyyyyyk..', '..kyyyyyk...', '....kyyk....', '...kyyk.....', '...kyk......', '...kk.......', '............'],
    sound: ['............', '.....k......', '....kk...k..', '...kwk.k..k.', 'kkkwwk..k.k.', 'kwwwwk..k.k.', 'kwwwwk..k.k.', 'kkkwwk..k.k.', '...kwk.k..k.', '....kk...k..', '.....k......', '............'],
    mute: ['............', '.....k......', '....kk......', '...kwk......', 'kkkwwk.r...r', 'kwwwwk..r.r.', 'kwwwwk...r..', 'kkkwwk..r.r.', '...kwk.r...r', '....kk......', '.....k......', '............'],
    music: ['............', '....kkkkkkk.', '....kkkkkkk.', '....k.....k.', '....k.....k.', '....k.....k.', '....k.....k.', '..kkk...kkk.', '.kkkk..kkkk.', '.kkkk..kkkk.', '..kk....kk..', '............'],
    menu: ['............', '............', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '............', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '............', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '............', '............'],
    close: ['............', '.kk......kk.', '.kkk....kkk.', '..kkk..kkk..', '...kkkkkk...', '....kkkk....', '....kkkk....', '...kkkkkk...', '..kkk..kkk..', '.kkk....kkk.', '.kk......kk.', '............'],
    money: ['............', '.....kk.....', '...kkkkkk...', '..kgggggggk.', '..kgkkkkk...', '..kgggggk...', '...kkkkkgk..', '...kgggggk..', '..kkkkkkk...', '.....kk.....', '............', '............'],
    calendar: ['............', '..k.....k...', '.kkkkkkkkkk.', '.krrrrrrrrk.', '.kkkkkkkkkk.', '.kwwkwwkwwk.', '.kwwkwwkwwk.', '.kkkkkkkkkk.', '.kwwkwwkrrk.', '.kwwkwwkrrk.', '.kkkkkkkkkk.', '............'],
    star: ['............', '.....kk.....', '....kyyk....', '....kyyk....', 'kkkkyyyykkkk', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kyyyyk...', '..kyykkyyk..', '..kyk..kyk..', '..kk....kk..', '............'],
    visitor: ['............', '....kkkk....', '...kppppk...', '...kppppk...', '....kkkk....', '...kbbbbk...', '..kbbbbbbk..', '..kbkbbkbk..', '....kBBk....', '....kBBk....', '....kkkk....', '............'],
    rider: ['............', '...kkkkk....', '..kooooook..', '..kookkkkk..', '..koooooook.', '...kkkkkk...', '..k....k....', '.kkk..kkk...', 'kSSSkkSSSk..', 'kS.Sk.kS.Sk.', 'kSSSk.kSSSk.', '.kkk...kkk..'],
    sun: ['............', '.....y......', '..y..y..y...', '...ykkky....', '..kyyyyyk...', 'yykyyyyykyy.', '..kyyyyyk...', '...ykkky....', '..y..y..y...', '.....y......', '............', '............'],
    cloud: ['............', '............', '....kkkk....', '...kwwwwk...', '..kwwwwwwkk.', '.kwwwwwwwwwk', 'kwwwwwwwwwwk', 'kllwwwwwwllk', '.kkkkkkkkkk.', '............', '............', '............'],
    rain: ['............', '....kkkk....', '...klllllk..', '..kllllllkk.', '.kllllllllk.', 'kssssssssssk', '.kkkkkkkkkk.', '..b..b..b...', '.b..b..b....', '...b..b..b..', '..b..b..b...', '............'],
    storm: ['............', '....kkkk....', '...kSSSSk...', '..kSSSSSSkk.', '.kSSSSSSSSk.', 'kSSSSSSSSSSk', '.kkkkyykkkk.', '.....yy.....', '....yy......', '...yyyy.....', '.....yy.....', '.....y......'],
    heat: ['............', '..r..r..r...', '..r..r..r...', '...r..r..r..', '...r..r..r..', '..r..r..r...', '..r..r..r...', '............', '.kkkkkkkkkk.', '.krrrrrrrrk.', '.kkkkkkkkkk.', '............'],
    rotate: ['............', '...kkkkk....', '..k.....k...', '.k.......k..', '.k.......k..', '.k......kkk.', '.k.......k..', '.k..........', '..k.....k...', '...kkkkk....', '............', '............'],
    grid: ['............', '.k..k..k..k.', 'kkkkkkkkkkkk', '.k..k..k..k.', '.k..k..k..k.', 'kkkkkkkkkkkk', '.k..k..k..k.', '.k..k..k..k.', 'kkkkkkkkkkkk', '.k..k..k..k.', '.k..k..k..k.', '............'],
    save: ['............', '.kkkkkkkkkk.', '.kBlllllBBk.', '.kBlllllBBk.', '.kBlllllBBk.', '.kBBBBBBBBk.', '.kBBwwwwBBk.', '.kBBwkkwBBk.', '.kBBwkkwBBk.', '.kBBwwwwBBk.', '.kkkkkkkkkk.', '............'],
    warn: ['.....kk.....', '....kyyk....', '....kyyk....', '...kyyyyk...', '...kykkyk...', '..kyykkyyk..', '..kyykkyyk..', '.kyyykkyyyk.', '.kyyyyyyyyk.', 'kyyyykkyyyyk', 'kkkkkkkkkkkk', '............'],
    info: ['............', '...kkkkkk...', '..kbbbbbbk..', '.kbbbwwbbbk.', '.kbbbbbbbbk.', '.kbbbwwbbbk.', '.kbbbwwbbbk.', '.kbbbwwbbbk.', '.kbbbwwbbbk.', '..kbbbbbbk..', '...kkkkkk...', '............'],
    check: ['............', '............', '..........kk', '.........kgk', '........kgk.', 'kk.....kgk..', 'kgk...kgk...', '.kgk.kgk....', '..kgkgk.....', '...kgk......', '....k.......', '............'],
    cross: ['............', '.kk......kk.', '.krk....krk.', '..krk..krk..', '...krkkrk...', '....krrk....', '....krrk....', '...krkkrk...', '..krk..krk..', '.krk....krk.', '.kk......kk.', '............'],
    lock: ['............', '....kkkk....', '...k....k...', '...k....k...', '..kkkkkkkk..', '..kyyyyyyk..', '..kyykkyyk..', '..kyykkyyk..', '..kyyyyyyk..', '..kkkkkkkk..', '............', '............'],
    follow: ['............', '....kkkk....', '...kwwwwk...', '..kwkkkkwk..', '.kwkk..kkwk.', '.kwk.kk.kwk.', '.kwk.kk.kwk.', '.kwkk..kkwk.', '..kwkkkkwk..', '...kwwwwk...', '....kkkk....', '............'],
    raise: ['............', '.....kk.....', '....kggk....', '...kggggk...', '..kggggggk..', '.kkkkggkkkk.', '....kggk....', '....kggk....', '....kggk....', 'kkkkkkkkkkkk', 'knnnnnnnnnnk', 'kkkkkkkkkkkk'],
    lower: ['............', '....kkkk....', '....krrk....', '....krrk....', '....krrk....', '.kkkkrrkkkk.', '..krrrrrrk..', '...krrrrk...', '....krrk....', 'kkkkkkkkkkkk', 'knnnnnnnnnnk', 'kkkkkkkkkkkk'],
    level: ['............', '............', '............', '.kkkkkkkkkk.', '.kyyyyyyyyk.', '.kyykkkkyyk.', '.kyyyyyyyyk.', '.kkkkkkkkkk.', '............', 'kkkkkkkkkkkk', 'knnnnnnnnnnk', 'kkkkkkkkkkkk'],
    smooth: ['............', '............', '..kkk.......', '.knnnkk.....', 'knnnnnnkkkk.', 'knnnnnnnnnnk', 'knnnnnnnnnnk', 'kkkkkkkkkkkk', '............', '..w.....w...', '.www...www..', '............'],
    paint: ['............', '........kkk.', '.......kook.', '......kook..', '.....kook...', '....kook....', '...knnk.....', '..knnk......', '.kgggk......', 'kgggk.......', 'kkkk........', '............'],
    land: ['............', '.k.k.k.k.k..', '............', '.k.kkkkkk.k.', '...kggggk...', '.k.kgyygk.k.', '...kgyygk...', '.k.kggggk.k.', '...kkkkkk...', '.k.k.k.k.k..', '............', '............'],
    bench: ['............', '............', '............', '.kkkkkkkkkk.', '.knnnnnnnnk.', '.kkkkkkkkkk.', '.knnnnnnnnk.', '.kkkkkkkkkk.', '.kk......kk.', '.kk......kk.', '............', '............'],
    road: ['............', 'kkkkkkkkkkkk', 'SSSSSSSSSSSS', 'SSSSSSSSSSSS', 'SSSSSSSSSSSS', 'SyySSyySSyyS', 'SSSSSSSSSSSS', 'SSSSSSSSSSSS', 'SSSSSSSSSSSS', 'kkkkkkkkkkkk', '............', '............'],
    gear: ['............', '.....kk.....', '..kk.kk.kk..', '..kkkllkkk..', '...kllllk...', '.kkll..llkk.', '.kkll..llkk.', '...kllllk...', '..kkkllkkk..', '..kk.kk.kk..', '.....kk.....', '............'],
    chart: ['............', 'k...........', 'k.........g.', 'k........g..', 'k.....g.g...', 'k....g.g....', 'k.g.g.......', 'k..g........', 'k...........', 'kkkkkkkkkkkk', '............', '............'],
    trophy: ['............', '.kkkkkkkkkk.', 'kykyyyyyykyk', 'kykyyyyyykyk', '.kkyyyyyykk.', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '....kyyk....', '...kkkkkk...', '..kyyyyyyk..', '..kkkkkkkk..'],
    jump: ['............', '............', '.......kk...', '......kook..', '.....kkkkk..', '...k.......k', '..knk.....kn', '.knnnk...knn', 'knnnnnkkknnn', 'kkkkkkkkkkkk', '............', '............'],
    camera: ['............', '............', '...kkk......', '.kkkkkkkkkk.', '.kllllllllk.', '.klllkkllllk', '.kllkbbkllk.', '.kllkbbkllk.', '.klllkkllllk', '.kkkkkkkkkk.', '............', '............'],
    heart: ['............', '.kkk....kkk.', 'krrrk..krrrk', 'krwrrkkrrrrk', 'krrrrrrrrrrk', 'krrrrrrrrrrk', '.krrrrrrrrk.', '..krrrrrrk..', '...krrrrk...', '....krrk....', '.....kk.....', '............'],
    user: ['............', '....kkkk....', '...kppppk...', '...kppppk...', '...kppppk...', '....kkkk....', '..kkbbbbkk..', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '.kkkkkkkkkk.', '............'],
    google: ['............', '....rrrrr...', '..rrrrrrrr..', '.rrr....rr..', '.yy.........', '.yy....bbbbb', '.yy....bbbbb', '.gg......bb.', '..ggg...bbb.', '...gggggbb..', '....ggggg...', '............'],
    globe: ['............', '....kkkk....', '..kkbbggkk..', '.kbbgggbbbk.', '.kbgggbbbbk.', 'kbbbggbbggbk', 'kbbbbbbgggbk', '.kbbbbbgggk.', '.kbbggbbgbk.', '..kkbbbbkk..', '....kkkk....', '............']
  };
  /* line-art icons drawn light with a hard drop shadow so they read on dark buttons */
  const LIGHT = new Set(['pause', 'play', 'fast', 'faster', 'menu', 'close', 'rotate', 'grid', 'chart', 'follow', 'music', 'sound', 'mute', 'camera']);
  const cache = {};
  function iconURL(name, scale) {
    const key = name + ':' + (scale || 2);
    if (cache[key]) return cache[key];
    const rows = ICONS[name] || ICONS.info;
    const s = scale || 2;
    const light = LIGHT.has(name);
    const c = document.createElement('canvas');
    c.width = 12 * s; c.height = 12 * s;
    const ctx = c.getContext('2d');
    for (let pass = light ? 0 : 1; pass < 2; pass++) for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const ch = (rows[y] || '')[x];
      if (!ch || ch === '.' || ch === ' ') continue;
      if (pass === 0) { ctx.fillStyle = 'rgba(16,12,9,0.85)'; ctx.fillRect((x + 1) * s, (y + 1) * s, s, s); continue; }
      ctx.fillStyle = light && ch === 'k' ? '#f3e9dc' : (PAL[ch] || '#000');
      ctx.fillRect(x * s, y * s, s, s);
    }
    return (cache[key] = c.toDataURL());
  }
  function icon(name, cls) {
    const el = h('span', { class: 'px-icon ' + (cls || ''), 'aria-hidden': 'true' });
    el.style.backgroundImage = 'url(' + iconURL(name, 3) + ')';
    return el;
  }
  /* small portrait for info windows: drawn from the agent's colours */
  function portrait(cols, kind) {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 24;
    const x = c.getContext('2d');
    const rgb = (a) => 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')';
    x.fillStyle = '#2a241f'; x.fillRect(0, 0, 24, 24);
    if (kind === 'rider') {
      x.fillStyle = rgb(cols[2] || [255, 106, 19]); x.fillRect(5, 15, 14, 9);
      x.fillStyle = rgb(cols[3] || [255, 255, 255]); x.fillRect(6, 3, 12, 11);
      x.fillStyle = '#263238'; x.fillRect(9, 7, 8, 4);
      x.fillStyle = '#ff8f1f'; x.fillRect(9, 7, 8, 1);
      x.fillStyle = rgb(cols[3] || [255, 255, 255]); x.fillRect(16, 4, 4, 2);
    } else {
      x.fillStyle = rgb(cols[0] || [200, 50, 50]); x.fillRect(5, 15, 14, 9);
      x.fillStyle = rgb(cols[3] || [240, 200, 170]); x.fillRect(7, 5, 10, 10);
      x.fillStyle = rgb(cols[2] || [60, 40, 20]); x.fillRect(7, 3, 10, 3); x.fillRect(6, 4, 2, 6);
      x.fillStyle = '#1d1d1d'; x.fillRect(10, 9, 1, 2); x.fillRect(14, 9, 1, 2);
      x.fillStyle = '#9c4a3a'; x.fillRect(11, 12, 3, 1);
    }
    c.className = 'portrait';
    return c;
  }
  function bar(value, max, cls) {
    const pct = Math.max(0, Math.min(100, (value / (max || 100)) * 100));
    return h('div', { class: 'bar ' + (cls || '') }, h('div', { class: 'bar-fill', style: { width: pct + '%' } }));
  }
  function stars(v, max) {
    const out = h('span', { class: 'stars', title: v + '/' + max });
    for (let i = 0; i < max; i++) out.appendChild(h('span', { class: 'st ' + (i < v ? 'on' : '') }, '★'));
    return out;
  }
  function chip(text, kind) { return h('span', { class: 'chip chip-' + (kind || 'neutral') }, text); }

  MX.DOM = { h, clear, icon, iconURL, portrait, bar, stars, chip, ICONS, PAL };
})(window.MX);
