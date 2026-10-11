/* ==========================================================================
   Flower Studios — hero-worlds.js
   Hero'nun arka planında logonun üç parçası (beyaz üçgen, iki turuncu şerit)
   farklı boy, açı ve hızlarda yavaşça süzülür. Arada bir, ortadaki logodan
   uzak bir noktada üç parça birleşip küçük bir F olur, kısa bir süre durur
   ve yeniden dağılır: başka yerlerde de yeni dünyalar kuruluyor.

   - Tek SVG katmanı, tek döngü (gsap.ticker). Her parçanın konumunu sadece
     render() yazar; birleşme/dağılma tween'leri parça nesnesinin
     değerlerini değiştirir (ışınlanma olmaz).
   - Aynı anda en fazla iki birleşme; birbirlerinden uzak noktalarda.
   - Hero ekranda değilken ve sekme arka plandayken çalışmaz.
   - "Hareketi azalt" açıksa parçalar sabit durur, birleşme olmaz.
   ========================================================================== */

(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  // Logo geometrisi (viewBox 415×650) — parçalar kendi merkezlerine göre çizilir
  const SHAPES = {
    white: { pts: [[10, 260], [142, 175], [142, 643]], c: [76, 409] },
    top: { pts: [[154, 167], [405, 8], [377, 138], [154, 265]], c: [279.5, 136.5] },
    bottom: { pts: [[154, 328], [352, 235], [323, 330], [154, 408]], c: [253, 321.5] },
  };
  const LOGO_C = [207.5, 325.5]; // logonun merkezi
  const TYPES = Object.keys(SHAPES);

  // Ayarlar
  const CFG = {
    count: { desktop: 18, mobile: 12 },
    scale: [0.05, 0.22],           // parça boyu (logoya oranla)
    speed: [6, 18],                // px/sn
    spin: 7,                       // derece/sn (±)
    opacity: { white: [0.1, 0.2], orange: [0.25, 0.5] },
    // Birleşen F'nin boyu: uzak (z=0) → yakın (z=1). Uzaktakiler küçük,
    // daha saydam ve kaydırmada daha yavaş: derinlik hissi.
    formScale: { desktop: [0.035, 0.15], mobile: [0.025, 0.1] },
    formOpacity: { white: [0.1, 0.38], orange: [0.2, 0.72] },
    formDepth: [0.35, 1.1],        // parallax derinliği (uzak → yakın)
    farBias: 1.8,                  // >1: uzak/küçük birleşmeler daha sık
    formEvery: [1, 2.5],           // sn — birleşmeler arası bekleme
    maxForming: 3,                 // aynı anda en fazla kaç F
    gapPad: 40,                    // iki F'nin kenarları arasındaki en az boşluk (px)
    formIn: 1.8, hold: 1.6, formOut: 1.3,
    parallax: 0.35,                // kaydırmada derinliğe göre yukarı kayma
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  document.addEventListener("fs:ready", init);

  function init() {
    const svg = document.querySelector(".hero__worlds");
    if (!svg) return;
    const stage = svg.closest(".hero__stage");
    const reduce = window.FS && window.FS.reduceMotion;

    let W = 0, H = 0, mobile = false, avoid = null;
    const parts = [];

    /* ---------- Ölçüm: sahne boyu ve kaçınılacak orta alan ---------- */
    function measure() {
      const r = stage.getBoundingClientRect();
      W = r.width;
      H = r.height;
      mobile = W < 700;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      // Ortadaki logo + başlık kelimelerinin gerçek kutuları (biraz genişletilmiş):
      // birleşmeler ve parçaların doğduğu yerler buraya düşmez
      const boxes = [...stage.querySelectorAll(".hero__logo, .hero__word")].map((el) => el.getBoundingClientRect());
      const pad = mobile ? 24 : 60;
      avoid = {
        l: Math.min(...boxes.map((b) => b.left)) - r.left - pad,
        r: Math.max(...boxes.map((b) => b.right)) - r.left + pad,
        t: Math.min(...boxes.map((b) => b.top)) - r.top - pad,
        b: Math.max(...boxes.map((b) => b.bottom)) - r.top + pad,
      };
    }
    const inAvoid = (x, y) => x > avoid.l && x < avoid.r && y > avoid.t && y < avoid.b;

    /* ---------- Parçaları oluştur ---------- */
    function polyPoints(type) {
      const s = SHAPES[type];
      return s.pts.map(([x, y]) => `${x - s.c[0]},${y - s.c[1]}`).join(" ");
    }

    function randomVelocity(p, boost = 1) {
      const a = rand(0, Math.PI * 2);
      const v = rand(CFG.speed[0], CFG.speed[1]) * (0.6 + 0.4 * p.d) * boost;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.vr = rand(-CFG.spin, CFG.spin);
    }

    function baseLook(p) {
      const k = mobile ? 0.75 : 1;
      p.baseS = rand(CFG.scale[0], CFG.scale[1]) * k;
      const range = p.type === "white" ? CFG.opacity.white : CFG.opacity.orange;
      // Küçük (uzak) parçalar daha soluk
      const t = (p.baseS / k - CFG.scale[0]) / (CFG.scale[1] - CFG.scale[0]);
      p.baseO = range[0] + (range[1] - range[0]) * t;
    }

    function build() {
      measure();
      svg.innerHTML = "";
      parts.length = 0;
      const n = mobile ? CFG.count.mobile : CFG.count.desktop;
      for (let i = 0; i < n; i++) {
        const type = TYPES[i % 3];
        const el = document.createElementNS(NS, "polygon");
        el.setAttribute("points", polyPoints(type));
        el.setAttribute("class", type === "white" ? "wp wp--white" : "wp wp--orange");
        svg.appendChild(el);
        const p = { type, el, mode: "drift", d: rand(0.4, 1.4) };
        baseLook(p);
        p.s = p.baseS;
        p.o = p.baseO;
        p.r = rand(-180, 180);
        // Ortadaki alanın dışında bir yer seç
        let tries = 0;
        do { p.x = rand(0, W); p.y = rand(0, H); } while (inAvoid(p.x, p.y) && ++tries < 30);
        randomVelocity(p);
        parts.push(p);
      }
    }

    /* ---------- Çizim (tek yazıcı) ---------- */
    let par = 0; // kaydırma parallax'ı (px)
    function render() {
      for (const p of parts) {
        p.el.setAttribute(
          "transform",
          `translate(${p.x.toFixed(1)} ${(p.y - par * p.d).toFixed(1)}) rotate(${p.r.toFixed(1)}) scale(${p.s.toFixed(4)})`
        );
        p.el.style.opacity = p.o.toFixed(3);
      }
    }

    /* ---------- Süzülme ---------- */
    const M = 140; // ekran dışı pay: parça bu kadar çıkınca karşı kenardan girer
    function step(dt) {
      for (const p of parts) {
        if (p.mode !== "drift") continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        const yy = p.y - par * p.d;
        if (p.x < -M) p.x = W + M;
        else if (p.x > W + M) p.x = -M;
        if (yy < -M) p.y += H + 2 * M;
        else if (yy > H + M) p.y -= H + 2 * M;
      }
    }

    /* ---------- Birleşme: üç parça bir F olur, durur, dağılır ---------- */
    let forming = 0;             // şu an birleşmekte olan F sayısı
    const spots = [];            // aktif birleşme noktaları
    const timelines = new Set(); // aktif birleşme zaman çizelgeleri
    let nextForm = rand(1.2, 2); // ilk birleşme açılıştan kısa süre sonra

    // rad: F'nin yarıçapı (px). Kenardan ve diğer F'lerden bu kadar uzak dur.
    function findSpot(rad) {
      const m = rad + (mobile ? 20 : 40);
      for (let i = 0; i < 40; i++) {
        const x = rand(m, W - m);
        const y = rand(m + 40, H - m);
        const clear = spots.every(([sx, sy, sr]) => Math.hypot(sx - x, sy - y) > sr + rad + CFG.gapPad);
        if (!inAvoid(x, y) && clear) return [x, y, rad];
      }
      return null;
    }

    const lerp = (a, b, t) => a + (b - a) * t;

    function form() {
      // Bu F ne kadar yakın? (0 uzak, 1 yakın) — uzak olanlar daha sık
      const z = Math.pow(Math.random(), CFG.farBias);
      const sc = mobile ? CFG.formScale.mobile : CFG.formScale.desktop;
      const S = lerp(sc[0], sc[1], z);
      const spot = findSpot(650 * S * 0.6);
      if (!spot) return;
      const [fx, fy] = spot;
      // Her türden, noktaya en yakın süzülen parçayı seç (doğal bir toplanma)
      const trio = TYPES.map((type) => {
        let best = null, bd = Infinity;
        for (const p of parts) {
          if (p.type !== type || p.mode !== "drift") continue;
          const dx = p.x - fx, dy = p.y - par * p.d - fy;
          const dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = p; }
        }
        return best;
      });
      if (trio.some((p) => !p)) return;

      forming++;
      spots.push(spot);
      const dForm = lerp(CFG.formDepth[0], CFG.formDepth[1], z);
      const tl = gsap.timeline({
        onComplete: () => {
          trio.forEach((p) => { p.mode = "drift"; });
          forming--;
          spots.splice(spots.indexOf(spot), 1);
          timelines.delete(tl);
        },
      });

      timelines.add(tl);
      trio.forEach((p) => {
        p.mode = "form";
        const c = SHAPES[p.type].c;
        // Ortak derinlik: parallax üç parçayı birlikte taşır; uzak F daha yavaş kayar
        const op = p.type === "white" ? CFG.formOpacity.white : CFG.formOpacity.orange;
        tl.to(p, {
          x: fx + (c[0] - LOGO_C[0]) * S,
          y: fy + par * dForm + (c[1] - LOGO_C[1]) * S,
          r: Math.round(p.r / 360) * 360,
          s: S,
          d: dForm,
          o: lerp(op[0], op[1], z),
          duration: CFG.formIn,
          ease: "power3.inOut",
        }, 0);
      });

      // Dağılma: F'nin merkezinden dışarı doğru, yeni hız ve görünümle
      tl.add(() => {
        trio.forEach((p) => {
          const ang = Math.atan2(p.y - par * dForm - fy, p.x - fx) + rand(-0.5, 0.5);
          const push = rand(60, 140);
          baseLook(p);
          p.d = rand(0.4, 1.4);
          randomVelocity(p, 1.2);
          gsap.to(p, {
            x: p.x + Math.cos(ang) * push,
            y: p.y + Math.sin(ang) * push,
            r: p.r + rand(-90, 90),
            s: p.baseS,
            o: p.baseO,
            duration: CFG.formOut,
            ease: "power2.out",
          });
        });
      }, CFG.formIn + CFG.hold);
      tl.to({}, { duration: CFG.formOut }, CFG.formIn + CFG.hold);
    }

    /* ---------- Döngü ---------- */
    let visible = true;
    function tick(_, deltaMs) {
      if (!visible) return;
      const dt = Math.min(deltaMs, 100) / 1000; // sekme dönüşünde büyük sıçrama olmasın
      par = window.scrollY * CFG.parallax;
      step(dt);
      if (forming < CFG.maxForming) {
        nextForm -= dt;
        if (nextForm <= 0) {
          form();
          nextForm = rand(CFG.formEvery[0], CFG.formEvery[1]);
        }
      }
      render();
    }

    build();
    render();

    // Hata ayıklama için durum (konsoldan: FS.worlds.state())
    if (window.FS) {
      window.FS.worlds = { state: () => ({ W, H, avoid, forming, nextForm, visible, n: parts.length, spots: spots.map((s) => s.map(Math.round)) }) };
    }

    if (reduce) return; // sabit dursun

    // Açılışla birlikte belirsin
    gsap.from(svg, { opacity: 0, duration: 2, delay: 0.3, ease: "power2.out" });

    // Hero görünmüyorsa çalışma. Hero pin'lendiği için ölçü pin aralığını da
    // içeren .pin-spacer üzerinden alınır.
    const hero = stage.closest(".hero");
    ScrollTrigger.create({
      trigger: hero.closest(".pin-spacer") || hero,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => { visible = self.isActive; },
      onRefresh: (self) => { visible = self.isActive; },
    });
    gsap.ticker.add(tick);

    // Genişlik değişince yeniden kur (mobilde adres çubuğu yüksekliği değil)
    let lastW = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(init._t);
      init._t = setTimeout(() => {
        timelines.forEach((t) => t.kill());
        timelines.clear();
        gsap.killTweensOf(parts);
        forming = 0;
        spots.length = 0;
        nextForm = rand(1, 2);
        build();
        render();
      }, 200);
    });
  }
})();
