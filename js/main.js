/* ==========================================================================
   Flower Studios — main.js
   Her sayfada çalışan ortak davranışlar:
   - Lenis yumuşak kaydırma + GSAP ScrollTrigger senkronizasyonu
   - Navigasyon (kaydırınca arka plan, aşağı inerken gizlenme, mobil menü)
   - FS.fit: [data-fit] yazıları kapsayıcı genişliğine tam oturtma
   - FS.split: metni kelime/harf parçalarına bölme
   - [data-reveal="words"]: başlıkların kelime kelime girişi
   Sayfaya özel scriptler "fs:ready" olayını dinler.
   ========================================================================== */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FS = (window.FS = { reduceMotion, lenis: null });

  /* ---------- Metin bölme ---------- */
  FS.split = function (el, type = "words") {
    if (el.dataset.splitDone) return el.querySelectorAll(".split-item");
    const text = el.textContent.trim().replace(/\s+/g, " ");
    el.setAttribute("aria-label", text);
    el.textContent = "";
    text.split(" ").forEach((word, i, arr) => {
      const mask = document.createElement("span");
      mask.className = "split-mask";
      mask.setAttribute("aria-hidden", "true");
      const parts = type === "chars" ? [...word] : [word];
      parts.forEach((p) => {
        const s = document.createElement("span");
        s.className = "split-item";
        s.textContent = p;
        mask.appendChild(s);
      });
      el.appendChild(mask);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.dataset.splitDone = "1";
    return el.querySelectorAll(".split-item");
  };

  /* ---------- Yazıyı genişliğe oturtma ----------
     [data-fit] > .fit-inner: iç öğe 100px'te ölçülür, kapsayıcının içerik
     genişliğine göre orantılanır. Ölçüm sadece yüklemede ve yeniden
     boyutlandırmada yapılır (her karede değil). */
  FS.fit = function () {
    document.querySelectorAll("[data-fit]").forEach((el) => {
      const inner = el.querySelector(".fit-inner");
      if (!inner) return;
      const cs = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      el.style.fontSize = "100px";
      const w = inner.getBoundingClientRect().width;
      if (w > 0) el.style.fontSize = Math.floor((100 * avail / w) * 100) / 100 + "px";
    });
  };

  /* ---------- Tema (açık / koyu) ----------
     Tercih localStorage'da saklanır; ilk çizimden önce <head> içindeki
     küçük script uygular, burada sadece düğme yönetilir. */
  function initTheme() {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const sync = () => {
      const light = root.getAttribute("data-theme") === "light";
      btn.setAttribute("aria-label", light ? "Koyu temaya geç" : "Açık temaya geç");
      btn.setAttribute("aria-pressed", String(light));
      if (meta) meta.setAttribute("content", light ? "#ffffff" : "#000000");
    };
    btn.addEventListener("click", () => {
      const light = root.getAttribute("data-theme") !== "light";
      if (light) root.setAttribute("data-theme", "light");
      else root.removeAttribute("data-theme");
      try { localStorage.setItem("fs-theme", light ? "light" : "dark"); } catch (e) {}
      sync();
    });
    sync();
  }

  /* ---------- Navigasyon ---------- */
  function initNav() {
    const nav = document.querySelector(".nav");
    const toggle = document.querySelector(".nav__toggle");
    if (!nav) return;

    /* Görünürlük kuralları:
       - Sayfanın en başında gizli (hero'daki dağınık parçalarla çakışmasın);
         biraz aşağı kaydırınca (SHOW_AFTER) yukarıdan gelir.
       - Hero bittikten sonra: aşağı inerken gizlenir, yukarı çıkarken görünür.
       - Mobil menü açıkken ya da klavye odağı menüdeyken hep görünür. */
    const SHOW_AFTER = 60;
    const heroEnd = () => {
      const h = document.querySelector(".hero");
      return h ? h.offsetHeight : window.innerHeight;
    };
    let lastY = 0;
    let focusInside = false;
    const onScroll = (y) => {
      nav.classList.toggle("is-scrolled", y > 40);
      if (document.body.classList.contains("nav-open") || focusInside) {
        nav.classList.remove("is-hidden");
      } else if (y < SHOW_AFTER) {
        nav.classList.add("is-hidden");
      } else if (y > heroEnd() && y > lastY + 2) {
        nav.classList.add("is-hidden");
      } else if (y < lastY - 2 || y <= heroEnd()) {
        nav.classList.remove("is-hidden");
      }
      lastY = y;
    };
    // Tarayıcının kendi kaydırma olayı: Lenis, kaydırma çubuğu, klavye ya da
    // dokunmatik, her durumda tetiklenir
    window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });
    onScroll(window.scrollY);
    // Klavye ile menüye gelen kullanıcı için nav her zaman görünür olsun
    nav.addEventListener("focusin", () => { focusInside = true; nav.classList.remove("is-hidden"); });
    nav.addEventListener("focusout", () => { focusInside = false; });

    if (!toggle) return;
    const setOpen = (open) => {
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (FS.lenis) open ? FS.lenis.stop() : FS.lenis.start();
    };
    toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
    nav.querySelectorAll(".nav__links a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Lenis + ScrollTrigger ---------- */
  function initSmoothScroll() {
    if (reduceMotion || typeof Lenis === "undefined") return;
    FS.lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    FS.lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => FS.lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Sayfa içi bağlantılar
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        const target = id.length > 1 && document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        FS.lenis.scrollTo(target, { offset: -24 });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    });
  }

  /* ---------- Başlık girişleri ---------- */
  function initReveals() {
    document.querySelectorAll('[data-reveal="words"]').forEach((el) => {
      const items = FS.split(el, "words");
      gsap.set(el, { visibility: "visible" });
      gsap.from(items, {
        yPercent: 110,
        duration: 1.1,
        ease: "expo.out",
        stagger: 0.05,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
  }

  /* ---------- Başlat ---------- */
  function init() {
    FS.fit();
    initTheme();

    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      // Kütüphaneler yüklenemezse içerik yine de tamamen görünsün
      document.documentElement.classList.remove("js");
      initNavFallback();
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    initSmoothScroll();
    initNav();
    if (reduceMotion) {
      document.querySelectorAll("[data-reveal]").forEach((el) => (el.style.visibility = "visible"));
    } else {
      initReveals();
    }

    document.dispatchEvent(new CustomEvent("fs:ready"));

    // Fontlar yüklenince ve pencere boyutu değişince ölçüleri yenile
    const refit = () => { FS.fit(); ScrollTrigger.refresh(); };
    if (document.fonts) {
      document.fonts.ready.then(refit);
      // Montserrat, ilk ölçümden sonra yüklenirse yeniden oturt
      document.fonts.addEventListener("loadingdone", refit);
    }
    window.addEventListener("load", refit);
    let t;
    let lastW = window.innerWidth;
    window.addEventListener("resize", () => {
      // Mobilde adres çubuğu yüksekliği değişince değil, sadece genişlik değişince
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(refit, 150);
    });
  }

  function initNavFallback() {
    const toggle = document.querySelector(".nav__toggle");
    if (toggle) toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
