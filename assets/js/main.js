/* HESA Çelik — giriş akışı ve kaydırma animasyonları (tek rAF döngüsü) */
(function () {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);

  // ================= giriş: 3B yapım =================
  const hud = { step: $('.hud-step'), name: $('.hud-name'), time: $('.hud-time'), bar: $('.hud-bar i'), ticks: $('.hud-ticks') };
  let api = null, tickEls = [];

  function setReady() {
    root.classList.remove('intro');
    root.classList.add('ready');
    try { sessionStorage.setItem('hesa-intro-seen', '1'); } catch (e) {}
  }
  function fallback() { root.classList.add('no-webgl'); setReady(); }
  function webglOK() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  function showPhase(i, name) {
    hud.step.textContent = String(i + 1).padStart(2, '0');
    hud.name.textContent = name;
    hud.name.classList.remove('swap'); void hud.name.offsetWidth; hud.name.classList.add('swap');
    tickEls.forEach((li, j) => li.classList.toggle('on', j <= i));
  }
  function showProgress(p, t) {
    hud.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    hud.time.textContent = Math.min(t, api ? api.duration : t).toFixed(1).padStart(4, '0') + ' sn';
  }

  if (window.HesaScene && webglOK()) {
    try {
      api = HesaScene.start({
        canvas: $('#scene'),
        reduced,
        skipIntro: root.classList.contains('ready'),
        onPhase: showPhase,
        onProgress: showProgress,
        onDone: setReady
      });
      tickEls = api.phases.map(ph => {
        const li = document.createElement('li');
        li.style.left = (ph.t / api.duration * 100) + '%';
        hud.ticks.appendChild(li);
        return li;
      });
      // test için: ?t=5 → sahneyi 5. saniyede dondur
      const t = parseFloat(params.get('t'));
      if (!isNaN(t)) {
        api.seek(t);
        let ph = 0;
        api.phases.forEach((p, i) => { if (t >= p.t) ph = i; });
        showPhase(ph, api.phases[ph].name);
        showProgress(clamp01(t / api.duration), Math.min(t, api.duration));
        if (t >= api.duration - 1.4) setReady();
      }
    } catch (e) {
      console.error(e);
      fallback();
    }
  } else {
    fallback();
  }

  $('.skip').addEventListener('click', () => api && api.skip());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('intro') && api) api.skip(); });
  function replay() {
    if (!api) return;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    root.classList.remove('ready');
    root.classList.add('intro');
    api.replay();
  }
  $('.replay').addEventListener('click', replay);
  $('.replay-link').addEventListener('click', replay);

  window.addEventListener('pointermove', e => {
    if (api) api.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
  }, { passive: true });

  // ================= menü =================
  const nav = $('#nav'), burger = $('.nav-burger');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  });
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }));

  // ================= metin hazırlığı =================
  // başlıklar: kelime kelime maskeli açılış
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => '<span class="w" aria-hidden="true"><span style="--i:' + i + '">' + w + '</span></span>').join(' ');
    el.setAttribute('data-reveal', '');
  });
  // manifesto: kaydırdıkça kelime kelime aydınlanır
  const scrub = $('[data-scrub-words]');
  const scrubWords = [];
  if (scrub) {
    const words = scrub.textContent.trim().split(/\s+/);
    scrub.innerHTML = words.map(w => '<span class="sw">' + w + '</span>').join(' ');
    scrubWords.push(...$$('.sw', scrub));
  }

  // ================= görünür olunca =================
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach(el => io.observe(el));

  // ================= kaydırmaya bağlı sahneler =================
  const heroContent = $('.hero-content');
  const panelSec = $('.panel-sec'), panel3d = $('.panel3d'), layers = $$('.layers li'), panelBar = $('.panel-progress');
  const timeline = $('.timeline'), tlLine = $('.tl-line'), tlItems = $$('.timeline li');
  const contact = $('.contact');
  const bands = $$('.band-row').map(row => {
    const track = $('.band-track', row);
    track.innerHTML += track.innerHTML; // kesintisiz döngü için iki kopya
    return { track, dir: +row.dataset.dir, x: 0, w: 0 };
  });
  const bandSec = $('.band');
  let bandVisible = false;
  new IntersectionObserver(en => { bandVisible = en[0].isIntersecting; }).observe(bandSec);

  let vh = innerHeight, lastY = -1, vel = 0, panelOn = -1, lastWordLit = -1;
  window.addEventListener('resize', () => { vh = innerHeight; lastY = -1; bands.forEach(b => (b.w = 0)); });

  function onScroll(y) {
    if (api) api.setScroll(y / vh);
    nav.classList.toggle('scrolled', y > 40);

    if (root.classList.contains('ready') && !reduced) {
      const k = clamp01(y / vh);
      heroContent.style.transform = 'translate3d(0,' + (-y * 0.22).toFixed(1) + 'px,0)';
      heroContent.style.opacity = (1 - k * 1.5).toFixed(3);
    } else {
      heroContent.style.transform = '';
      heroContent.style.opacity = '';
    }

    if (scrubWords.length && !reduced) {
      const r = scrub.getBoundingClientRect();
      const p = clamp01((vh * 0.82 - r.top) / (r.height + vh * 0.3));
      const lit = p * (scrubWords.length + 3);
      if (Math.abs(lit - lastWordLit) > 0.02) {
        lastWordLit = lit;
        scrubWords.forEach((w, i) => { w.style.opacity = Math.max(0.14, clamp01(lit - i)).toFixed(2); });
      }
    }

    // panel: katmanlar ayrılır, sırayla anlatılır, sonra tek parça kapanır
    const pr = panelSec.getBoundingClientRect();
    if (pr.bottom > 0 && pr.top < vh) {
      const p = clamp01(-pr.top / (pr.height - vh));
      const e = reduced ? (p > 0.1 && p < 0.9 ? 1 : 0) : smooth(0.05, 0.3, p) * (1 - smooth(0.8, 0.96, p));
      panelSec.style.setProperty('--e', e.toFixed(4));
      panelSec.style.setProperty('--r', reduced ? 0.5 : p.toFixed(4));
      panelBar.style.setProperty('--p', p.toFixed(4));
      const on = p < 0.3 ? 0 : p < 0.5 ? 1 : p < 0.68 ? 2 : 3;
      if (on !== panelOn) {
        panelOn = on;
        panel3d.dataset.on = on;
        layers.forEach((li, i) => li.classList.toggle('on', i === on));
      }
    }

    const tr = timeline.getBoundingClientRect();
    if (tr.bottom > 0 && tr.top < vh) {
      const mark = vh * 0.62;
      tlLine.style.setProperty('--p', clamp01((mark - tr.top) / tr.height).toFixed(4));
      tlItems.forEach(li => li.classList.toggle('on', li.getBoundingClientRect().top < mark));
    }

    const cr = contact.getBoundingClientRect();
    if (cr.top < vh) contact.style.setProperty('--p', clamp01((vh - cr.top) / vh).toFixed(3));
  }

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const y = window.scrollY;
    if (y !== lastY) {
      if (lastY >= 0 && dt > 0) vel += ((y - lastY) / dt - vel) * 0.25;
      lastY = y;
      onScroll(y);
    } else {
      vel *= 0.9;
    }
    // şerit: sabit akış + kaydırma hızıyla ivmelenir
    if (bandVisible && !reduced) {
      const boost = Math.min(Math.abs(vel) * 0.08, 380);
      for (const b of bands) {
        if (!b.w) b.w = b.track.scrollWidth / 2;
        b.x -= b.dir * (46 + boost) * dt;
        if (b.x < -b.w) b.x += b.w;
        if (b.x > 0) b.x -= b.w;
        b.track.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,0,0)';
      }
    }
  }
  // test için: ?y=2.5 → sayfayı 2,5 ekran boyu aşağı kaydır
  const yParam = parseFloat(params.get('y'));
  if (!isNaN(yParam)) { root.style.scrollBehavior = 'auto'; window.scrollTo(0, yParam * vh); }
  onScroll(window.scrollY);
  requestAnimationFrame(loop);
})();
