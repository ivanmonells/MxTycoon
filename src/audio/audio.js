/* MX Tycoon - WebAudio: synthesized effects, positional bike engines with gear
   changes, crowd ambience and a procedural chiptune-rock soundtrack. */
(function (MX) {
  'use strict';
  const U = MX.U;

  const Audio = {
    ctx: null, enabled: true, sfxOn: true, musicOn: true, ready: false,
    voices: [], lastSfx: {},
    init(settings) {
      if (this.ctx) { this.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.engineBus = c.createGain(); this.engineBus.connect(this.sfxBus);
      this.crowdBus = c.createGain(); this.crowdBus.connect(this.sfxBus);
      this.noise = this._noiseBuffer(2);
      this._crowd();
      for (let i = 0; i < 4; i++) this.voices.push(this._engineVoice());
      this.setVolumes(settings || {});
      this.sfxOn = settings ? settings.sfx !== false : true;
      this.musicOn = settings ? settings.music !== false : true;
      this.enabled = settings ? settings.sound !== false : true;
      this._apply();
      this.ready = true;
      this._music();
      MX.Bus.on('jump', (d) => this._near(d.x, d.z, 45) && Math.random() < 0.35 && this.cheer(0.35));
      MX.Bus.on('crash', (d) => { if (this._near(d.x, d.z, 60)) { this.sfx('crash'); this.cheer(0.6, true); } });
      MX.Bus.on('race:start', () => { this.sfx('gate'); this.cheer(1); });
      MX.Bus.on('race:winner', () => { this.sfx('fanfare'); this.cheer(1.2); });
      MX.Bus.on('build', () => this.sfx('build'));
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVolumes(s) {
      if (!this.ctx) return;
      this.sfxBus.gain.value = (s.sfxVol != null ? s.sfxVol : 0.7);
      this.musicBus.gain.value = (s.musicVol != null ? s.musicVol : 0.45) * 0.55;
    },
    _apply() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(this.sfxOn ? (MX.App.settings.sfxVol != null ? MX.App.settings.sfxVol : 0.7) : 0, t, 0.05);
      this.musicBus.gain.setTargetAtTime(this.musicOn ? (MX.App.settings.musicVol != null ? MX.App.settings.musicVol : 0.45) * 0.55 : 0, t, 0.1);
    },
    toggle() { this.enabled = !this.enabled; this._apply(); return this.enabled; },
    setSfx(v) { this.sfxOn = v; this._apply(); },
    setMusic(v) { this.musicOn = v; this._apply(); },
    _near(x, z, r) { const cam = MX.App.renderer && MX.App.renderer.cam; return cam && U.dist(cam.tx, cam.tz, x, z) < r * Math.max(1, 10 / cam.zoom); },
    _noiseBuffer(sec) {
      const c = this.ctx, n = Math.floor(c.sampleRate * sec);
      const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },
    _env(g, t, a, peak, d, sustain) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
    },
    _tone(type, f0, f1, dur, vol, when, dest) {
      const c = this.ctx, t = (when || c.currentTime);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this._env(g, t, 0.005, vol, dur);
      o.connect(g); g.connect(dest || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.05);
    },
    _noise(dur, vol, filt, f0, f1, when, q, dest) {
      const c = this.ctx, t = (when || c.currentTime);
      const s = c.createBufferSource(); s.buffer = this.noise;
      const fl = c.createBiquadFilter(); fl.type = filt || 'lowpass'; fl.frequency.setValueAtTime(f0 || 1000, t); fl.Q.value = q || 0.8;
      if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain(); this._env(g, t, 0.004, vol, dur);
      s.connect(fl); fl.connect(g); g.connect(dest || this.sfxBus);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    sfx(name) {
      if (!this.ready || !this.enabled || !this.sfxOn) return;
      const c = this.ctx, now = c.currentTime;
      if (this.lastSfx[name] && now - this.lastSfx[name] < 0.05) return;
      this.lastSfx[name] = now;
      switch (name) {
        case 'click': this._tone('square', 900, 700, 0.035, 0.06); break;
        case 'place': this._tone('triangle', 420, 640, 0.07, 0.12); this._noise(0.05, 0.05, 'highpass', 3000); break;
        case 'build': this._noise(0.3, 0.22, 'lowpass', 900, 200); this._tone('sine', 110, 55, 0.25, 0.25); break;
        case 'demolish': this._noise(0.45, 0.25, 'bandpass', 1400, 200, 0, 1.2); this._tone('sine', 90, 40, 0.3, 0.2); break;
        case 'cash': this._tone('square', 1318, 1318, 0.06, 0.05); this._tone('square', 1760, 1760, 0.12, 0.05, now + 0.06); this._tone('sine', 2637, 2637, 0.12, 0.05, now + 0.06); break;
        case 'error': this._tone('sawtooth', 190, 120, 0.18, 0.08); break;
        case 'notify': this._tone('sine', 660, 660, 0.08, 0.08); this._tone('sine', 990, 990, 0.12, 0.07, now + 0.08); break;
        case 'success': [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.14, 0.11, now + i * 0.07)); break;
        case 'alert': [520, 400, 520, 400].forEach((f, i) => this._tone('square', f, f, 0.08, 0.05, now + i * 0.09)); break;
        case 'raise': this._noise(0.12, 0.08, 'bandpass', 600, 900, 0, 2); break;
        case 'lower': this._noise(0.12, 0.08, 'bandpass', 900, 500, 0, 2); break;
        case 'paint': this._noise(0.08, 0.05, 'highpass', 2500); break;
        case 'gate': this._noise(0.25, 0.25, 'highpass', 1800); this._tone('square', 2100, 1800, 0.15, 0.05); this._tone('sine', 140, 60, 0.3, 0.3); break;
        case 'crash': this._noise(0.5, 0.3, 'lowpass', 1200, 150); this._tone('sine', 80, 40, 0.3, 0.3); this._noise(0.2, 0.15, 'highpass', 3000, 0, now + 0.05); break;
        case 'fanfare': [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this._tone('square', f, f, i === 6 ? 0.5 : 0.12, 0.06, now + i * 0.13)); break;
      }
    },
    cheer(k, gasp) {
      if (!this.ready || !this.enabled || !this.sfxOn) return;
      const c = this.ctx, t = c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = gasp ? 700 : 1100; f.Q.value = 0.7;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18 * k * Math.min(1, (this.crowdLevel || 0) * 2 + 0.2), t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      s.connect(f); f.connect(g); g.connect(this.crowdBus);
      s.start(t, Math.random()); s.stop(t + 1.7);
    },
    _crowd() {
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 850; f.Q.value = 0.5;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.crowdBus);
      s.start();
      this.crowdGain = g;
    },
    _engineVoice() {
      const c = this.ctx;
      const o1 = c.createOscillator(), o2 = c.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square';
      const shaper = c.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3.2); }
      shaper.curve = curve;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 2;
      const g = c.createGain(); g.gain.value = 0;
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      const g1 = c.createGain(), g2 = c.createGain(); g1.gain.value = 0.5; g2.gain.value = 0.3;
      o1.connect(g1); o2.connect(g2); g1.connect(shaper); g2.connect(shaper); shaper.connect(f); f.connect(g);
      if (pan) { g.connect(pan); pan.connect(this.engineBus); } else g.connect(this.engineBus);
      o1.start(); o2.start();
      return { o1, o2, f, g, pan, rider: null };
    },
    update(dt) {
      if (!this.ready) return;
      const app = MX.App, g = app.game;
      const c = this.ctx, t = c.currentTime;
      if (!g || !app.renderer) { for (const v of this.voices) v.g.gain.setTargetAtTime(0, t, 0.1); if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(0, t, 0.3); return; }
      const cam = app.renderer.cam;
      const zoomK = U.clamp((cam.zoom - 3) / 14, 0.15, 1);
      this._assignT = (this._assignT || 0) - dt;
      if (this._assignT <= 0) {
        this._assignT = 0.3;
        const riding = g.riders.filter(r => r.m && !r.m.crash).map(r => ({ r, d: U.dist2(r.x, r.z, cam.tx, cam.tz) })).sort((a, b) => a.d - b.d).slice(0, this.voices.length);
        this.voices.forEach((v, i) => { v.rider = riding[i] ? riding[i].r : null; });
      }
      const range = 70 / Math.max(0.6, zoomK);
      for (const v of this.voices) {
        const r = v.rider;
        if (!r || !r.m || r.dead || g.speed === 0) { v.g.gain.setTargetAtTime(0, t, 0.08); continue; }
        const m = r.m;
        const d = U.dist(r.x, r.z, cam.tx, cam.tz);
        const vol = U.clamp(1 - d / range, 0, 1) * 0.06 * zoomK;
        const gearW = 6.5;
        const gear = Math.min(4, Math.floor(m.v / gearW));
        const p = (m.v - gear * gearW) / gearW;
        let rpm = 0.32 + 0.58 * U.clamp(p, 0, 1.2) + (m.throttle - 0.5) * 0.15;
        if (m.air) rpm = 0.75 + 0.2 * Math.sin(performance.now() / 80);
        const f0 = 48 + rpm * 120;
        v.o1.frequency.setTargetAtTime(f0, t, 0.04);
        v.o2.frequency.setTargetAtTime(f0 * 2.01, t, 0.04);
        v.f.frequency.setTargetAtTime(600 + m.throttle * 1800, t, 0.05);
        v.g.gain.setTargetAtTime(vol * (0.5 + m.throttle * 0.6), t, 0.05);
        if (v.pan) {
          const s = app.renderer.worldToCss(r.x, r.y, r.z);
          v.pan.pan.setTargetAtTime(U.clamp((s[0] / window.innerWidth) * 2 - 1, -0.8, 0.8), t, 0.1);
        }
      }
      /* crowd level from visitors near the camera */
      let n = 0;
      for (const v of g.visitors) if ((v.state === 'watch' || v.state === 'seat') && U.dist2(v.x, v.z, cam.tx, cam.tz) < 3600) n++;
      this.crowdLevel = U.clamp(n / 40, 0, 1) * (g.race ? 1.4 : 1);
      if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(this.crowdLevel * 0.05 * zoomK, t, 0.5);
    },

    /* ---------------- music ---------------- */
    _music() {
      const c = this.ctx;
      const bpm = 132, step = 60 / bpm / 4;
      const E2 = 82.41;
      const n = (semi) => E2 * Math.pow(2, semi / 12);
      /* E minor pentatonic rock: bass pattern per bar (16 steps), semitones from E2 */
      const bassA = [0, null, 0, null, 0, null, 3, null, 5, null, 5, null, 7, null, 5, 3];
      const bassB = [-2, null, -2, null, -2, null, 0, null, 3, null, 3, null, 5, null, 3, 0];
      const leadA = [12, null, 15, null, 17, 19, null, 17, 15, null, 12, null, 15, null, null, null];
      const leadB = [19, null, 17, null, 15, 17, null, 15, 12, null, 10, null, 12, null, null, null];
      const leadC = [24, null, 22, 19, null, 17, 19, null, 22, null, 24, null, 19, null, 17, null];
      const prog = [bassA, bassA, bassB, bassA];
      const leads = [null, leadA, null, leadB, leadA, leadC, leadB, leadC];
      let stepIdx = 0, nextT = c.currentTime + 0.2;
      const drum = (t, kind) => {
        if (kind === 'k') { this._tone('sine', 140, 42, 0.18, 0.5, t, this.musicBus); }
        else if (kind === 's') { this._noise(0.14, 0.22, 'bandpass', 1800, 900, t, 0.8, this.musicBus); this._tone('triangle', 200, 160, 0.08, 0.12, t, this.musicBus); }
        else this._noise(0.035, 0.06, 'highpass', 7000, 0, t, 0.7, this.musicBus);
      };
      const tick = () => {
        if (!this.ctx) return;
        while (nextT < c.currentTime + 0.15) {
          const bar = Math.floor(stepIdx / 16), s = stepIdx % 16;
          const section = Math.floor(bar / 4) % 8;
          const bass = prog[bar % 4][s];
          if (this.musicOn && this.enabled) {
            if (s % 8 === 0 || s === 10) drum(nextT, 'k');
            if (s === 4 || s === 12) drum(nextT, 's');
            if (s % 2 === 0) drum(nextT, 'h');
            if (bass != null) { this._tone('square', n(bass), n(bass), step * 1.6, 0.07, nextT, this.musicBus); this._tone('sawtooth', n(bass + 12), n(bass + 12), step * 1.2, 0.025, nextT, this.musicBus); }
            const lead = leads[section];
            if (lead && lead[s] != null) {
              const f = n(lead[s]);
              const o = c.createOscillator(), g = c.createGain();
              o.type = 'square'; o.frequency.setValueAtTime(f, nextT);
              const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = f * 0.008;
              lfo.connect(lg); lg.connect(o.frequency);
              this._env(g, nextT, 0.01, 0.045, step * 3);
              o.connect(g); g.connect(this.musicBus);
              o.start(nextT); o.stop(nextT + step * 3.2); lfo.start(nextT); lfo.stop(nextT + step * 3.2);
            }
            if (s === 0 && section % 2 === 1) {
              const root = prog[bar % 4][0];
              for (const iv of [0, 7, 12]) this._tone('sawtooth', n(root + iv + 12), n(root + iv + 12), step * 14, 0.012, nextT, this.musicBus);
            }
          }
          nextT += step; stepIdx++;
        }
      };
      this._musicTimer = setInterval(tick, 40);
    }
  };
  MX.Audio = Audio;
})(window.MX);
