/* ==========================================================================
   Flower Studios — parallax.js
   Ana sayfanın kaydırmaya bağlı sahneleri. main.js hazır olunca
   ("fs:ready") çalışır.

   HAREKET SİSTEMİ
   - F'nin birleşmesi sayfanın tek "büyük anı"dır; hero'da başlar,
     kapanış bölümünde dev ölçekte tekrar eder.
   - Kaydırmaya bağlı her şey doğrudan kaydırma ilerlemesinden hesaplanır
     (gecikmeli scrub yok), bu yüzden hızlı kaydırmada da, geri
     kaydırmada da doğru konumdadır. Yumuşaklığı Lenis sağlar.
   - Sürekli hareket sadece marquee'de; o da kaydırma hızına tepki verir.
   - "Hareketi azalt" açıksa: F birleşik, hiçbir şey hareket etmez.

   1. convergeF: F parçalarını ilerlemeye (0–1) göre birleştiren çekirdek
   2. Hero
   3. Biz kimiz: kelimelerin aydınlanması + tohum/biçim/dünya
   4. Geçiş şeridi
   5. Proje sahneleri
   6. Marquee
   7. Kapanış: büyük F
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Dağınık konumlar SVG'nin kendi koordinatlarında (viewBox 415×650),
     bu yüzden logo hangi boyutta çizilirse çizilsin oranlar aynı kalır.
     Birleşik hâl her zaman tam x=0, y=0, rotate=0: kayma imkânsız.
     ------------------------------------------------------------------ */
  const SCATTER = {
    white: { x: -430, y: 40, rotate: -26 },
    top: { x: 390, y: -200, rotate: 30 },
    bottom: { x: 480, y: 150, rotate: -20 },
  };
  // Her parçanın ilerleme penceresi (0–1 içinde): hafif kademeli varış
  const WINDOW = { white: [0, 0.82], top: [0.06, 0.9], bottom: [0.12, 1] };

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const range = (p, a, b) => clamp01((p - a) / (b - a));
  // easeInOutSine: kaydırmayla neredeyse doğrusal ilerler, uçlarda yumuşar.
  // İlk kaydırmadan itibaren hareket görünür, varış yine de sakin.
  const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

  /** pieces: {white, top, bottom} polygon elemanları. Dönen fonksiyon p (0–1) alır.
      getK: dağılma mesafesi çarpanı (dar ekranda parçalar ekrandan taşmasın). */
  function convergeF(pieces, getK = () => 1) {
    Object.values(pieces).forEach((el) => gsap.set(el, { transformOrigin: "50% 50%" }));
    const setters = {};
    Object.keys(pieces).forEach((k) => {
      setters[k] = {
        x: gsap.quickSetter(pieces[k], "x"),
        y: gsap.quickSetter(pieces[k], "y"),
        r: gsap.quickSetter(pieces[k], "rotation"),
      };
    });
    return function render(p) {
      const m = getK();
      Object.keys(pieces).forEach((k) => {
        const [a, b] = WINDOW[k];
        const left = (1 - ease(range(p, a, b))) * m; // m = dağınık, 0 = yerinde
        const s = SCATTER[k];
        setters[k].x(s.x * left);
        setters[k].y(s.y * left);
        setters[k].r(s.rotate * left);
      });
    };
  }

  document.addEventListener("fs:ready", () => {
    if (window.FS.reduceMotion) return; // F zaten birleşik; adımlar CSS ile açık

    initHero();
    initAbout();
    initSlash();
    initWorks();
    initMarquee();
    initClosing();
  });

  /* ------------------------------------------------------------------
     2. HERO
     .hero'nun ekran yüksekliğini aşan kısmı (--run) boyunca .hero__sticky
     sabit kalır. İlerleme = bu aralıktaki konum. Aralık bitince sayfa
     normal akar; kullanıcı hiçbir yerde kilitlenmez.
     ------------------------------------------------------------------ */
  function initHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const svg = hero.querySelector(".hero__mark");
    // Dar ekranda dağınık parçalar ekrandan taşmasın: parçalar tam dağınık
    // konumdayken gerçek kutuları ölçülür, gerekirse mesafe orantılı küçültülür.
    // (Sadece yükleme ve yeniden boyutlandırmada çalışır.)
    let k = 1;
    const measureK = () => {
      k = 1;
      render(0);
      const m = svg.getBoundingClientRect();
      const cx = m.left + m.width / 2;
      let minL = Infinity, maxR = -Infinity;
      svg.querySelectorAll(".piece").forEach((el) => {
        const r = el.getBoundingClientRect();
        minL = Math.min(minL, r.left);
        maxR = Math.max(maxR, r.right);
      });
      const margin = 12;
      const halfMark = m.width / 2;
      // Öteleme kısmı ölçeklenir; logo genişliği sabit kalır
      const kL = (cx - margin - halfMark) / Math.max(1, cx - minL - halfMark);
      const kR = (window.innerWidth - margin - cx - halfMark) / Math.max(1, maxR - cx - halfMark);
      k = Math.max(0.3, Math.min(1, kL, kR));
    };
    const render = convergeF(
      {
        white: svg.querySelector('[data-piece="white"]'),
        top: svg.querySelector('[data-piece="top"]'),
        bottom: svg.querySelector('[data-piece="bottom"]'),
      },
      () => k
    );
    const slash = hero.querySelector(".hero__slash");
    const track = hero.querySelector(".hero__track i");
    const stage = hero.querySelector(".hero__stage");
    const frags = [...hero.querySelectorAll(".frag")];

    // Küçük parçaların merkeze uzaklığı: sadece ölçüm anında hesaplanır
    let fragData = [];
    const measure = () => {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      fragData = frags.map((f) => {
        gsap.set(f, { x: 0, y: 0, scale: 1 });
        const fr = f.getBoundingClientRect();
        return { el: f, dx: cx - (fr.left + fr.width / 2), dy: cy - (fr.top + fr.height / 2) };
      });
    };
    const baseOpacity = frags.map((f) => parseFloat(getComputedStyle(f).opacity));

    const update = (p) => {
      render(p);
      // İnce çizgi, parçalar yerine otururken logonun açısıyla geçer
      gsap.set(slash, { rotation: -32, scaleX: ease(range(p, 0.62, 0.95)) });
      track.style.transform = `scaleX(${p})`;
      // Küçük parçalar merkeze çekilir ve söner: parçalardan bütüne
      const e = ease(range(p, 0, 0.9));
      fragData.forEach((d, i) => {
        gsap.set(d.el, { x: d.dx * e * 0.8, y: d.dy * e * 0.8, scale: 1 - 0.5 * e });
        d.el.style.opacity = baseOpacity[i] * (1 - e) * fragIntro.v;
      });
    };

    /* Açılış: tek orkestre an. Kaydırmanın kontrol ettiği özelliklere
       (parça konumları) dokunmaz; sadece görünürlük ve başlık kelimeleri. */
    const fragIntro = { v: 0 };
    const words = hero.querySelectorAll(".hero__word");
    words.forEach((w) => (w.style.display = "inline-block"));
    hero.querySelector(".fit-inner").style.overflow = "hidden"; // kelimeler maskeden çıksın

    const st = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => { measureK(); measure(); update(self.progress); },
    });
    measureK();
    measure();
    update(st.progress);

    gsap.timeline({ defaults: { ease: "expo.out" } })
      .from(svg, { opacity: 0, duration: 1.2 }, 0)
      .from(words, { yPercent: 105, duration: 1.2, stagger: 0.09 }, 0.15)
      .from(".hero__foot > *", { opacity: 0, y: 12, duration: 0.9, stagger: 0.08 }, 0.55)
      .to(fragIntro, { v: 1, duration: 1.2, onUpdate: () => update(st.progress) }, 0.3);
  }

  /* ------------------------------------------------------------------
     3. BİZ KİMİZ: kelimeler okunma hızında aydınlanır, adımlar yanar
     ------------------------------------------------------------------ */
  function initAbout() {
    const el = document.querySelector(".about__text[data-highlight]");
    if (!el) return;
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", words.join(" "));
    el.innerHTML = words.map((w) => `<span class="hl-word" aria-hidden="true">${w}</span>`).join(" ");
    const spans = [...el.querySelectorAll(".hl-word")];
    const setO = spans.map((s) => gsap.quickSetter(s, "opacity"));
    const steps = [...document.querySelectorAll(".growth__step")];
    const thresholds = [0.1, 0.55, 0.96];

    const apply = (prog) => {
      const p = prog * spans.length;
      setO.forEach((set, i) => set(0.16 + 0.84 * clamp01(p - i)));
      steps.forEach((s, i) => s.classList.toggle("is-on", prog >= thresholds[i]));
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 45%",
      onUpdate: (self) => apply(self.progress),
    });
    apply(st.progress);
  }

  /* ------------------------------------------------------------------
     4. GEÇİŞ ŞERİDİ: iki şerit zıt yönlerden uzar
     ------------------------------------------------------------------ */
  function initSlash() {
    document.querySelectorAll(".slash").forEach((slash) => {
      const bars = [...slash.querySelectorAll("i")];
      const apply = (prog) =>
        bars.forEach((b, i) => {
          const s = ease(range(prog, i * 0.15, 0.85 + i * 0.15));
          b.style.transform = `rotate(-6deg) scaleX(${s})`;
        });
      const st = ScrollTrigger.create({
        trigger: slash,
        start: "top 95%",
        end: "bottom 45%",
        onUpdate: (self) => apply(self.progress),
      });
      apply(st.progress);
    });
  }

  /* ------------------------------------------------------------------
     5. PROJE SAHNELERİ: katmanlar derinliklerine göre kayar; fare ile
     hafif yatay derinlik (yalnızca hassas işaretçide)
     ------------------------------------------------------------------ */
  function initWorks() {
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    document.querySelectorAll(".work").forEach((work) => {
      const art = work.querySelector(".work__art");
      const layers = [...art.querySelectorAll(".art__layer")].map((el) => ({
        el,
        d: parseFloat(el.dataset.depth || 0.3),
        y: gsap.quickSetter(el, "yPercent"),
      }));

      ScrollTrigger.create({
        trigger: art,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const t = self.progress * 2 - 1; // -1 … 1
          layers.forEach((l) => l.y(-t * l.d * 10));
        },
      });

      if (!finePointer) return;
      const movers = layers.map((l) => ({ d: l.d, x: gsap.quickTo(l.el, "x", { duration: 0.8, ease: "power3.out" }) }));
      work.addEventListener("mousemove", (e) => {
        const r = art.getBoundingClientRect();
        const nx = clamp01((e.clientX - r.left) / r.width) - 0.5;
        movers.forEach((m) => m.x(nx * m.d * -50));
      });
      work.addEventListener("mouseleave", () => movers.forEach((m) => m.x(0)));
    });
  }

  /* ------------------------------------------------------------------
     6. MARQUEE: dikişsiz döngü. Satır iki özdeş gruptan oluşur; -50%
     kayınca başa döner. Kaydırma hızı akışı geçici olarak hızlandırır.
     ------------------------------------------------------------------ */
  function initMarquee() {
    const rows = [...document.querySelectorAll("[data-marquee]")];
    if (!rows.length) return;

    const loops = rows.map((row) => {
      const dir = parseFloat(row.dataset.marquee);
      return gsap.fromTo(
        row,
        { xPercent: dir > 0 ? 0 : -50 },
        { xPercent: dir > 0 ? -50 : 0, duration: 38, ease: "none", repeat: -1, paused: true }
      );
    });

    const section = rows[0].closest(".marquee");
    let settle;
    ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      // Görünmüyorken döngü durur (gereksiz iş yok)
      onToggle: (self) => loops.forEach((l) => (self.isActive ? l.play() : l.pause())),
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 700, 3);
        loops.forEach((l) => gsap.to(l, { timeScale: boost, duration: 0.25, overwrite: true }));
        clearTimeout(settle);
        settle = setTimeout(
          () => loops.forEach((l) => gsap.to(l, { timeScale: 1, duration: 1.2, ease: "power2.out", overwrite: true })),
          140
        );
      },
    });
  }

  /* ------------------------------------------------------------------
     7. KAPANIŞ: büyük F, bölüm ekrana girerken birleşir
     ------------------------------------------------------------------ */
  function initClosing() {
    const svg = document.querySelector(".closing__mark svg");
    if (!svg) return;
    const render = convergeF({
      white: svg.querySelector('[data-piece="white"]'),
      top: svg.querySelector('[data-piece="top"]'),
      bottom: svg.querySelector('[data-piece="bottom"]'),
    });
    const st = ScrollTrigger.create({
      trigger: ".closing",
      start: "top 85%",
      end: "center 55%",
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => render(self.progress),
    });
    render(st.progress);
  }
})();
