(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;

  // If the animation libraries failed to load, show everything statically.
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    $('#loader')?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------------- Smooth scroll (Lenis) ---------------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    else (typeof target === 'string' ? $(target) : target)?.scrollIntoView({ behavior: 'smooth' });
  };

  $$('[data-scroll]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id[0] !== '#') return;
      e.preventDefault();
      closeMenu();
      scrollTo(id === '#top' ? 0 : id, { offset: id === '#top' ? 0 : -10 });
    })
  );

  /* ---------------- Mobile menu ---------------- */
  const burger = $('#burger');
  const menu = $('#menu');
  function closeMenu() {
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    lenis?.start();
  }
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    open ? lenis?.stop() : lenis?.start();
  });

  /* ---------------- Text splitting ---------------- */
  function splitChars(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text.trim());
    el.textContent = '';
    const frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach((tok) => {
      if (/^\s+$/.test(tok)) { frag.append(' '); return; }
      const w = document.createElement('span');
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      [...tok].forEach((c) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        w.append(s);
      });
      frag.append(w);
    });
    el.append(frag);
    return $$('.ch', el);
  }

  /* ---------------- Preloader -> intro ---------------- */
  const loaderNum = $('#loaderNum');
  const loaderBar = $('#loaderBar');
  const heroChars = splitChars($('#heroBig'));
  gsap.set(heroChars, { yPercent: 110, rotate: 8, opacity: 0 });
  gsap.set('#heroScript', { opacity: 0, y: 40, rotate: -12 });
  gsap.set('#heroBy', { opacity: 0, y: 20 });
  gsap.set('.hero__row .hero__photo', { opacity: 0 });
  lenis?.stop();
  if (reduce) { root.classList.remove('js'); }

  const counter = { v: 0 };
  let pageReady = document.readyState === 'complete';
  if (!pageReady) addEventListener('load', () => (pageReady = true), { once: true });

  gsap.to(counter, {
    v: 100,
    duration: reduce ? 0.01 : 1.9,
    ease: 'power2.inOut',
    onUpdate() {
      const v = Math.round(counter.v);
      loaderNum.textContent = v;
      loaderBar.style.width = v + '%';
    },
    onComplete() {
      const go = () => (pageReady ? intro() : setTimeout(go, 80));
      go();
    },
  });

  function intro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('#loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' })
      .add(() => { $('#loader').style.display = 'none'; lenis?.start(); document.body.classList.add('is-ready'); }, '>')
      .to('#heroScript', { opacity: 1, y: 0, rotate: -5, duration: 1.2 }, '-=0.55')
      .to(heroChars, { yPercent: 0, rotate: 0, opacity: 1, duration: 1.2, stagger: 0.045 }, '-=0.95')
      .to('#heroBy', { opacity: 1, y: 0, duration: 1 }, '-=0.7')
      .fromTo('.hero__photo', { opacity: 0, y: 80, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 1.3 }, '-=0.9')
      .fromTo('.hero__info [data-reveal]', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12, clearProps: 'transform' }, '-=1')
      .fromTo('.nav', { yPercent: -200 }, { yPercent: 0, duration: 1 }, '-=1.1')
      .add(() => ScrollTrigger.refresh());
    // Hero stat counters
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count;
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2, delay: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) });
    });
  }

  /* ---------------- Progress bar + nav ---------------- */
  const progress = $('#progress');
  const nav = $('#nav');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      progress.style.transform = `scaleX(${self.progress})`;
      const y = self.scroll();
      nav.classList.toggle('is-hidden', y > lastY && y > 400 && !menu.classList.contains('is-open'));
      lastY = y;
    },
  });

  // Active nav link
  const links = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((a) => { const s = $(a.getAttribute('href')); s && io.observe(s); });
    new IntersectionObserver((en) => en[0].isIntersecting && links.forEach((l) => l.classList.remove('is-active')), { rootMargin: '-45% 0px -50% 0px' }).observe($('#hero'));
  }

  /* ---------------- Generic reveals ---------------- */
  $$('[data-reveal]').forEach((el) => {
    if (el.closest('.hero__info')) return; // handled in intro
    const kind = el.dataset.reveal;
    const from = { opacity: 0, y: 70 };
    if (kind === 'scale') Object.assign(from, { scale: 0.88, y: 60 });
    gsap.fromTo(el, from, {
      opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'expo.out', clearProps: 'transform',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
  // hero photo reveal handled in intro; make sure it's not double-animated
  ScrollTrigger.getAll().forEach((st) => st.trigger === $('.hero__photo') && st.kill());

  $$('[data-split]').forEach((el) => {
    const chars = splitChars(el);
    gsap.from(chars, {
      yPercent: 115, rotate: 6, opacity: 0, duration: 1.1, ease: 'expo.out',
      stagger: { each: 0.025, from: 'start' },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  /* ---------------- Parallax (scroll + mouse) ---------------- */
  $$('[data-speed]').forEach((el) => {
    const speed = parseFloat(el.dataset.speed) || 0;
    if (!speed) return;
    gsap.fromTo(el, { y: () => -speed * innerHeight * 0.8 }, {
      y: () => speed * innerHeight * 0.8, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
    });
  });

  const mouseEls = $$('[data-mouse]');
  if (finePointer && mouseEls.length && !reduce) {
    const setters = mouseEls.map((el) => ({
      amt: +el.dataset.mouse,
      x: gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3' }),
      y: gsap.quickTo(el, 'yPercent', { duration: 1.2, ease: 'power3' }),
    }));
    addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      setters.forEach((s) => { s.x(nx * s.amt * 3); s.y(ny * s.amt * 0.4); });
    });
  }

  // Spinning folder + hero script float
  $$('[data-spin]').forEach((el) =>
    gsap.to(el, { rotate: 40, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 } })
  );

  /* ---------------- Marquees (scroll-velocity aware) ---------------- */
  const marquees = [];
  const addMarquee = (tracks, val, getW) => {
    const k = Math.abs(+val) || 1;
    marquees.push({ tracks, dir: (+val || 1) < 0 ? -1 : 1, k, x: 0, getW });
  };
  $$('.marquee').forEach((m) => {
    const first = $('.marquee__track', m);
    const need = Math.ceil((innerWidth * 2) / first.scrollWidth) + 1;
    for (let i = 0; i < need; i++) {
      const c = first.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      m.append(c);
    }
    addMarquee($$('.marquee__track', m), m.dataset.marquee, () => first.getBoundingClientRect().width);
  });
  $$('.ticker__track').forEach((t) => addMarquee([t], t.dataset.marquee, () => t.children[0].getBoundingClientRect().width));

  let velocity = 0;
  if (lenis) lenis.on('scroll', ({ velocity: v }) => (velocity = v));
  gsap.ticker.add(() => {
    if (reduce) return;
    const boost = Math.min(Math.abs(velocity) * 0.45, 14);
    marquees.forEach((m) => {
      const w = m.getW() || 1;
      m.x += m.dir * m.k * (0.9 + boost);
      if (m.x <= -w) m.x += w;
      if (m.x > 0) m.x -= w;
      const tf = `translate3d(${m.x}px,0,0)`;
      m.tracks.forEach((t) => (t.style.transform = tf));
    });
  });

  /* ---------------- Horizontal scroll: Content Creation ---------------- */
  const hTrack = $('#hTrack');
  if (hTrack) {
    const getDist = () => Math.max(0, hTrack.scrollWidth - innerWidth);
    const hTween = gsap.to(hTrack, {
      x: () => -getDist(),
      ease: 'none',
      scrollTrigger: {
        trigger: '#content',
        pin: true,
        scrub: 0.7,
        start: 'top top',
        end: () => '+=' + getDist(),
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });
    // Phones drift & tilt as they cross the viewport
    $$('.phone-wrap').forEach((p, i) => {
      gsap.fromTo(p.firstElementChild, { rotateY: 18, rotateZ: i % 2 ? 3 : -3 }, {
        rotateY: -18, rotateZ: i % 2 ? -3 : 3, ease: 'none',
        scrollTrigger: { trigger: p, containerAnimation: hTween, start: 'left 100%', end: 'right 0%', scrub: true },
      });
    });
  }

  /* ---------------- Stacking pitch decks ---------------- */
  const decks = $$('[data-stack]');
  decks.forEach((d, i) => {
    d.style.setProperty('--i', i);
    const next = decks[i + 1];
    if (!next) return;
    gsap.to(d, {
      scale: 0.92 - 0, yPercent: -3, filter: 'brightness(.6)', ease: 'none',
      scrollTrigger: { trigger: next, start: 'top 85%', end: 'top 25%', scrub: true },
    });
  });

  /* ---------------- Netflix cinema scrub ---------------- */
  const cinema = $('.cinema__frame');
  if (cinema) {
    gsap.fromTo(cinema, { scale: 0.62, rotateX: 22, borderRadius: 60 }, {
      scale: 1, rotateX: 0, borderRadius: 14, ease: 'none',
      scrollTrigger: { trigger: '.cinema', start: 'top 95%', end: 'top 25%', scrub: 0.6 },
    });
    gsap.fromTo('.cinema__frame img', { scale: 1.5 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.cinema', start: 'top 95%', end: 'bottom 40%', scrub: 0.6 },
    });
    gsap.fromTo('.trailer__glow', { scale: 0.5, opacity: 0.3 }, {
      scale: 1.3, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '.trailer', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    });
  }

  /* ---------------- 3D tilt ---------------- */
  if (finePointer && !reduce) {
    $$('[data-tilt]').forEach((el) => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      gsap.set(el, { transformPerspective: 1000 });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 12);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ---------------- Custom cursor ---------------- */
  const cursor = $('#cursor');
  if (finePointer && cursor) {
    const label = $('.cursor__label', cursor);
    const cx = gsap.quickTo(cursor, 'x', { duration: 0.28, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: 0.28, ease: 'power3' });
    addEventListener('pointermove', (e) => { cursor.classList.add('is-on'); cx(e.clientX); cy(e.clientY); });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    const hover = (el, on) => {
      const txt = el.dataset.cursor;
      cursor.classList.toggle('is-hover', on && (txt !== undefined || el.matches('a,button')));
      cursor.classList.toggle('has-label', on && !!txt);
      label.textContent = on && txt ? txt : '';
    };
    $$('a,button,[data-cursor]').forEach((el) => {
      el.addEventListener('pointerenter', () => hover(el, true));
      el.addEventListener('pointerleave', () => hover(el, false));
    });
  }

  /* ---------------- Lightbox ---------------- */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg', lb);
  const openLb = (src, alt) => {
    lbImg.src = src; lbImg.alt = alt || '';
    lb.classList.add('is-open');
    lenis?.stop();
    $('#lbClose').focus({ preventScroll: true });
  };
  const closeLb = () => {
    lb.classList.remove('is-open');
    lenis?.start();
  };
  $$('[data-lightbox]').forEach((b) =>
    b.addEventListener('click', () => openLb(b.dataset.lightbox, $('img', b)?.alt))
  );
  lb.addEventListener('click', (e) => { if (e.target !== lbImg) closeLb(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeLb(); closeMenu(); } });

  /* ---------------- Resize ---------------- */
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 200); });
  addEventListener('load', () => ScrollTrigger.refresh());
})();
