/* ==========================================================================
   Flower Studios — parallax.js
   Ana sayfanın kaydırmaya bağlı animasyonları. main.js hazır olunca
   ("fs:ready" olayı) çalışır.

   Bölümler:
   1. Hero: logo parçalarının birleşmesi (pin + scrub)
   2. [data-speed] öğeleri: genel parallax katmanları
   3. Manifesto: kelimelerin kaydırdıkça aydınlanması
   4. Açılı şerit geçişi
   5. Proje illüstrasyonları: katmanlı derinlik + fare ile hafif hareket
   6. Marquee: kaydırmaya bağlı yatay akış
   ========================================================================== */

(function () {
  "use strict";

  document.addEventListener("fs:ready", () => {
    const FS = window.FS;
    const hero = document.querySelector(".hero");

    // "Hareketi azalt" açıksa: logoyu birleşik göster, hiçbir şeyi hareket ettirme
    if (FS.reduceMotion) {
      document.querySelectorAll(".manifesto__text").forEach((el) => (el.style.opacity = 1));
      return;
    }

    if (hero) initHero(hero, FS);
    initSpeedLayers();
    initManifesto(FS);
    initSlash();
    initProjectArt();
    initMarquee();
  });

  /* ------------------------------------------------------------------
     1. HERO
     Açılışta logo parçaları dağınık halde ekrana gelir, başlık harf harf
     belirir. Kaydırınca parçalar birleşir, ışık şeridi geçer, sonra tüm
     içerik yukarı kayarak bir sonraki bölüme yer açar.
     ------------------------------------------------------------------ */
  function initHero(hero, FS) {
    const stage = hero.querySelector(".hero__stage");
    const pieces = {
      white: hero.querySelector(".piece--white"),
      top: hero.querySelector(".piece--top"),
      bottom: hero.querySelector(".piece--bottom"),
    };
    const words = hero.querySelectorAll(".hero__word");
    const chars = [];
    words.forEach((w) => chars.push(...FS.split(w, "chars")));
    const tagline = hero.querySelector(".hero__tagline");
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

    /* --- Açılış animasyonu (sayfa yüklenince bir kez) --- */
    const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
    Object.keys(pieces).forEach((k, i) => {
      intro.fromTo(
        pieces[k],
        { ...scaledFar(scattered[k]()), opacity: 0 },
        { ...scattered[k](), opacity: 1, duration: 1.6 },
        0.1 + i * 0.12
      );
    });
    intro
      .from(chars, { yPercent: 115, rotate: 10, duration: 1.2, stagger: 0.035 }, 0.35)
      .from(tagline, { opacity: 0, y: 20, duration: 1 }, 0.9)
      .from(hint, { opacity: 0, duration: 1 }, 1.2);

    // Pencere boyutu değişince yeniden hesaplanan (fonksiyon tabanlı) değerler
    function live(k) {
      return {
        x: () => scattered[k]().x,
        y: () => scattered[k]().y,
        rotate: () => scattered[k]().rotate,
      };
    }

    // Dağınık konumun 2.2 katı uzaktan başla
    function scaledFar(p) {
      return { x: p.x * 2.2, y: p.y * 2.2, rotate: p.rotate * 2 };
    }

    /* --- Kaydırma ile birleşme (pin + scrub) ---
       Pin, diğer bölümlerin konum hesabını etkilediği için en başta
       oluşturuluyor. Parça animasyonları immediateRender:false ile
       açılış animasyonunu bozmadan bekler. Kullanıcı açılış bitmeden
       kaydırırsa açılış hızlandırılır. */
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

      tl.to(hint, { opacity: 0, duration: 0.1 }, 0)
        // Parçalar birleşiyor (her biri biraz farklı zamanlamayla)
        .fromTo(pieces.white, live("white"), { x: 0, y: 0, rotate: 0, duration: 1, ease: "power2.inOut", immediateRender: false }, 0)
        .fromTo(pieces.top, live("top"), { x: 0, y: 0, rotate: 0, duration: 1, ease: "power2.inOut", immediateRender: false }, 0.08)
        .fromTo(pieces.bottom, live("bottom"), { x: 0, y: 0, rotate: 0, duration: 1, ease: "power2.inOut", immediateRender: false }, 0.16)
        // Birleşme anında ışık şeridi ekranı çapraz keser
        .to(beam, { scaleX: 1, duration: 0.5, ease: "power2.out" }, 0.75)
        .fromTo(
          ".hero__logo",
          { filter: "drop-shadow(0 0 40px rgba(254,92,29,0.18))" },
          { filter: "drop-shadow(0 0 70px rgba(254,92,29,0.55))", duration: 0.25 },
          1.05
        )
        // Birleşmiş logo bir süre ekranda kalsın (boş tween = bekleme)
        .to({}, { duration: 0.4 });

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

      // Arka plan parçacıkları pin süresince kendi hızlarında yukarı kayar
      hero.querySelectorAll(".shard").forEach((el) => {
        const speed = parseFloat(el.dataset.speed || 1);
        gsap.to(el, {
          y: () => -speed * window.innerHeight * 0.45,
          rotate: `+=${speed * 25}`,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom+=120% top", scrub: true },
        });
      });
    }
  }

  /* ------------------------------------------------------------------
     2. GENEL PARALLAX: [data-speed]
     Hero dışındaki öğeler: speed > 0 yukarı, < 0 aşağı doğru kayar.
     ------------------------------------------------------------------ */
  function initSpeedLayers() {
    document.querySelectorAll("[data-speed]").forEach((el) => {
      if (el.closest(".hero")) return; // hero kendi içinde yönetiliyor
      const speed = parseFloat(el.dataset.speed);
      const section = el.closest("section") || el.parentElement;
      gsap.fromTo(
        el,
        { y: () => speed * 120 },
        {
          y: () => -speed * 120,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
        }
      );
    });
  }

  /* ------------------------------------------------------------------
     3. MANİFESTO: kelimeler kaydırdıkça soluk → parlak
     ------------------------------------------------------------------ */
  function initManifesto() {
    const el = document.querySelector(".manifesto__text[data-highlight]");
    if (!el) return;

    // Turuncu vurgulanacak anahtar kelimeler
    const keys = ["flower", "studios", "oyunlar", "uygulamalar", "dünyası"];

    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", words.join(" "));
    el.innerHTML = words
      .map((w) => {
        const clean = w.toLocaleLowerCase("tr").replace(/[.,]/g, "");
        const key = keys.includes(clean) ? " is-key" : "";
        return `<span class="hl-word${key}" aria-hidden="true">${w}</span>`;
      })
      .join(" ");

    gsap.to(el.querySelectorAll(".hl-word"), {
      opacity: 1,
      stagger: 0.1,
      ease: "none",
      scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 42%", scrub: 0.6 },
    });
  }

  /* ------------------------------------------------------------------
     4. AÇILI ŞERİT: turuncu ve beyaz şeritler zıt yönlerden uzar
     ------------------------------------------------------------------ */
  function initSlash() {
    document.querySelectorAll(".slash").forEach((slash) => {
      gsap.to(slash.querySelectorAll(".slash__bar"), {
        scaleX: 1,
        ease: "none",
        stagger: 0.15,
        scrollTrigger: { trigger: slash, start: "top 95%", end: "top 35%", scrub: 0.8 },
      });
    });
  }

  /* ------------------------------------------------------------------
     5. PROJE İLLÜSTRASYONLARI
     Her katman data-depth oranında kayar (derin = daha çok hareket).
     Fare ile kartın üzerinde gezinince katmanlar hafifçe kayar.
     ------------------------------------------------------------------ */
  function initProjectArt() {
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    document.querySelectorAll(".project__media").forEach((media) => {
      const layers = media.querySelectorAll(".art__layer");

      // Kaydırma derinliği
      layers.forEach((layer) => {
        const d = parseFloat(layer.dataset.depth || 0.3);
        gsap.fromTo(
          layer,
          { yPercent: d * 14 },
          {
            yPercent: -d * 14,
            ease: "none",
            scrollTrigger: { trigger: media, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });

      // Kutunun kendisi de biraz kayar ve içeri girerken düzleşir
      gsap.fromTo(
        media,
        { rotate: media.closest(".project--reverse") ? 2 : -2, scale: 0.94 },
        {
          rotate: 0,
          scale: 1,
          ease: "power2.out",
          scrollTrigger: { trigger: media, start: "top 95%", end: "top 40%", scrub: 0.8 },
        }
      );

      // Fare ile derinlik
      if (!finePointer) return;
      const movers = [...layers].map((layer) => ({
        d: parseFloat(layer.dataset.depth || 0.3),
        x: gsap.quickTo(layer, "x", { duration: 0.8, ease: "power3.out" }),
      }));
      media.addEventListener("mousemove", (e) => {
        const r = media.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
        movers.forEach((m) => m.x(nx * m.d * -60));
      });
      media.addEventListener("mouseleave", () => movers.forEach((m) => m.x(0)));
    });
  }

  /* ------------------------------------------------------------------
     6. MARQUEE: satırlar kaydırma yönüne göre zıt yönlerde akar
     ------------------------------------------------------------------ */
  function initMarquee() {
    document.querySelectorAll("[data-marquee]").forEach((row) => {
      const dir = parseFloat(row.dataset.marquee);
      gsap.fromTo(
        row,
        { xPercent: dir > 0 ? -30 : 0 },
        {
          xPercent: dir > 0 ? 0 : -30,
          ease: "none",
          scrollTrigger: { trigger: row.parentElement, start: "top bottom", end: "bottom top", scrub: 0.5 },
        }
      );
    });
  }
})();
