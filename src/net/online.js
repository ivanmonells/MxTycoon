/* MX Tycoon - online mode of the public web build: Google sign-in, nicknames, cloud
   saves and the ranking of published circuits, on Firebase Authentication and Cloud
   Firestore. The web build adds its configuration as window.MX_ONLINE and the
   Firebase SDK is then loaded from its CDN on demand; without it (the standalone
   file, the Claude artifact) the game stays offline and none of this shows.

   Firestore layout (access rules in firestore.rules):
     users/{uid}                  nick, nickLower, created, updated
     users/{uid}/saves/{slot}     park, date, money, rep, mode, ts, size   (listing)
     users/{uid}/savedata/{slot}  z (packed game), v
     nicknames/{nickLower}        uid   (one owner per nickname)
     circuits/{cid}               uid, nick, park, track, type, len, r10, diff, safety,
                                  jumps, slot, pts (shape), likes, visits,
                                  score (= r10 + 3 x likes), created, updated, v
     circuits/{cid}/data/park     z (packed park, loaded to visit it)
     circuits/{cid}/likes/{uid}   at */
(function (MX) {
  'use strict';
  const cfg = window.MX_ONLINE || null;
  const SDK = (cfg && cfg.sdkBase) || 'https://www.gstatic.com/firebasejs/' + ((cfg && cfg.sdk) || '12.19.0') + '/';
  const SLOTS = ['auto', '1', '2', '3'];
  const NICK_RE = /^[A-Za-z0-9ñÑ_-]{3,16}$/;
  const ORDERS = { best: 'score', visits: 'visits', recent: 'updated' };

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }
  function errText(e) {
    const c = (e && e.code) || '';
    if (c === 'permission-denied') return 'El servidor no lo permite (permiso denegado)';
    if (c === 'unavailable' || c === 'auth/network-request-failed') return 'Sin conexión con el servidor. Inténtalo de nuevo';
    if (c === 'auth/unauthorized-domain') return 'Este dominio no está autorizado para iniciar sesión (Firebase > Authentication > Settings > Authorized domains)';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Inicio de sesión cancelado';
    if (c === 'resource-exhausted') return 'Se ha superado la cuota del servidor por hoy';
    return (e && e.message) || 'Error desconocido';
  }
  /* outline of a circuit for the ranking: up to 64 points in metres, as a flat list */
  function shape(tr) {
    const S = tr.S, out = [];
    if (!S || !S.n) return out;
    const n = Math.min(64, S.n), step = S.n / n;
    for (let k = 0; k < n; k++) { const i = Math.floor(k * step); out.push(Math.round(S.x[i]), Math.round(S.z[i])); }
    return out;
  }

  let fb = null, auth = null, db = null, FV = null;
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) { try { fn(Online); } catch (e) { console.error(e); } } };

  const Online = {
    SLOTS,
    /* configured, served over http(s) and not inside Claude's artifact viewer */
    enabled: !!(cfg && cfg.firebase) && /^https?:$/.test(location.protocol) && !(window.claude && typeof window.claude.use === 'function'),
    state: 'off', error: null,
    user: null, nick: null, profileLoaded: false,
    _visited: new Set(),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get ready() { return this.state === 'ready'; },
    get signedIn() { return !!this.user; },
    init() {
      if (!this.enabled) return Promise.resolve(false);
      if (this._init) return this._init;
      this.state = 'loading'; emit();
      this._init = (async () => {
        try {
          await loadScript(SDK + 'firebase-app-compat.js');
          await Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]);
          fb = window.firebase;
          /* on Firebase Hosting the sign-in pages live on the same domain as the game,
             which keeps the redirect sign-in working where browsers block third-party storage */
          const fc = Object.assign({}, cfg.firebase), host = location.hostname;
          if (!cfg.emulators && (host === fc.projectId + '.web.app' || host === fc.projectId + '.firebaseapp.com')) fc.authDomain = host;
          const app = fb.initializeApp(fc);
          auth = app.auth(); db = app.firestore();
          if (cfg.emulators) {
            auth.useEmulator(cfg.emulators.auth, { disableWarnings: true });
            db.useEmulator(cfg.emulators.firestoreHost, cfg.emulators.firestorePort);
          }
          FV = fb.firestore.FieldValue;
          auth.languageCode = 'es';
          await new Promise((res) => {
            let first = true;
            auth.onAuthStateChanged(async (u) => {
              this.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null;
              this.nick = null; this.profileLoaded = false;
              if (u) {
                try { const s = await db.doc('users/' + u.uid).get(); this.nick = s.exists ? s.data().nick : null; } catch (e) { console.warn('perfil', e); }
                this.profileLoaded = true;
              }
              if (first) { first = false; res(); }
              emit();
            });
          });
          try { await auth.getRedirectResult(); } catch (e) { console.warn('redirect', e); }
          this.state = 'ready'; emit();
          return true;
        } catch (e) {
          console.error('online', e);
          this.state = 'error'; this.error = errText(e); emit();
          return false;
        }
      })();
      return this._init;
    },

    /* ---------- account ---------- */
    async signIn() {
      if (!await this.init()) return { ok: false, reason: 'El modo online no está disponible ahora mismo' };
      const provider = new fb.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try { await auth.signInWithPopup(provider); return { ok: true }; } catch (e) {
        /* popups blocked or not supported (some mobile browsers): go by redirect */
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          try { await auth.signInWithRedirect(provider); return { ok: true, redirect: true }; } catch (e2) { return { ok: false, reason: errText(e2) }; }
        }
        return { ok: false, cancelled: e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request'), reason: errText(e) };
      }
    },
    async signOut() { if (auth) await auth.signOut(); },
    checkNick(nick) {
      nick = (nick || '').trim();
      if (nick.length < 3 || nick.length > 16) return 'Entre 3 y 16 caracteres';
      if (!NICK_RE.test(nick)) return 'Solo letras, números, guion y guion bajo (sin espacios)';
      return null;
    },
    suggestNick() {
      const base = ((this.user && this.user.name) || 'Piloto').split(/\s+/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'Piloto';
      return (base.length < 3 ? 'Piloto' : base) + Math.floor(10 + Math.random() * 90);
    },
    /* the nickname document makes it unique; the old one is released */
    async claimNick(nick) {
      nick = (nick || '').trim();
      const bad = this.checkNick(nick);
      if (bad) return { ok: false, reason: bad };
      if (!this.user) return { ok: false, reason: 'Inicia sesión primero' };
      const uid = this.user.uid, lower = nick.toLowerCase();
      let renamed = false;
      try {
        await db.runTransaction(async (tx) => {
          const nref = db.doc('nicknames/' + lower), uref = db.doc('users/' + uid);
          const ns = await tx.get(nref), us = await tx.get(uref);
          if (ns.exists && ns.data().uid !== uid) throw Object.assign(new Error('taken'), { code: 'taken' });
          const prev = us.exists ? us.data() : null;
          renamed = !!(prev && prev.nick && prev.nick !== nick);
          if (prev && prev.nickLower && prev.nickLower !== lower) tx.delete(db.doc('nicknames/' + prev.nickLower));
          if (!ns.exists) tx.set(nref, { uid });
          tx.set(uref, { nick, nickLower: lower, created: prev && prev.created ? prev.created : FV.serverTimestamp(), updated: FV.serverTimestamp() });
        });
      } catch (e) {
        if (e && e.code === 'taken') return { ok: false, reason: 'Ese apodo ya lo usa otro piloto' };
        return { ok: false, reason: errText(e) };
      }
      this.nick = nick; emit();
      if (renamed) {
        /* the circuits already published carry the new nickname */
        try {
          const qs = await db.collection('circuits').where('uid', '==', uid).get();
          if (qs.size) { const b = db.batch(); qs.docs.forEach(d => b.update(d.ref, { nick })); await b.commit(); }
        } catch (e) { console.warn('renombrar circuitos', e); }
      }
      return { ok: true };
    },

    /* ---------- cloud saves ---------- */
    async listSaves() {
      if (!this.user) return [];
      const qs = await db.collection('users/' + this.user.uid + '/saves').get();
      return qs.docs.map(d => { const m = d.data(); return { slot: d.id, park: m.park, date: m.date, money: m.money, rep: m.rep, mode: m.mode, size: m.size, ts: m.ts && m.ts.toMillis ? m.ts.toMillis() : Date.now() }; });
    },
    async saveGame(slot, game) {
      if (!this.user) return { ok: false, reason: 'Inicia sesión para guardar en la nube' };
      if (!SLOTS.includes(slot)) return { ok: false, reason: 'Ranura no válida' };
      try {
        const z = await MX.Save.pack(game.serialize());
        if (z.length > 900000) return { ok: false, reason: 'La partida es demasiado grande para la nube' };
        const base = 'users/' + this.user.uid;
        const b = db.batch();
        b.set(db.doc(base + '/savedata/' + slot), { z, v: MX.C.SAVE_VERSION });
        b.set(db.doc(base + '/saves/' + slot), { park: String(game.parkName).slice(0, 60), date: game.dateText(), money: Math.round(game.econ.money), rep: Math.round(game.rep), mode: game.mode, ts: FV.serverTimestamp(), size: z.length });
        await b.commit();
        return { ok: true };
      } catch (e) { console.error(e); return { ok: false, reason: errText(e) }; }
    },
    async loadGame(slot) {
      if (!this.user) return { ok: false, reason: 'Inicia sesión primero' };
      try {
        const s = await db.doc('users/' + this.user.uid + '/savedata/' + slot).get();
        if (!s.exists) return { ok: false, reason: 'La ranura está vacía' };
        return { ok: true, data: await MX.Save.unpack(s.data().z) };
      } catch (e) { console.error(e); return { ok: false, reason: errText(e) }; }
    },
    async deleteSave(slot) {
      if (!this.user) return { ok: false };
      const base = 'users/' + this.user.uid, b = db.batch();
      b.delete(db.doc(base + '/saves/' + slot)); b.delete(db.doc(base + '/savedata/' + slot));
      try { await b.commit(); return { ok: true }; } catch (e) { return { ok: false, reason: errText(e) }; }
    },

    /* ---------- circuit ranking ---------- */
    circuitId(game, tr) { return this.user ? this.user.uid + '_' + game.parkId + '_' + tr.slot : null; },
    /* publish (or update) a circuit with a copy of the whole park to visit */
    async publish(game, tr) {
      if (!this.user) return { ok: false, reason: 'Inicia sesión para publicar' };
      if (!this.nick) return { ok: false, reason: 'Elige primero tu apodo' };
      if (!tr.closed || !tr.stats) return { ok: false, reason: 'Prueba o abre el circuito antes de publicarlo' };
      const cid = this.circuitId(game, tr), ref = db.doc('circuits/' + cid);
      try {
        const z = await MX.Save.pack(game.serialize());
        if (z.length > 900000) return { ok: false, reason: 'El complejo es demasiado grande para publicarlo' };
        const st = tr.stats, prev = await ref.get();
        const r10 = Math.max(0, Math.min(100, Math.round(st.rating * 10)));
        const likes = prev.exists ? prev.data().likes || 0 : 0;
        const body = {
          uid: this.user.uid, nick: this.nick, park: String(game.parkName).slice(0, 60), track: String(tr.name).slice(0, 40), type: tr.type,
          len: Math.round(tr.length), r10, diff: Math.round(st.diff * 10), safety: Math.round(st.safety * 100), jumps: st.jumps || 0,
          slot: tr.slot, pts: shape(tr), score: r10 + likes * 3, updated: FV.serverTimestamp(), v: MX.C.SAVE_VERSION
        };
        const b = db.batch();
        if (prev.exists) b.update(ref, body); else b.set(ref, Object.assign({ likes: 0, visits: 0, created: FV.serverTimestamp() }, body));
        b.set(db.doc('circuits/' + cid + '/data/park'), { z });
        await b.commit();
        return { ok: true, id: cid, updated: prev.exists };
      } catch (e) { console.error(e); return { ok: false, reason: errText(e) }; }
    },
    async unpublish(cid) {
      const b = db.batch();
      b.delete(db.doc('circuits/' + cid + '/data/park')); b.delete(db.doc('circuits/' + cid));
      try { await b.commit(); return { ok: true }; } catch (e) { return { ok: false, reason: errText(e) }; }
    },
    async isPublished(game, tr) {
      if (!this.user) return false;
      try { return (await db.doc('circuits/' + this.circuitId(game, tr)).get()).exists; } catch (e) { return false; }
    },
    /* order: best | visits | recent; type: a discipline or null; mine: only my circuits */
    async top(opts) {
      opts = opts || {};
      if (!await this.init()) return { ok: false, reason: 'El modo online no está disponible ahora mismo', list: [] };
      try {
        let q = db.collection('circuits');
        if (opts.mine && this.user) q = q.where('uid', '==', this.user.uid);
        else {
          if (opts.type) q = q.where('type', '==', opts.type);
          q = q.orderBy(ORDERS[opts.order] || 'score', 'desc');
        }
        const qs = await q.limit(opts.limit || 40).get();
        const list = qs.docs.map(d => { const m = d.data(); return Object.assign({}, m, { id: d.id, updated: m.updated && m.updated.toMillis ? m.updated.toMillis() : Date.now() }); });
        if (opts.mine) list.sort((a, b) => b.score - a.score);
        return { ok: true, list };
      } catch (e) { console.error(e); return { ok: false, reason: errText(e), list: [] }; }
    },
    async circuit(cid) {
      if (!await this.init()) return { ok: false, reason: 'El modo online no está disponible ahora mismo' };
      try {
        const [m, d] = await Promise.all([db.doc('circuits/' + cid).get(), db.doc('circuits/' + cid + '/data/park').get()]);
        if (!m.exists || !d.exists) return { ok: false, reason: 'Ese circuito ya no está publicado' };
        return { ok: true, entry: Object.assign({ id: cid }, m.data()), data: await MX.Save.unpack(d.data().z) };
      } catch (e) { console.error(e); return { ok: false, reason: errText(e) }; }
    },
    /* one visit per circuit and session, not counting the owner */
    async countVisit(entry) {
      if (!this.user || entry.uid === this.user.uid || this._visited.has(entry.id)) return;
      this._visited.add(entry.id);
      try { await db.doc('circuits/' + entry.id).update({ visits: FV.increment(1) }); } catch (e) { console.warn('visita', e); }
    },
    async liked(cid) {
      if (!this.user) return false;
      try { return (await db.doc('circuits/' + cid + '/likes/' + this.user.uid).get()).exists; } catch (e) { return false; }
    },
    /* like or unlike: the voter's like document and the counters change together */
    async setLike(cid, on) {
      if (!this.user) return { ok: false, reason: 'Inicia sesión para votar' };
      const ref = db.doc('circuits/' + cid), lref = db.doc('circuits/' + cid + '/likes/' + this.user.uid);
      try {
        let likes = 0;
        await db.runTransaction(async (tx) => {
          const c = await tx.get(ref), l = await tx.get(lref);
          if (!c.exists) throw Object.assign(new Error('gone'), { code: 'gone' });
          const d = c.data();
          if (d.uid === this.user.uid) throw Object.assign(new Error('own'), { code: 'own' });
          likes = d.likes || 0;
          if (on === l.exists) return;
          likes += on ? 1 : -1;
          tx.update(ref, { likes, score: (d.r10 || 0) + likes * 3 });
          if (on) tx.set(lref, { at: FV.serverTimestamp() }); else tx.delete(lref);
        });
        return { ok: true, likes, on };
      } catch (e) {
        if (e && e.code === 'gone') return { ok: false, reason: 'Ese circuito ya no está publicado' };
        if (e && e.code === 'own') return { ok: false, reason: 'No puedes votar tus propios circuitos' };
        return { ok: false, reason: errText(e) };
      }
    },
    /* only for the emulator test build */
    async _testSignIn(sub, name) {
      if (!cfg || !cfg.emulators) return { ok: false };
      await this.init();
      const tok = JSON.stringify({ sub, email: sub + '@example.com', email_verified: true, name });
      await auth.signInWithCredential(fb.auth.GoogleAuthProvider.credential(tok));
      await new Promise(r => { const t0 = Date.now(); const k = () => (this.profileLoaded || Date.now() - t0 > 4000) ? r() : setTimeout(k, 50); k(); });
      return { ok: true, uid: this.user && this.user.uid };
    },
    _db() { return db; }
  };
  MX.Online = Online;
})(window.MX);
