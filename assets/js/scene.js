/* HESA Çelik — 3B fabrika sahnesi.
   Portal çerçeveli çelik bina, zamana bağlı yapım animasyonuyla kurulur:
   aplikasyon → temel → kolon → makas → aşık/kuşak/çapraz → cephe → çatı → ışıklar.
   Bütün modeller kodla üretilir; dış model dosyası yok. */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T) return;

  // ---- ölçüler (metre) ----
  const L = 48, HALF = 12, EAVE = 8, A = 10 * Math.PI / 180;
  const BAYS = 8, BAY = L / BAYS;
  const SINA = Math.sin(A), COSA = Math.cos(A), TANA = Math.tan(A);
  const BASE = 0.48;                 // kolon alt kotu (döşeme + kaide)
  const R0 = HALF + 0.25;            // makasın saçak ucu (z)
  const RLEN = R0 / COSA;            // makas boyu
  const WALL = HALF + 0.47;          // uzun cephe sacı
  const GABLE = L / 2 + 0.4;         // alın cephe sacı
  const frames = Array.from({ length: BAYS + 1 }, (_, i) => -L / 2 + i * BAY);

  const PHASES = [
    [0.0, 'Aplikasyon ve temel'],
    [1.7, 'Kolon montajı'],
    [3.5, 'Çatı kirişleri'],
    [5.1, 'Aşık, kuşak ve çaprazlar'],
    [6.6, 'Cephe panel kaplama'],
    [8.4, 'Çatı kaplama'],
    [9.9, 'Işıklar ve teslim']
  ];
  const DURATION = 11.4;

  // logo yolları (assets/img/logo.svg ile aynı)
  const LOGO_H = 'M0 0H13V24.5Q13 28.5 17 28.5H31Q35 28.5 35 24.5V0H48V64H35V39.5Q35 35.5 31 35.5H17Q13 35.5 13 39.5V64H0Z';
  const LOGO_ESA = 'M56 0H96V13H70V25.5H90V38.5H70V51H96V64H56Z M146 0V13H118V25.5H138L146 33.5V56L138 64H104V51H132V38.5H112L104 30.5V8L112 0Z M154 64V14L168 0H186L200 14V64H186V44H168V64Z M168 14H186V31H168Z';
  const LOGO_CELIK = 'M97.5 78H113.5V82.5H102V93.5H113.5V98H97.5Z M103.5 99.5H108V103.5H103.5Z M122.5 78H137.5V82.5H127V85.75H135.5V90.25H127V93.5H137.5V98H122.5Z M146.5 78H151V93.5H160.5V98H146.5Z M169.5 78H174V98H169.5Z M169.5 71.5H174V75.5H169.5Z M183 78H187.5V85.6L194 78H199.5L191.6 87.4L200 98H194.3L187.5 89.6V98H183Z';

  // ---- yardımcılar ----
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const eOut = k => 1 - Math.pow(1 - k, 3);
  const eInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const eSine = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
  const V = (x, y, z) => new T.Vector3(x, y, z);

  function roofPt(s, t, n, x) {
    return V(x || 0, EAVE - 0.05 + t * SINA + n * COSA, s * (R0 - t * COSA + n * SINA));
  }

  function iGeo(len, d, b, tf, tw) {
    const s = new T.Shape(), hb = b / 2, hd = d / 2, w = tw / 2;
    s.moveTo(-hb, -hd); s.lineTo(hb, -hd); s.lineTo(hb, -hd + tf); s.lineTo(w, -hd + tf);
    s.lineTo(w, hd - tf); s.lineTo(hb, hd - tf); s.lineTo(hb, hd); s.lineTo(-hb, hd);
    s.lineTo(-hb, hd - tf); s.lineTo(-w, hd - tf); s.lineTo(-w, -hd + tf); s.lineTo(-hb, -hd + tf);
    return new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  }

  // trapez profilli sac: x boyunca nervür, y yukarı, z dışa. topFn verilirse üst kenar eğimli olur.
  function sheetGeo(w, h, topFn, pitch, depth) {
    pitch = pitch || 0.333; depth = depth || 0.04;
    const n = Math.max(1, Math.round(w / pitch)), p = w / n;
    const px = [], pz = [];
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + i * p;
      px.push(x, x + 0.5 * p, x + 0.62 * p, x + 0.88 * p);
      pz.push(0, 0, depth, depth);
    }
    px.push(w / 2); pz.push(0);
    const pos = [], idx = [];
    for (let j = 0; j < px.length; j++) {
      pos.push(px[j], 0, pz[j], px[j], topFn ? topFn(px[j]) : h, pz[j]);
    }
    for (let j = 0; j < px.length - 1; j++) {
      const a = j * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // ======================================================================
  function start(opts) {
    const canvas = opts.canvas;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    const scene = new T.Scene();
    const HORIZON = 0x7a6253;
    scene.fog = new T.Fog(HORIZON, 70, 330);

    const camera = new T.PerspectiveCamera(32, 1, 0.5, 900);

    // ---- gökyüzü ----
    const sky = new T.Mesh(
      new T.SphereGeometry(600, 32, 16),
      new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: {
          cZen: { value: new T.Color(0x0a111c) },
          cMid: { value: new T.Color(0x222c3c) },
          cLow: { value: new T.Color(0x9a6a4c) },
          cHor: { value: new T.Color(HORIZON) },
          dim: { value: 1 }
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: [
          'uniform vec3 cZen, cMid, cLow, cHor; uniform float dim; varying vec3 vP;',
          'void main(){',
          '  float h = normalize(vP).y;',
          '  vec3 c = mix(cHor, cLow, smoothstep(-0.01, 0.035, h));',
          '  c = mix(c, cMid, smoothstep(0.03, 0.22, h));',
          '  c = mix(c, cZen, smoothstep(0.2, 0.75, h));',
          '  gl_FragColor = vec4(c * dim, 1.);',
          '  #include <tonemapping_fragment>',
          '  #include <colorspace_fragment>',
          '}'
        ].join('\n')
      })
    );
    sky.renderOrder = -1;
    scene.add(sky);

    // ---- yansıma ortamı ----
    (function () {
      const g = new T.SphereGeometry(50, 32, 16);
      const col = [], p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const h = p.getY(i) / 50;
        const c = h < 0 ? [0.1, 0.09, 0.08]
          : h < 0.12 ? [1.3, 0.85, 0.55]
          : [lerp(0.6, 0.18, clamp01(h)), lerp(0.6, 0.24, clamp01(h)), lerp(0.62, 0.34, clamp01(h))];
        col.push(c[0], c[1], c[2]);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      const envScene = new T.Scene();
      envScene.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      const pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(envScene, 0.04).texture;
      pm.dispose();
    })();

    // ---- ışıklar ----
    const hemi = new T.HemisphereLight(0x9fb3d1, 0x3b3029, 0.7);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xffd3a6, 3.2);
    sun.position.set(-46, 38, 62);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 34, bottom: -30, near: 10, far: 180 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    const flash = new T.PointLight(0xffa04a, 0, 9, 2);
    scene.add(flash);
    const lampA = new T.PointLight(0xffb36e, 0, 16, 2);
    lampA.position.set(GABLE + 1.4, 6.2, 0);
    const lampB = new T.PointLight(0xffb36e, 0, 18, 2);
    lampB.position.set(-4, 4.4, WALL + 1.6);
    scene.add(lampA, lampB);

    // ---- malzemeler ----
    const M = {
      frame: new T.MeshStandardMaterial({ color: 0xc4521d, metalness: 0.45, roughness: 0.5 }),
      galv: new T.MeshStandardMaterial({ color: 0xb4bac0, metalness: 0.85, roughness: 0.34 }),
      brace: new T.MeshStandardMaterial({ color: 0x30353a, metalness: 0.6, roughness: 0.5 }),
      concrete: new T.MeshStandardMaterial({ color: 0x8c8a85, roughness: 0.95 }),
      slab: new T.MeshStandardMaterial({ color: 0x6f6d69, roughness: 0.92 }),
      plate: new T.MeshStandardMaterial({ color: 0x5b6066, metalness: 0.7, roughness: 0.45 }),
      wallLow: new T.MeshStandardMaterial({ color: 0xa7adb3, metalness: 0.65, roughness: 0.38, flatShading: true, side: T.DoubleSide }),
      wallTop: new T.MeshStandardMaterial({ color: 0x394046, metalness: 0.6, roughness: 0.42, flatShading: true, side: T.DoubleSide }),
      roof: new T.MeshStandardMaterial({ color: 0xc6cacf, metalness: 0.6, roughness: 0.44, flatShading: true, side: T.DoubleSide }),
      trim: new T.MeshStandardMaterial({ color: 0x2a2f34, metalness: 0.6, roughness: 0.45 }),
      lamp: new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc58a, emissiveIntensity: 0 })
    };

    const glassTex = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#111';
      for (let x = 0; x <= w; x += 64) c.fillRect(x - 3, 0, 6, h);
      c.fillRect(0, 0, w, 4); c.fillRect(0, h - 4, w, 4);
    });
    glassTex.wrapS = T.RepeatWrapping;
    M.glass = new T.MeshStandardMaterial({
      color: 0x2a343d, map: glassTex, metalness: 0.3, roughness: 0.12,
      emissive: 0xffc48a, emissiveMap: glassTex, emissiveIntensity: 0, side: T.DoubleSide
    });
    M.sky = new T.MeshStandardMaterial({ color: 0x8e9aa4, metalness: 0.1, roughness: 0.3, emissive: 0xffd2a0, emissiveIntensity: 0, transparent: true, opacity: 0.9 });

    const all = new T.Group();
    scene.add(all);

    function mesh(geo, mat, parent, shadow) {
      const m = new T.Mesh(geo, mat);
      if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
      (parent || all).add(m);
      return m;
    }

    // ---- zaman çizelgesi ----
    const tracks = [], cues = [];
    const track = (s, d, fn, ease) => tracks.push({ s, d, fn, ease: ease || eOut });
    const cue = (at, fn) => cues.push({ at, fn, done: false });
    // nesneyi k=0'da gizleyen ölçek animasyonu
    function grow(obj, s, d, axis, ease) {
      track(s, d, k => {
        obj.visible = k > 0.001;
        obj.scale[axis] = Math.max(k, 0.001);
      }, ease);
    }
    function drop(obj, s, d, h) {
      const y0 = obj.position.y;
      track(s, d, k => { obj.visible = k > 0; obj.position.y = y0 + (1 - k) * h; }, eOut);
    }

    // ---- kıvılcımlar ----
    const SP = 600;
    const spPos = new Float32Array(SP * 3), spCol = new Float32Array(SP * 3);
    const spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spMax = new Float32Array(SP);
    for (let i = 0; i < SP; i++) spPos[i * 3 + 1] = -100;
    const spGeo = new T.BufferGeometry();
    spGeo.setAttribute('position', new T.BufferAttribute(spPos, 3));
    spGeo.setAttribute('color', new T.BufferAttribute(spCol, 3));
    const spTex = canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    const sparksObj = new T.Points(spGeo, new T.PointsMaterial({
      size: 0.16, map: spTex, vertexColors: true, transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    }));
    sparksObj.frustumCulled = false;
    scene.add(sparksObj);
    let spHead = 0, flashK = 0;
    function sparks(x, y, z, n) {
      for (let k = 0; k < n; k++) {
        const i = spHead; spHead = (spHead + 1) % SP;
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
        spPos[i * 3] = x; spPos[i * 3 + 1] = y; spPos[i * 3 + 2] = z;
        spVel[i * 3] = Math.cos(a) * sp; spVel[i * 3 + 1] = 1.5 + Math.random() * 4.5; spVel[i * 3 + 2] = Math.sin(a) * sp;
        spMax[i] = spLife[i] = 0.35 + Math.random() * 0.6;
      }
      flash.position.set(x, y + 0.4, z);
      flashK = 1;
    }
    function updateSparks(dt) {
      for (let i = 0; i < SP; i++) {
        if (spLife[i] <= 0) continue;
        spLife[i] -= dt;
        const j = i * 3;
        spVel[j + 1] -= 9.8 * dt;
        spPos[j] += spVel[j] * dt; spPos[j + 1] += spVel[j + 1] * dt; spPos[j + 2] += spVel[j + 2] * dt;
        if (spPos[j + 1] < 0.16) { spPos[j + 1] = 0.16; spVel[j + 1] *= -0.3; spVel[j] *= 0.5; spVel[j + 2] *= 0.5; }
        const f = Math.max(spLife[i] / spMax[i], 0);
        spCol[j] = f * 1.4; spCol[j + 1] = f * f * 0.9; spCol[j + 2] = f * f * f * 0.45;
        if (spLife[i] <= 0) { spCol[j] = spCol[j + 1] = spCol[j + 2] = 0; spPos[j + 1] = -100; }
      }
      spGeo.attributes.position.needsUpdate = true;
      spGeo.attributes.color.needsUpdate = true;
      flashK = Math.max(0, flashK - dt * 5);
      flash.intensity = flashK * flashK * 60;
    }

    // ======================= SAHA =======================
    const groundTex = canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#2e2f30'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = 30 + Math.random() * 40 | 0;
        c.fillStyle = `rgba(${v},${v},${v - 4},.5)`;
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
    groundTex.wrapS = groundTex.wrapT = T.RepeatWrapping;
    groundTex.repeat.set(60, 60);
    const ground = new T.Mesh(new T.PlaneGeometry(1200, 1200), new T.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const apronTex = canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#4c4b48'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) {
        const v = 62 + Math.random() * 30 | 0;
        c.fillStyle = `rgba(${v},${v},${v - 3},.35)`;
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      c.strokeStyle = 'rgba(20,20,20,.55)'; c.lineWidth = 2;
      c.strokeRect(1, 1, w - 2, h - 2);
    });
    apronTex.wrapS = apronTex.wrapT = T.RepeatWrapping;
    apronTex.repeat.set(13, 8);
    const apron = new T.Mesh(new T.PlaneGeometry(L + 40, HALF * 2 + 40), new T.MeshStandardMaterial({ map: apronTex, roughness: 0.95 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(6, 0.01, 0);
    apron.receiveShadow = true;
    scene.add(apron);

    // ağaçlar ve aydınlatma direkleri — ölçek hissi için
    (function () {
      const crown = new T.ConeGeometry(1.7, 5.5, 7);
      const trunk = new T.CylinderGeometry(0.15, 0.2, 1.4, 5);
      const mC = new T.MeshStandardMaterial({ color: 0x27342b, roughness: 1, flatShading: true });
      const mT = new T.MeshStandardMaterial({ color: 0x2b2420, roughness: 1 });
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const spots = [];
      for (let i = 0; i < 16; i++) spots.push([-46 + i * 6.6 + rnd() * 3, -HALF - 26 - rnd() * 6]);
      for (let i = 0; i < 7; i++) spots.push([-L / 2 - 26 - rnd() * 6, -26 + i * 8.5 + rnd() * 3]);
      for (const [x, z] of spots) {
        const s = 0.8 + rnd() * 0.6;
        const c = new T.Mesh(crown, mC); c.position.set(x, 1.4 + 2.75 * s, z); c.scale.setScalar(s); c.castShadow = true;
        const t = new T.Mesh(trunk, mT); t.position.set(x, 0.7, z);
        scene.add(c, t);
      }
      const pole = new T.CylinderGeometry(0.09, 0.13, 10, 6);
      const head = new T.BoxGeometry(0.9, 0.18, 0.45);
      for (const [x, z] of [[-L / 2 - 14, HALF + 14], [L / 2 + 16, -HALF - 14], [-L / 2 - 14, -HALF - 14]]) {
        const p = new T.Mesh(pole, M.trim); p.position.set(x, 5, z); p.castShadow = true;
        const hd = new T.Mesh(head, M.lamp); hd.position.set(x, 10, z); hd.lookAt(0, 10, 0);
        scene.add(p, hd);
      }
    })();

    // ======================= 1) APLİKASYON + TEMEL =======================
    const bpMat = new T.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const bp = { k: 0, fade: 1, lines: [], labels: [] };
    function bpLine(x, z, lx, lz, s) {
      const m = new T.Mesh(new T.PlaneGeometry(lx, lz), bpMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.17, z);
      m.visible = false;
      scene.add(m);
      track(s, 0.8, k => { m.visible = k > 0.001; if (lx > lz) m.scale.x = Math.max(k, 0.001); else m.scale.y = Math.max(k, 0.001); }, eInOut);
    }
    function bpLabel(txt, x, z, s) {
      const tex = canvasTex(128, 128, (c) => {
        c.strokeStyle = '#ff7a2e'; c.lineWidth = 7;
        c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#ff7a2e'; c.font = '600 60px "JetBrains Mono", monospace';
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 64, 68);
      });
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      sp.scale.set(1.15, 1.15, 1);
      sp.position.set(x, 0.9, z);
      scene.add(sp);
      bp.labels.push({ sp, s });
    }
    bpLine(0, -HALF, L + 9, 0.07, 0.15);
    bpLine(0, HALF, L + 9, 0.07, 0.3);
    bpLine(0, 0, L + 9, 0.035, 0.45);
    bpLabel('A', -L / 2 - 6, -HALF, 0.5);
    bpLabel('B', -L / 2 - 6, HALF, 0.6);
    frames.forEach((x, i) => {
      bpLine(x, 0, 0.07, HALF * 2 + 9, 0.25 + i * 0.07);
      bpLabel(String(i + 1), x, HALF + 6, 0.55 + i * 0.07);
    });
    // çizgilerin görünürlüğü: aç, sonra cephe kaplanırken sön
    track(0.1, 0.6, k => { bp.k = k; });
    track(7.0, 1.6, k => { bp.fade = 1 - k; }, eInOut);
    function updateBlueprint() {
      bpMat.opacity = 0.85 * bp.k * bp.fade;
      for (const l of bp.labels) l.sp.material.opacity = bp.k * bp.fade * clamp01((tNow - l.s) / 0.4);
    }

    // döşeme
    const slab = mesh(new T.BoxGeometry(L + 3, 0.15, HALF * 2 + 3).translate(0, 0.075, 0), M.slab);
    slab.castShadow = false;
    track(0.55, 1.1, k => { slab.visible = k > 0.001; slab.scale.set(Math.max(k, 0.001), 1, Math.max(k, 0.001)); });

    // kaide + taban levhası
    const pedGeo = new T.BoxGeometry(0.8, 0.33, 0.95).translate(0, 0.165, 0);
    const plGeo = new T.BoxGeometry(0.42, 0.03, 0.72).translate(0, 0.015, 0);
    frames.forEach((x, i) => {
      for (const s of [-1, 1]) {
        const p = mesh(pedGeo, M.concrete); p.position.set(x, 0.15, s * HALF);
        grow(p, 1.0 + i * 0.06 + (s > 0 ? 0.03 : 0), 0.45, 'y');
        const pl = mesh(plGeo, M.plate); pl.position.set(x, BASE, s * HALF);
        grow(pl, 1.35 + i * 0.06, 0.25, 'y');
      }
    });
    // subasman (perde duvar)
    for (const s of [-1, 1]) {
      const pw = mesh(new T.BoxGeometry(L + 1.1, 0.5, 0.25).translate(0, 0.25, 0), M.concrete);
      pw.position.set(0, 0.15, s * (HALF + 0.35));
      grow(pw, 1.25, 0.6, 'y');
      const pg = mesh(new T.BoxGeometry(0.25, 0.5, HALF * 2 + 0.95).translate(0, 0.25, 0), M.concrete);
      pg.position.set(s * (L / 2 + 0.28), 0.15, 0);
      grow(pg, 1.3, 0.6, 'y');
    }

    // ======================= 2) KOLONLAR =======================
    const colGeo = iGeo(EAVE - BASE + 0.1, 0.5, 0.3, 0.03, 0.018).rotateX(-Math.PI / 2);
    frames.forEach((x, i) => {
      for (const s of [-1, 1]) {
        const c = mesh(colGeo, M.frame);
        c.position.set(x, BASE, s * HALF);
        const st = 1.7 + i * 0.15 + (s > 0 ? 0.07 : 0);
        drop(c, st, 0.85, 13);
        cue(st + 0.85, () => sparks(x, BASE + 0.05, s * HALF, 20));
      }
    });

    // ======================= 3) MAKASLAR =======================
    const rafGeo = iGeo(RLEN + 0.02, 0.55, 0.25, 0.028, 0.016);
    frames.forEach((x, i) => {
      for (const s of [-1, 1]) {
        const r = mesh(rafGeo, M.frame);
        r.rotation.x = s > 0 ? Math.PI + A : -A;
        r.position.set(x, EAVE - 0.05, s * R0);
        const st = 3.5 + i * 0.14 + (s > 0 ? 0.09 : 0);
        drop(r, st, 0.8, 11);
        cue(st + 0.8, () => sparks(x, EAVE + 0.1, s * HALF, 16));
        if (s > 0) cue(st + 0.85, () => sparks(x, EAVE + HALF * TANA, 0, 12));
      }
    });
    // alın cephe dikmeleri
    for (const ex of [frames[0], frames[BAYS]]) {
      for (const z of [-6, 0, 6]) {
        const top = EAVE - 0.05 + (R0 - Math.abs(z)) * TANA - 0.3;
        const p = mesh(iGeo(top - BASE, 0.3, 0.2, 0.02, 0.012).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), M.frame);
        p.position.set(ex, BASE, z);
        const st = 4.9 + (ex > 0 ? 0.15 : 0) + (z + 6) * 0.02;
        drop(p, st, 0.6, 9);
        cue(st + 0.6, () => sparks(ex, BASE + 0.05, z, 8));
      }
    }

    // ======================= 4) AŞIK / KUŞAK / ÇAPRAZ =======================
    const purGeo = new T.BoxGeometry(L + 0.8, 0.2, 0.07).translate((L + 0.8) / 2, 0, 0);
    for (const s of [1, -1]) {
      for (let j = 0; j < 9; j++) {
        const t = 0.25 + j * (RLEN - 0.45) / 8;
        const p = mesh(purGeo, M.galv);
        p.position.copy(roofPt(s, t, 0.375, -L / 2 - 0.4));
        p.rotation.x = s * A;
        grow(p, 5.1 + j * 0.07 + (s < 0 ? 0.12 : 0), 0.85, 'x', eInOut);
      }
    }
    const girtGeo = new T.BoxGeometry(L + 0.8, 0.07, 0.2).translate((L + 0.8) / 2, 0, 0);
    [1.5, 3.1, 4.5, 5.9, 7.5].forEach((h, j) => {
      for (const s of [1, -1]) {
        const g = mesh(girtGeo, M.galv);
        g.position.set(-L / 2 - 0.4, h, s * (HALF + 0.35));
        grow(g, 5.35 + j * 0.06 + (s < 0 ? 0.1 : 0), 0.8, 'x', eInOut);
      }
    });
    const gGirtGeo = new T.BoxGeometry(0.2, 0.07, HALF * 2 + 0.7).translate(0, 0, HALF + 0.35);
    [1.5, 3.1, 4.5, 5.9, 7.5].forEach((h, j) => {
      for (const s of [1, -1]) {
        const g = mesh(gGirtGeo, M.galv);
        g.position.set(s * (L / 2 + 0.27), h, -HALF - 0.35);
        grow(g, 5.55 + j * 0.06, 0.6, 'z', eInOut);
      }
    });
    const rodGeo = new T.CylinderGeometry(0.03, 0.03, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    let nRod = 0;
    function rod(p1, p2) {
      const m = mesh(rodGeo, M.brace);
      m.position.copy(p1);
      m.lookAt(p2);
      const len = p1.distanceTo(p2);
      const st = 5.7 + (nRod++) * 0.035;
      track(st, 0.45, k => { m.visible = k > 0.001; m.scale.z = Math.max(k * len, 0.001); });
    }
    for (const [b0, b1] of [[0, 1], [BAYS - 1, BAYS]]) {
      const x0 = frames[b0], x1 = frames[b1];
      for (const s of [1, -1]) {
        const z = s * HALF;
        rod(V(x0, BASE + 0.3, z), V(x1, EAVE - 0.3, z));
        rod(V(x1, BASE + 0.3, z), V(x0, EAVE - 0.3, z));
        rod(roofPt(s, 0.5, 0.2, x0), roofPt(s, RLEN - 0.4, 0.2, x1));
        rod(roofPt(s, 0.5, 0.2, x1), roofPt(s, RLEN - 0.4, 0.2, x0));
      }
    }

    // ======================= 5) CEPHE KAPLAMA =======================
    const bayX = b => -L / 2 + b * BAY + BAY / 2;
    function bayW(b) {
      const ext = WALL - HALF + 0.05; // köşeyi alın sacına kadar uzat
      if (b === 0) return [BAY + ext, -ext / 2];
      if (b === BAYS - 1) return [BAY + ext, ext / 2];
      return [BAY, 0];
    }
    const glassMats = [];
    const lowH = 4.6 - 0.65, topH = EAVE + 0.35 - 5.8;
    const glassGeo = new T.PlaneGeometry(1, 1.2).translate(0, 0.6, 0.02);
    for (let b = 0; b < BAYS; b++) {
      const [w, dx] = bayW(b);
      const gLow = sheetGeo(w, lowH), gTop = sheetGeo(w, topH);
      for (const s of [1, -1]) {
        const grp = new T.Group();
        grp.position.set(bayX(b) + dx, 0, s * WALL);
        if (s < 0) grp.rotation.y = Math.PI;
        all.add(grp);
        const st = 6.6 + b * 0.11 + (s < 0 ? 0.22 : 0);
        const lo = mesh(gLow, M.wallLow, grp); lo.position.y = 0.65; grow(lo, st, 0.55, 'y');
        const gl = mesh(glassGeo, M.glass, grp, false); gl.scale.x = w; gl.position.y = 4.6;
        const gm = gl.material = M.glass.clone();
        gm.map = glassTex.clone(); gm.map.repeat.x = w / 6; gm.map.needsUpdate = true;
        gm.emissiveMap = gm.map;
        glassMats.push(gm);
        track(st + 0.35, 0.4, k => { gl.visible = k > 0.001; gl.scale.y = Math.max(k, 0.001); });
        const tp = mesh(gTop, M.wallTop, grp); tp.position.y = 5.8; grow(tp, st + 0.5, 0.5, 'y');
      }
    }
    // alın cepheler
    const gW = (WALL + 0.05) * 2;
    const gTopFn = x => EAVE - 0.05 + (R0 - Math.abs(x)) * TANA + 0.42 - 5.8;
    const gLowGeo = sheetGeo(gW, 5.8 - 0.65);
    const gTopGeo = sheetGeo(gW, 0, gTopFn);
    for (const s of [-1, 1]) {
      const grp = new T.Group();
      grp.position.set(s * GABLE, 0, 0);
      grp.rotation.y = s * Math.PI / 2;
      all.add(grp);
      const st = s < 0 ? 6.75 : 7.45;
      const lo = mesh(gLowGeo, M.wallLow, grp); lo.position.y = 0.65; grow(lo, st, 0.8, 'y');
      const tp = mesh(gTopGeo, M.wallTop, grp); tp.position.y = 5.8; grow(tp, st + 0.45, 0.6, 'y');
    }
    // seksiyonel kapı + saçak (+x alın)
    const doorTex = canvasTex(256, 280, (c, w, h) => {
      c.fillStyle = '#c9ced2'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 35) {
        c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, y, w, 3);
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, y + 3, w, 2);
      }
      c.fillStyle = '#222b33';
      for (let x = 18; x < w - 20; x += 46) c.fillRect(x, 82, 34, 18);
    });
    const door = mesh(new T.PlaneGeometry(5.2, 5.6).translate(0, 2.8, 0), new T.MeshStandardMaterial({ map: doorTex, metalness: 0.5, roughness: 0.45 }));
    door.position.set(GABLE + 0.07, 0.15, 0);
    door.rotation.y = Math.PI / 2;
    grow(door, 8.15, 0.5, 'y');
    const doorFrame = mesh(new T.BoxGeometry(0.12, 6.0, 5.8).translate(0, 3.0, 0), M.trim);
    doorFrame.position.set(GABLE + 0.02, 0.1, 0);
    grow(doorFrame, 8.0, 0.4, 'y');
    const canopy = mesh(new T.BoxGeometry(1.6, 0.14, 6.6), M.wallTop);
    canopy.position.set(GABLE + 0.8, 6.15, 0);
    grow(canopy, 8.45, 0.4, 'x');
    const lampDoor = mesh(new T.BoxGeometry(0.3, 0.12, 0.6), M.lamp, all, false);
    lampDoor.position.set(GABLE + 1.4, 6.02, 0);
    grow(lampDoor, 8.6, 0.2, 'y');
    // personel kapısı (+z)
    const pdoor = mesh(new T.BoxGeometry(1.1, 2.3, 0.08).translate(0, 1.15, 0), M.trim);
    pdoor.position.set(14, 0.15, WALL + 0.05);
    grow(pdoor, 7.8, 0.3, 'y');
    // duvar lambaları (+z)
    for (const x of [-16, -4, 8, 20]) {
      const l = mesh(new T.BoxGeometry(0.4, 0.2, 0.25), M.lamp, all, false);
      l.position.set(x, 4.35, WALL + 0.15);
      grow(l, 8.0, 0.2, 'y');
    }

    // tabela (kanallı harf, ışıklı)
    const signTex = canvasTex(2280, 416, (c) => {
      c.scale(4, 4);
      c.translate(4, 18);
      c.fillStyle = '#ff6b1a'; c.fill(new Path2D(LOGO_H));
      c.fillStyle = '#eef1f4'; c.fill(new Path2D(LOGO_ESA), 'evenodd');
      c.save(); c.translate(230, 0); c.scale(3.2, 3.2); c.translate(-97.5, -78);
      c.fillStyle = '#c3c9cf'; c.fill(new Path2D(LOGO_CELIK)); c.restore();
    });
    const signMat = new T.MeshStandardMaterial({
      map: signTex, transparent: true, alphaTest: 0.3, metalness: 0.3, roughness: 0.4,
      emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0
    });
    const sign = mesh(new T.PlaneGeometry(11, 2.0), signMat, all, false);
    sign.position.set(10, 7.05, WALL + 0.14);
    sign.castShadow = true;
    grow(sign, 8.35, 0.7, 'x', eInOut);

    // ======================= 6) ÇATI KAPLAMA =======================
    const rLen = RLEN + 0.52;
    const basis = new T.Matrix4();
    const lights = [];
    for (let b = 0; b < BAYS; b++) {
      const [w, dx] = bayW(b);
      const g = sheetGeo(w + 0.04, rLen).translate(0, -rLen, 0);
      for (const s of [1, -1]) {
        const m = mesh(g, M.roof);
        m.position.copy(roofPt(s, RLEN, 0.5, bayX(b) + dx));
        basis.makeBasis(V(s, 0, 0), V(0, SINA, -s * COSA), V(0, COSA, s * SINA));
        m.quaternion.setFromRotationMatrix(basis);
        const st = 8.4 + b * 0.1 + (s < 0 ? 0.15 : 0);
        grow(m, st, 0.55, 'y');
        // ışıklık şeridi
        if (b % 2 === 1) {
          const sl = mesh(new T.PlaneGeometry(1.4, 5.5).translate(0, -6.5, 0.06), M.sky, m, false);
          sl.castShadow = false;
          lights.push(sl);
        }
      }
    }
    const ridge = mesh(new T.BoxGeometry(L + 1.0, 0.1, 0.9).translate((L + 1) / 2, 0, 0), M.trim);
    ridge.position.set(-L / 2 - 0.5, roofPt(1, RLEN, 0.56).y + 0.02, 0);
    grow(ridge, 9.35, 0.6, 'x', eInOut);
    for (const s of [1, -1]) {
      const gut = mesh(new T.BoxGeometry(L + 1.0, 0.2, 0.22).translate((L + 1) / 2, 0, 0), M.trim);
      gut.position.set(-L / 2 - 0.5, roofPt(s, -0.5, 0.42).y - 0.1, s * (WALL + 0.2));
      grow(gut, 9.4, 0.6, 'x', eInOut);
    }

    // ======================= 7) IŞIKLAR =======================
    const lightK = { v: 0 };
    track(9.9, 1.3, k => { lightK.v = k; }, eSine);
    function updateLights() {
      const k = lightK.v;
      for (const m of glassMats) m.emissiveIntensity = k * 1.5;
      M.sky.emissiveIntensity = k * 0.9;
      signMat.emissiveIntensity = k * 1.1;
      M.lamp.emissiveIntensity = k * 3;
      lampA.intensity = k * 70;
      lampB.intensity = k * 55;
      sun.intensity = lerp(3.2, 2.4, k);
      hemi.intensity = lerp(0.7, 0.5, k);
      sky.material.uniforms.dim.value = lerp(1, 0.82, k);
    }

    // ======================= KAMERA =======================
    const camKeys = [
      [0.0, V(10, 40, 50), V(-2, 0, 0)],
      [2.7, V(33, 5.5, 33), V(-7, 3, 0)],
      [6.3, V(54, 11, 25), V(-1, 4, 0)],
      [10.9, V(52, 17, 60), V(1.5, 4.2, 0)]
    ];
    const posCurve = new T.CatmullRomCurve3(camKeys.map(k => k[1]), false, 'centripetal');
    const tgtCurve = new T.CatmullRomCurve3(camKeys.map(k => k[2]), false, 'centripetal');
    const camEnd = camKeys[camKeys.length - 1][0];
    function introU(t) {
      const tt = eSine(clamp01(t / camEnd)) * camEnd;
      for (let i = 0; i < camKeys.length - 1; i++) {
        const a = camKeys[i][0], b = camKeys[i + 1][0];
        if (tt <= b) return (i + (tt - a) / (b - a)) / (camKeys.length - 1);
      }
      return 1;
    }

    // ======================= DÖNGÜ =======================
    let tNow = 0, time = 0, running = true, frozen = false, doneSent = false, lastPhase = -1;
    let W = 1, H = 1, distF = 1;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let scrollP = 0;
    const reduced = !!opts.reduced;

    function resize() {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      renderer.setSize(W, H, false);
      const asp = W / H;
      camera.aspect = asp;
      camera.fov = asp < 0.8 ? 44 : asp < 1.2 ? 38 : 32;
      distF = asp < 1.25 ? Math.pow(1.25 / asp, 0.75) : 1;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    function apply(t, silent) {
      tNow = t;
      for (const k of tracks) k.fn(k.ease(clamp01((t - k.s) / k.d)));
      for (const c of cues) if (!c.done && t >= c.at) { c.done = true; if (!silent) c.fn(); }
      updateBlueprint();
      updateLights();
    }

    const UP = V(0, 1, 0), tmpP = V(0, 0, 0), tmpT = V(0, 0, 0), off = V(0, 0, 0);
    function placeCamera() {
      const u = introU(tNow);
      posCurve.getPoint(u, tmpP);
      tgtCurve.getPoint(u, tmpT);
      const idle = reduced ? 0 : eSine(clamp01((tNow - DURATION + 0.6) / 1.8));
      pointer.sx += (pointer.x - pointer.sx) * 0.04;
      pointer.sy += (pointer.y - pointer.sy) * 0.04;
      const sp = reduced ? 0 : scrollP;
      off.subVectors(tmpP, tmpT);
      const ang = idle * (Math.sin(time * 0.11) * 0.06 + pointer.sx * 0.07) + sp * 0.5;
      off.applyAxisAngle(UP, ang);
      off.y += idle * (-pointer.sy * 1.4) + sp * 9;
      off.multiplyScalar(distF * (1 - sp * 0.12));
      tmpT.y += sp * 2.5;
      camera.position.copy(tmpT).add(off);
      camera.lookAt(tmpT);
      // bina, metin gelince sağa (yatay ekran) ya da yukarı (dikey ekran) kayar
      const k = eInOut(clamp01((tNow - DURATION + 1.6) / 1.6));
      if (W / H > 1.15) camera.setViewOffset(W, H, -W * 0.15 * k, 0, W, H);
      else camera.setViewOffset(W, H, 0, H * 0.17 * k, W, H);
      sky.position.copy(camera.position);
    }

    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (document.hidden) return;
      time += dt;
      if (running) {
        const t = tNow + dt;
        apply(t);
        let ph = 0;
        for (let i = 0; i < PHASES.length; i++) if (t >= PHASES[i][0]) ph = i;
        if (ph !== lastPhase) { lastPhase = ph; opts.onPhase && opts.onPhase(ph, PHASES[ph][1]); }
        opts.onProgress && opts.onProgress(clamp01(t / DURATION), t);
        if (t >= DURATION - 1.4 && !doneSent) { doneSent = true; opts.onDone && opts.onDone(); }
        if (t >= DURATION + 2) running = false;
      } else {
        if (!frozen) tNow += dt; // kamera rölantisi için
      }
      updateSparks(dt);
      if (scrollP > 1.1) return;
      placeCamera();
      renderer.render(scene, camera);
    }

    function skip() {
      for (const c of cues) c.done = true;
      apply(DURATION + 2, true);
      lastPhase = PHASES.length - 1;
      opts.onPhase && opts.onPhase(lastPhase, PHASES[lastPhase][1]);
      opts.onProgress && opts.onProgress(1, DURATION);
      if (!doneSent) { doneSent = true; opts.onDone && opts.onDone(); }
      running = false;
    }
    function replay() {
      for (const c of cues) c.done = false;
      frozen = false; doneSent = false; lastPhase = -1; running = true;
      apply(0, true);
    }

    if (opts.skipIntro) skip(); else apply(0, true);
    requestAnimationFrame(t => { last = t; frame(t); });

    return {
      skip, replay,
      phases: PHASES.map(p => ({ t: p[0], name: p[1] })),
      duration: DURATION,
      setScroll(p) { scrollP = p; },
      setPointer(x, y) { pointer.x = x; pointer.y = y; },
      // ekran görüntüsü / test için: zamanı elle ayarla
      seek(t) { for (const c of cues) c.done = t >= c.at; running = false; frozen = true; apply(t, true); }
    };
  }

  window.HesaScene = { start };
})();
