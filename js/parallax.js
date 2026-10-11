/* ==========================================================================
   Flower Studios — parallax.js
   Ana sayfanın kaydırmaya bağlı sahneleri. main.js hazır olunca
   ("fs:ready") çalışır.

   HAREKET SİSTEMİ
   - F'nin birleşmesi sayfanın tek "büyük anı"dır; hero'da ışık şeridi ve
     parlamayla birleşir (pin + scrub), kapanışta dev ölçekte tekrar eder.
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
     2. HERO (ilk tasarımdaki hâli)
     Açılışta logo parçaları dağınık halde ekrana gelir, başlık harf harf
     belirir. Kaydırınca parçalar birleşir, ışık şeridi geçer, sonra tüm
     içerik yukarı kayarak bir sonraki bölüme yer açar.
     ------------------------------------------------------------------ */
  function initHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const FS = window.FS;
    const stage = hero.querySelector(".hero__stage");
    const pieces = {
      white: hero.querySelector(".piece--white"),
      top: hero.querySelector(".piece--top"),
      bottom: hero.querySelector(".piece--bottom"),
    };
    const words = hero.querySelectorAll(".hero__word");
    const chars = [];
    words.forEach((w) => chars.push(...FS.split(w, "chars")));
    const hint = hero.querySelector(".hero__hint");
    const beam = hero.querySelector(".hero__beam");
    const center = hero.querySelector(".hero__center");

    // Ekran genişliğine göre dağılma mesafesi
    const spread = () => Math.min(window.innerWidth, 1400) / 1400;

    // Parçaların "dağınık" konumları (logo birimi değil, piksel)
    const scattered = {
      white: () => ({ x: -280 * spread(), y: -30, rotate: -28 }),
      top: () => ({ x: 300 * spread(), y: -110, rotate: 32 }),
      bottom: () => ({ x: 380 * spread(), y: 10, rotate: -22 }),
    };

    // Işık şeridinin açısı GSAP üzerinden veriliyor (CSS'te scaleX(0) iken
    // tarayıcı açıyı kaybettiği için)
    gsap.set(beam, { rotate: -24, scaleX: 0, transformOrigin: "0% 50%" });

    /* --- Parçaların konumu: TEK YAZICI ---
       Açılış ve kaydırma parçalara doğrudan konum yazmaz; ikisi de sadece
       kendi ilerleme değerini (0–1) günceller. Parçanın nerede duracağını
       render() ikisini birleştirerek tek yerden hesaplar. Böylece açılış
       bitmeden kaydırılsa da, pencere boyutu değişse de parça zıplamaz.
         introT  0 → 1 : uzaktan (2.2×) dağınık konuma gelir, görünür olur
         scrollT 0 → 1 : dağınık konumdan yerine (0,0,0) oturur          */
    const keys = Object.keys(pieces);
    const introT = { white: 0, top: 0, bottom: 0 };
    const scrollT = { white: 0, top: 0, bottom: 0 };
    keys.forEach((k) => gsap.set(pieces[k], { transformOrigin: "50% 50%" }));

    function render() {
      keys.forEach((k) => {
        const s = scattered[k]();
        const i = introT[k];
        const left = 1 - scrollT[k];        // 1 = dağınık, 0 = yerinde
        const far = 2.2 - 1.2 * i;          // açılışta 2.2× uzaktan gelir
        const farR = 2 - i;                 // açılışta 2× dönük gelir
        gsap.set(pieces[k], {
          x: s.x * far * left,
          y: s.y * far * left,
          rotation: s.rotate * farR * left,
          opacity: i,
        });
      });
    }
    render();

    /* --- Açılış animasyonu (sayfa yüklenince bir kez) --- */
    const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
    keys.forEach((k, idx) => {
      intro.to(introT, { [k]: 1, duration: 1.6, onUpdate: render }, 0.1 + idx * 0.12);
    });
    intro
      .from(chars, { yPercent: 115, rotate: 10, duration: 1.2, stagger: 0.035 }, 0.35)
      .from(hint, { opacity: 0, duration: 1 }, 1.2);

    /* --- Kaydırma ile birleşme (pin + scrub) ---
       Pin, diğer bölümlerin konum hesabını etkilediği için en başta
       oluşturuluyor. Kullanıcı açılış bitmeden kaydırırsa açılış sadece
       hızlanır; konumlar render() üzerinden aktığı için çakışma olmaz. */
    const skipIntro = () => intro.progress() < 1 && intro.timeScale(4);
    window.addEventListener("wheel", skipIntro, { once: true, passive: true });
    window.addEventListener("touchstart", skipIntro, { once: true, passive: true });

    buildScrollTimeline();

    function buildScrollTimeline() {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Arkadaki uzay (süzülen parçalar + turuncu ışıma) kaydırdıkça kararır;
      // son parça yerine oturduğu anda (1.16) tamamen sayfa rengindedir.
      const space = { v: 1 };
      const setSpace = () => {
        stage.style.setProperty("--space", space.v.toFixed(3));
        FS.heroSpace = space.v;
      };

      tl.to(hint, { opacity: 0, duration: 0.1 }, 0)
        .to(space, { v: 0, duration: 1.16, ease: "power1.in", onUpdate: setSpace }, 0)
        // Parçalar birleşiyor (her biri biraz farklı zamanlamayla)
        .to(scrollT, { white: 1, duration: 1, ease: "power2.inOut", onUpdate: render }, 0)
        .to(scrollT, { top: 1, duration: 1, ease: "power2.inOut", onUpdate: render }, 0.08)
        .to(scrollT, { bottom: 1, duration: 1, ease: "power2.inOut", onUpdate: render }, 0.16)
        // Birleşme anında ışık şeridi ekranı çapraz keser
        .to(beam, { scaleX: 1, duration: 0.5, ease: "power2.out" }, 0.75)
        // Birleşme anında logo parlar. Telefonda filtre yerine sabit ışık
        // katmanının opaklığı artar (bkz. pages.css → TELEFON PERFORMANSI)
        .add(
          window.matchMedia("(max-width: 700px)").matches
            ? gsap.fromTo(center, { "--glow": 0.35 }, { "--glow": 1, duration: 0.25 })
            : gsap.fromTo(
                ".hero__logo",
                { filter: "drop-shadow(0 0 40px rgba(254,92,29,0.18))" },
                { filter: "drop-shadow(0 0 70px rgba(254,92,29,0.55))", duration: 0.25 }
              ),
          1.05
        )
        // Birleşmiş logo bir süre ekranda kalsın (boş tween = bekleme)
        .to({}, { duration: 0.4 });

      // Pencere boyutu değişince (dağılma mesafesi ekrana bağlı) yeniden çiz
      ScrollTrigger.addEventListener("refresh", render);

      // Pin bittikten sonra: bir sonraki bölüm gelirken içerik parallax ile
      // daha yavaş yukarı kayar ve söner (boş ekran kalmaz)
      const next = hero.closest(".pin-spacer")?.nextElementSibling || hero.nextElementSibling;
      if (next) {
        gsap.to(center, {
          yPercent: -35,
          scale: 0.92,
          opacity: 0,
          ease: "none",
          scrollTrigger: { trigger: next, start: "top bottom", end: "top 25%", scrub: true },
        });
        gsap.to(beam, {
          opacity: 0,
          ease: "none",
          scrollTrigger: { trigger: next, start: "top bottom", end: "top 50%", scrub: true },
        });
      }

    }
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
