/* Extra "wow" layer: WebGL ambient background, particles, HUD, glitch, scrub-able trailer, etc. */
(() => {
  'use strict';
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, K = window.__kg;
  if (!gsap || !ScrollTrigger || !K) return;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const { reduce, finePointer } = K;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* =====================================================
     1. WebGL ambient background (palette follows section)
     ===================================================== */
  const PAL = {
    pink: [1, 0.18, 0.7, 0.24, 0.94, 1, 0.55, 0.24, 1],
    cyan: [0.24, 0.94, 1, 0.55, 0.24, 1, 1, 0.18, 0.7],
    sun: [0.96, 1, 0.24, 1, 0.18, 0.7, 0.24, 0.94, 1],
    red: [0.92, 0.03, 0.08, 1, 0.4, 0.1, 0.45, 0, 0.12],
  };
  const col = new Float32Array(PAL.pink);
  let palTween = null;
  const setPalette = (name) => {
    const to = PAL[name] || PAL.pink;
    const from = Float32Array.from(col);
    const p = { t: 0 };
    palTween?.kill();
    palTween = gsap.to(p, {
      t: 1, duration: 1.6, ease: 'power2.inOut',
      onUpdate: () => { for (let i = 0; i < 9; i++) col[i] = lerp(from[i], to[i], p.t); },
    });
  };

  const bg = $('#bg');
  let gl = null, uni = {};
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uScroll;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uAmp;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=uv; p.x*=uRes.x/uRes.y;
  float t=uTime*.07;
  p.y+=uScroll*.00022;
  vec2 m=uMouse; m.x*=uRes.x/uRes.y;
  vec2 q=vec2(fbm(p*1.5+t),fbm(p*1.5+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p*1.5+3.*q+vec2(1.7,9.2)+t*1.3),fbm(p*1.5+3.*q+vec2(8.3,2.8)-t));
  float f=fbm(p*1.5+3.*r);
  float d=distance(p,m);
  f+=.42*exp(-d*3.2);
  vec3 c=mix(uA,uB,clamp(f*f*3.2,0.,1.));
  c=mix(c,uC,clamp(length(q)*.9,0.,1.)*.65);
  float inten=smoothstep(.28,.95,f)*uAmp;
  vec3 o=vec3(.02,0.,.03)+c*inten;
  o*=mix(.5,1.,smoothstep(1.15,.15,distance(uv,vec2(.5))));
  o+=(hash(gl_FragCoord.xy+uTime)-.5)*.018;
  gl_FragColor=vec4(o,1.);
}`;

  function initGL() {
    try { gl = bg.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return false;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uTime', 'uMouse', 'uScroll', 'uA', 'uB', 'uC', 'uAmp'].forEach((n) => (uni[n] = gl.getUniformLocation(prog, n)));
      return true;
    } catch (e) { gl = null; return false; }
  }

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; });
  const resizeBG = () => {
    const s = innerWidth < 760 ? 0.4 : 0.5;
    bg.width = Math.max(2, Math.round(innerWidth * s));
    bg.height = Math.max(2, Math.round(innerHeight * s));
    gl && gl.viewport(0, 0, bg.width, bg.height);
  };
  let bgOK = false;
  if (bg && initGL()) {
    bgOK = true;
    document.documentElement.classList.add('has-gl');
    resizeBG();
    addEventListener('resize', resizeBG);
    let t0 = performance.now(), scrollY = 0;
    const draw = () => {
      if (document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      scrollY += (window.scrollY - scrollY) * 0.1;
      gl.uniform2f(uni.uRes, bg.width, bg.height);
      gl.uniform1f(uni.uTime, (performance.now() - t0) / 1000);
      gl.uniform2f(uni.uMouse, mouse.x, mouse.y);
      gl.uniform1f(uni.uScroll, scrollY);
      gl.uniform3f(uni.uA, col[0], col[1], col[2]);
      gl.uniform3f(uni.uB, col[3], col[4], col[5]);
      gl.uniform3f(uni.uC, col[6], col[7], col[8]);
      gl.uniform1f(uni.uAmp, 0.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    if (reduce) draw(); else gsap.ticker.add(draw);
  }

  /* =====================================================
     2. Section HUD, dot nav, palette switching
     ===================================================== */
  const SECTIONS = [
    ['hero', 'Intro'], ['brands', 'Brands'], ['content', 'Content creation'], ['pitch', 'Pitch decks'],
    ['website', 'Website creation'], ['projects', 'Projects'], ['podcast', 'Podcast guest'],
    ['trailer', 'Netflix trailer'], ['posters', 'Posters'],
  ];
  const hudNum = $('#hudNum'), hudName = $('#hudName'), dots = $('#dots');
  dots.innerHTML = SECTIONS.map(([id, n]) => `<i data-id="${id}" title="${n}"></i>`).join('');
  let currentHud = '';
  const setHud = (id) => {
    if (id === currentHud) return;
    currentHud = id;
    const idx = SECTIONS.findIndex((s) => s[0] === id);
    if (idx < 0) return;
    hudNum.textContent = String(idx + 1).padStart(2, '0');
    scramble(hudName, SECTIONS[idx][1]);
    $$('i', dots).forEach((d) => d.classList.toggle('on', d.dataset.id === id));
    setPalette($('#' + id)?.dataset.pal);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setHud(e.target.id)), { rootMargin: '-48% 0px -48% 0px' });
    SECTIONS.forEach(([id]) => { const el = $('#' + id); el && io.observe(el); });
  }
  setPalette('pink');

  /* =====================================================
     3. Text scramble
     ===================================================== */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
  function scramble(el, text, dur = 0.8) {
    const final = text ?? el.dataset.text ?? el.textContent;
    el.dataset.text = final;
    el._sc?.kill();
    if (reduce) { el.textContent = final; return; }
    const o = { t: 0 };
    el._sc = gsap.to(o, {
      t: 1, duration: dur, ease: 'none',
      onUpdate() {
        const n = Math.floor(o.t * final.length);
        let s = '';
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          s += i < n || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = s;
      },
      onComplete() { el.textContent = final; },
    });
  }
  $$('.nav__links a').forEach((a) => {
    a.dataset.text = a.textContent;
    a.addEventListener('pointerenter', () => scramble(a, null, 0.45));
  });
  $$('.eyebrow').forEach((el) => {
    const txt = el.textContent;
    el.dataset.text = txt;
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => scramble(el, txt, 1) });
  });

  /* =====================================================
     4. Particles: cursor sparkle trail, click bursts, confetti, hearts
     ===================================================== */
  const fx = $('#fx');
  const cx = fx.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const resizeFX = () => { fx.width = innerWidth * DPR; fx.height = innerHeight * DPR; };
  resizeFX(); addEventListener('resize', resizeFX);
  const COLORS = ['#ff2fb3', '#3df0ff', '#f4ff3d', '#ff8bd0', '#8a3dff', '#ffffff'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const parts = [];
  const MAX = 420;
  function add(p) { if (parts.length < MAX) parts.push(p); }
  function burst(x, y, o = {}) {
    if (reduce) return;
    const n = o.n || 14, kind = o.kind || 'spark';
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rnd(-o.spread, o.spread) : rnd(0, Math.PI * 2);
      const sp = rnd(o.min || 1.5, o.max || 6);
      add({
        kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
        g: o.g ?? 0.06, life: 0, max: rnd(o.lifeMin || 0.6, o.lifeMax || 1.2) * 60,
        s: rnd(o.sMin || 2, o.sMax || 5), c: pick(o.colors || COLORS), r: rnd(0, 6.28), vr: rnd(-0.25, 0.25),
      });
    }
  }
  fx.style.display = reduce ? 'none' : '';
  gsap.ticker.add(() => {
    if (!parts.length) { if (fx._dirty) { cx.clearRect(0, 0, fx.width, fx.height); fx._dirty = false; } return; }
    fx._dirty = true;
    cx.clearRect(0, 0, fx.width, fx.height);
    cx.save(); cx.scale(DPR, DPR);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += p.vr;
      const k = 1 - p.life / p.max;
      if (k <= 0 || p.y > innerHeight + 40) { parts.splice(i, 1); continue; }
      cx.globalAlpha = Math.min(1, k * 1.6);
      if (p.kind === 'spark') {
        cx.globalCompositeOperation = 'lighter';
        const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 3);
        g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.s * 3, 0, 6.283); cx.fill();
        cx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'confetti') {
        cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
        cx.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s); cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      } else if (p.kind === 'heart') {
        cx.font = `${p.s * 5}px system-ui, sans-serif`; cx.textAlign = 'center'; cx.fillStyle = p.c;
        cx.fillText('♥', p.x, p.y);
      }
    }
    cx.restore();
  });
  if (finePointer && !reduce) {
    let lx = 0, ly = 0, acc = 0;
    addEventListener('pointermove', (e) => {
      acc += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
      if (acc > 16) { acc = 0; burst(e.clientX, e.clientY, { n: 1, min: 0.2, max: 1.2, g: -0.01, sMin: 1.5, sMax: 3.2, lifeMin: 0.5, lifeMax: 0.9, colors: ['#ff2fb3', '#3df0ff', '#f4ff3d'] }); }
    });
  }
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('.lightbox, .menu')) return;
    if (e.target.closest('.phone')) burst(e.clientX, e.clientY, { n: 9, kind: 'heart', min: 0.5, max: 2.4, g: -0.04, lift: 1.5, sMin: 3, sMax: 6, lifeMin: 0.9, lifeMax: 1.6, colors: ['#ff2fb3', '#ff8bd0', '#ff4d6d'] });
    else burst(e.clientX, e.clientY, { n: 16, min: 1.5, max: 6.5 });
  });

  // Confetti when a pitch deck lands
  $$('[data-stack]').forEach((d) => {
    ScrollTrigger.create({
      trigger: d, start: 'top 62%', once: true,
      onEnter: () => {
        const b = $('.deck__badge', d).getBoundingClientRect();
        const x = b.left + b.width / 2, y = b.top + b.height / 2;
        burst(x, y, { n: 46, kind: 'confetti', dir: -Math.PI / 2, spread: 1.1, min: 3, max: 10, g: 0.17, sMin: 3, sMax: 6, lifeMin: 1.2, lifeMax: 2.2 });
        gsap.fromTo($('.deck__badge', d), { scale: 1.5, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1,.5)' });
      },
    });
  });

  /* =====================================================
     5. Hero: letters react to the cursor, glitchy portrait
     ===================================================== */
  const heroChars = $$('#heroBig .ch');
  let heroLive = false;
  document.addEventListener('kg:ready', () => setTimeout(() => (heroLive = true), 2600));
  if (finePointer && !reduce) {
    addEventListener('pointermove', (e) => {
      if (!heroLive || window.scrollY > innerHeight * 0.9) return;
      heroChars.forEach((ch) => {
        const r = ch.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const k = Math.max(0, 1 - Math.hypot(dx, dy) / 280);
        gsap.to(ch, { y: -k * 36, scale: 1 + k * 0.16, rotate: (-dx / 70) * k, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
      });
    });
  }

  /* =====================================================
     6. Instagram-story chrome on the phones
     ===================================================== */
  $$('.phone .screen').forEach((s, i) => {
    s.style.position = 'relative';
    const el = document.createElement('div');
    el.className = 'story';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="story__bars"><i></i><i></i><i></i><i></i></div><div class="story__who"><b></b><span>pennandtylersgreenfc</span><em>now</em></div>';
    el.style.setProperty('--d', (i * -1.3) + 's');
    s.append(el);
  });

  /* =====================================================
     7. Magnetic elements + glare
     ===================================================== */
  if (finePointer && !reduce) {
    $$('[data-magnetic]').forEach((el) => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const near = Math.hypot(dx, dy) < Math.max(r.width, r.height) * 0.9 + 30;
        mx(near ? dx * 0.35 : 0); my(near ? dy * 0.35 : 0);
      });
    });
    $$('.glare').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--gx', ((e.clientX - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--gy', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* =====================================================
     8. Wipe reveals for tiles and posters
     ===================================================== */
  if (!reduce) {
    $$('.tile, .poster').forEach((el) => {
      const rad = el.classList.contains('tile') ? 24 : 16;
      gsap.fromTo(el, { clipPath: `inset(100% 0% 0% 0% round ${rad}px)` }, {
        clipPath: `inset(0% 0% 0% 0% round ${rad}px)`, duration: 1.3, ease: 'expo.inOut',
        clearProps: 'clipPath',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      });
      const img = $('img', el);
      gsap.fromTo(img, { scale: 1.45 }, { scale: 1, duration: 1.8, ease: 'expo.out', clearProps: 'transform', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
  }

  /* =====================================================
     9. Netflix-style ribbon, scrubbed by scroll
     ===================================================== */
  const rc = $('#ribbon');
  if (rc) {
    const g = rc.getContext('2d');
    const W = rc.width, H = rc.height, N = 150;
    const bars = Array.from({ length: N }, (_, i) => ({
      u: i / (N - 1) - 0.5, w: rnd(0.4, 1.3), ph: rnd(0, 6.28), hue: rnd(0, 1), a: rnd(0.35, 1),
    }));
    const st = { p: 0, on: false };
    const tc = $('#tc');
    ScrollTrigger.create({
      trigger: '.cinema', start: 'top 92%', end: 'bottom 28%', scrub: true,
      onUpdate: (s) => { st.p = s.progress; },
      onToggle: (s) => { st.on = s.isActive; },
    });
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const render = (time) => {
      const p = ease(st.p), t = time / 1000;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const spread = lerp(70, W * 0.95, p);
      const shake = (1 - p) * 3;
      g.globalCompositeOperation = 'lighter';
      for (const b of bars) {
        const x = W / 2 + b.u * spread * (1 + 0.04 * Math.sin(t * 1.5 + b.ph)) + Math.sin(t * 9 + b.ph) * shake;
        const w = lerp(2.5, 16, p) * b.w;
        const r = 255, gg = Math.round(lerp(10, 110, b.hue * (0.3 + p * 0.7))), bl = Math.round(lerp(10, 40, b.hue));
        g.fillStyle = `rgba(${r},${gg},${bl},${b.a * lerp(0.9, 0.55, p) * (1 - Math.abs(b.u) * 0.9 * p)})`;
        g.fillRect(x - w / 2, 0, w, H);
      }
      const glow = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, lerp(220, 640, p));
      glow.addColorStop(0, `rgba(255,30,30,${lerp(0.55, 0.18, p)})`); glow.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      const fade = g.createLinearGradient(0, 0, 0, H);
      fade.addColorStop(0, 'rgba(0,0,0,.9)'); fade.addColorStop(0.28, 'rgba(0,0,0,0)'); fade.addColorStop(0.72, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,.9)');
      g.fillStyle = fade; g.fillRect(0, 0, W, H);
      const secs = Math.round(st.p * 90);
      tc.textContent = `Scroll to scrub ▸ 00:0${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    };
    render(0);
    if (!reduce) gsap.ticker.add((time) => st.on && render(time * 1000));
    else ScrollTrigger.create({ trigger: '.cinema', start: 'top 92%', end: 'bottom 28%', onUpdate: () => render(0) });
  }

  /* =====================================================
     10. Podcast waveform follows the pointer + scroll speed
     ===================================================== */
  const wave = $$('.wave i');
  if (wave.length && !reduce) {
    let level = 0;
    addEventListener('pointermove', (e) => { level = Math.max(level, Math.min(1, Math.hypot(e.movementX, e.movementY) / 40)); });
    gsap.ticker.add(() => {
      level *= 0.94;
      wave.forEach((b, i) => { b.style.opacity = 0.55 + level * 0.45 * Math.abs(Math.sin(i + performance.now() / 250)); });
    });
  }
})();
