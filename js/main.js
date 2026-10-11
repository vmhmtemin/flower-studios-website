/* ==========================================================================
   Flower Studios — main.js
   Her sayfada çalışan ortak davranışlar:
   - Lenis yumuşak kaydırma + GSAP ScrollTrigger senkronizasyonu
   - Navigasyon (kaydırınca arka plan, aşağı inerken gizlenme, mobil menü)
   - Scroll ilerleme çubuğu
   - [data-reveal] öğelerinin belirme animasyonları
   - Metni kelime/harf olarak bölme yardımcısı (FS.split)
   ========================================================================== */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  // Kullanıcı "hareketi azalt" ayarını açtıysa animasyonları sadeleştir
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Diğer scriptlerin kullanması için ortak isim alanı
  const FS = (window.FS = { reduceMotion, lenis: null });

  /* ---------- Metin bölme yardımcısı ----------
     Bir öğenin metnini kelimelere ("words") veya harflere ("chars") böler.
     Her parça maskeli bir span içine alınır, böylece aşağıdan kayarak çıkabilir. */
  FS.split = function (el, type = "words") {
    if (el.dataset.splitDone) return el.querySelectorAll(".split-item");
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.textContent = "";

    text.split(" ").forEach((word, wi, arr) => {
      const mask = document.createElement("span");
      mask.className = "split-mask";
      mask.setAttribute("aria-hidden", "true");

      if (type === "chars") {
        [...word].forEach((ch) => {
          const s = document.createElement("span");
          s.className = "split-item";
          s.textContent = ch;
          mask.appendChild(s);
        });
      } else {
        const s = document.createElement("span");
        s.className = "split-item";
        s.textContent = word;
        mask.appendChild(s);
      }
      el.appendChild(mask);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });

    el.dataset.splitDone = "1";
    return el.querySelectorAll(".split-item");
  };

  /* ---------- Navigasyon ---------- */
  function initNav() {
    const nav = document.querySelector(".nav");
    const toggle = document.querySelector(".nav__toggle");
    if (!nav) return;

    let lastY = 0;
    const onScroll = (y) => {
      nav.classList.toggle("is-scrolled", y > 40);
      // Aşağı inerken gizle, yukarı çıkarken göster (mobil menü açıkken değil)
      const goingDown = y > lastY && y > window.innerHeight * 0.6;
      if (!document.body.classList.contains("nav-open")) {
        nav.classList.toggle("is-hidden", goingDown);
      }
      lastY = y;
    };

    if (FS.lenis) FS.lenis.on("scroll", (e) => onScroll(e.scroll));
    else window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });

    if (toggle) {
      toggle.addEventListener("click", () => {
        const open = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open);
        if (FS.lenis) open ? FS.lenis.stop() : FS.lenis.start();
      });
      // Menüden bir bağlantıya tıklanınca menüyü kapat
      nav.querySelectorAll(".nav__links a").forEach((a) =>
        a.addEventListener("click", () => {
          document.body.classList.remove("nav-open");
          if (FS.lenis) FS.lenis.start();
        })
      );
    }
  }

  /* ---------- Lenis + ScrollTrigger ---------- */
  function initSmoothScroll() {
    if (reduceMotion || typeof Lenis === "undefined") return;

    FS.lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // Lenis'in her karesini GSAP'ın zamanlayıcısına bağla
    FS.lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => FS.lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Sayfa içi (#) bağlantılar Lenis ile yumuşak kaysın
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        FS.lenis.scrollTo(target, { offset: -40 });
      });
    });
  }

  /* ---------- Scroll ilerleme çubuğu ---------- */
  function initProgress() {
    const bar = document.querySelector(".progress");
    if (!bar) return;
    gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
    });
  }

  /* ---------- [data-reveal] belirme animasyonları ----------
     Kullanım:
       data-reveal            → aşağıdan yumuşak belirme
       data-reveal="words"    → kelime kelime yukarı kayma
       data-reveal="chars"    → harf harf yukarı kayma
       data-reveal="slash"    → açılı maskeyle soldan açılma
       data-delay="0.2"       → gecikme (saniye) */
  function initReveals() {
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      const type = el.dataset.reveal;
      const delay = parseFloat(el.dataset.delay || 0);
      const trigger = { trigger: el, start: "top 86%", once: true };

      if (type === "words" || type === "chars") {
        const items = FS.split(el, type);
        gsap.set(el, { opacity: 1 });
        gsap.from(items, {
          yPercent: 110,
          rotate: type === "chars" ? 8 : 3,
          duration: 1.1,
          ease: "expo.out",
          stagger: type === "chars" ? 0.025 : 0.06,
          delay,
          scrollTrigger: trigger,
        });
      } else if (type === "slash") {
        gsap.fromTo(
          el,
          { opacity: 1, clipPath: "polygon(0 0, 0 0, -20% 100%, 0 100%)" },
          {
            clipPath: "polygon(0 0, 120% 0, 100% 100%, 0 100%)",
            duration: 1.3,
            ease: "expo.out",
            delay,
            scrollTrigger: trigger,
          }
        );
      } else {
        gsap.fromTo(
          el,
          { opacity: 0, y: 50 },
          { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", delay, scrollTrigger: trigger }
        );
      }
    });
  }

  /* ---------- Başlat ---------- */
  function init() {
    if (typeof gsap === "undefined") {
      // CDN yüklenemezse içerik yine de görünsün
      document.documentElement.classList.remove("js");
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    initSmoothScroll();
    initNav();

    if (reduceMotion) {
      document.querySelectorAll("[data-reveal]").forEach((el) => (el.style.opacity = 1));
    } else {
      initProgress();
      initReveals();
    }

    // Sayfaya özel scriptler (parallax.js vb.) bu olayı dinler
    document.dispatchEvent(new CustomEvent("fs:ready"));

    // Fontlar yüklenince ölçüleri yeniden hesapla
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
