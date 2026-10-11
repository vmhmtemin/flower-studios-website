/* ==========================================================================
   Flower Studios — hero-worlds.js
   Hero'nun arka planında logonun üç parçası (beyaz üçgen, iki turuncu şerit)
   yavaşça süzülür. Arada bir, ortadaki logodan uzak bir noktada üç parça
   birleşip bir F olur, kısa bir süre durur ve yeniden dağılır: başka
   yerlerde de yeni dünyalar kuruluyor.

   DERİNLİK: her parçanın doğduğu andan itibaren sabit bir uzaklığı (z) var.
     z = 0 uzak  → küçük, çok saydam, yavaş, kaydırmada az kayar
     z = 1 yakın → büyük, belirgin, hızlı, kaydırmada çok kayar
   Bir F yalnızca AYNI DERİNLİKTEKİ (boyları en fazla ~%30 farklı) üç
   parçadan oluşur; F'nin boyu o parçaların ortalama boyudur. Yani küçük
   F'leri uzaktaki küçük parçalar kurar, büyük parça küçülüp uzaklaşmaz.

   - Her parça kendi katmanında (div + küçük SVG); hareket sadece CSS
     transform/opacity ile → ekran kartı taşır, her karede yeniden boyama
     yok (telefonda kasmayı önler). Tek döngü (gsap.ticker); konumu sadece
     render() yazar (ışınlanma olmaz).
   - Telefonda daha az parça ve aynı anda tek birleşme.
   - Aynı anda en fazla üç birleşme; birbirlerine çarpmayacak noktalarda.
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
    count: { desktop: 22, mobile: 14 },
    formOnMobile: true,            // telefonda da birleşme var (aynı anda en fazla 1)
    farBias: 1,                    // 1: derinlikler eşit dağılır (>1 olursa uzak/küçük parçalar çoğalır)
    // Derinliğe göre (uzak → yakın)
    scale: [0.06, 0.22],           // parça boyu (logoya oranla); mobilde ×0.7
    opacity: { white: [0.08, 0.22], orange: [0.18, 0.55] },
    speed: [3, 16],                // px/sn
    depth: [0.3, 1.1],             // kaydırma parallax'ı
    spin: 7,                       // derece/sn (±)
    sizeMatch: 1.35,               // F için en büyük / en küçük parça oranı sınırı
    sizeMatchMobile: 1.6,          // telefonda az parça var; tolerans biraz geniş (yine de çok farklı boylar eşleşmez)
    reach: 0.5,                    // eşleşecek parçalar en fazla ekranın uzun kenarının bu oranı kadar uzakta
    rest: 4,                       // sn — dağılan parça bu kadar süre yeni F'ye katılmaz
    formGlow: 1.6,                 // F olunca opaklık bu kadar artar (derinliğe göre sınırlı)
    formGlowCap: { white: 0.4, orange: 0.75 },
    formEvery: [1, 2.5],           // sn — birleşmeler arası bekleme
    maxForming: 3,                 // aynı anda en fazla kaç F (telefonda 1)
    gapPad: 40,                    // iki F'nin kenarları arasındaki en az boşluk (px)
    formIn: 1.8, hold: 1.6, formOut: 1.3,
    parallax: 0.35,
  };
  const lerp = (a, b, t) => a + (b - a) * t;

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
      measureAvoid();
    }

    // Ortadaki logo + başlık kelimelerinin gerçek kutuları (biraz genişletilmiş):
    // birleşmeler ve parçaların doğduğu yerler buraya düşmez. Font geç
    // yüklenince başlık satır değiştirebildiği için her denemede yeniden ölçülür.
    function measureAvoid() {
      const r = stage.getBoundingClientRect();
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
    // Her parça: 0×0'lık bir div (orijini parçanın merkezi) içinde, parçanın
    // kendi sınırlarını kaplayan küçük bir SVG
    function makeEl(type) {
      const s = SHAPES[type];
      const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY;
      const el = document.createElement("div");
      el.className = "wp";
      const g = document.createElementNS(NS, "svg");
      g.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
      g.setAttribute("width", w);
      g.setAttribute("height", h);
      g.style.left = minX - s.c[0] + "px";
      g.style.top = minY - s.c[1] + "px";
      const poly = document.createElementNS(NS, "polygon");
      poly.setAttribute("points", s.pts.map((p) => p.join(",")).join(" "));
      poly.setAttribute("class", type === "white" ? "wp--white" : "wp--orange");
      g.appendChild(poly);
      el.appendChild(g);
      return el;
    }

    // Hız derinliğe bağlı: uzaktakiler daha yavaş görünür
    function randomVelocity(p, boost = 1) {
      const a = rand(0, Math.PI * 2);
      const v = lerp(CFG.speed[0], CFG.speed[1], p.z) * rand(0.75, 1.25) * boost;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.vr = rand(-CFG.spin, CFG.spin);
    }

    // Boy, opaklık ve parallax tamamen derinlikten gelir
    function applyDepth(p) {
      const k = mobile ? 0.7 : 1;
      const range = p.type === "white" ? CFG.opacity.white : CFG.opacity.orange;
      p.baseS = lerp(CFG.scale[0], CFG.scale[1], p.z) * k;
      p.baseO = lerp(range[0], range[1], p.z);
      p.baseD = lerp(CFG.depth[0], CFG.depth[1], p.z);
    }

    function build() {
      measure();
      svg.innerHTML = "";
      parts.length = 0;
      const n = mobile ? CFG.count.mobile : CFG.count.desktop;
      for (let i = 0; i < n; i++) {
        const type = TYPES[i % 3];
        const el = makeEl(type);
        svg.appendChild(el);
        const p = { type, el, mode: "drift", z: Math.pow(Math.random(), CFG.farBias) };
        applyDepth(p);
        p.s = p.baseS;
        p.o = p.baseO;
        p.d = p.baseD;
        p.r = rand(-180, 180);
        // Ekranın herhangi bir yerinde doğar (süzülen parçalar yazının arkasından
        // geçebilir; sadece birleşmeler orta alandan kaçınır)
        p.x = rand(0, W);
        p.y = rand(0, H);
        randomVelocity(p);
        parts.push(p);
      }
      // Uzaktakiler arkada kalsın
      parts.slice().sort((a, b) => a.z - b.z).forEach((p) => svg.appendChild(p.el));
    }

    /* ---------- Çizim (tek yazıcı) ---------- */
    let par = 0; // kaydırma parallax'ı (px)
    const look = { fade: reduce ? 1 : 0 }; // açılış girişi
    function render() {
      for (const p of parts) {
        const st = p.el.style;
        st.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y - par * p.d).toFixed(1)}px, 0) rotate(${p.r.toFixed(1)}deg) scale(${p.s.toFixed(4)})`;
        st.opacity = (p.o * look.fade).toFixed(3);
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
    const formLog = [];          // son birleşmeler (hata ayıklama)
    const diag = { noTrio: 0, noSpot: 0 };
    let nextForm = rand(1.2, 2); // ilk birleşme açılıştan kısa süre sonra

    const screenY = (p) => p.y - par * p.d;
    const onScreen = (p) => p.x > 0 && p.x < W && screenY(p) > 0 && screenY(p) < H;

    // Bir F için uygun yer mi? (orta alanın dışı, kenarlardan ve diğer F'lerden uzak)
    function spotOk(x, y, rad) {
      const m = rad + (mobile ? 16 : 30);
      if (x < m || x > W - m || y < m + 40 || y > H - m) return false;
      if (inAvoid(x, y)) return false;
      return spots.every(([sx, sy, sr]) => Math.hypot(sx - x, sy - y) > sr + rad + CFG.gapPad);
    }

    // Parçaların ortası uygun değilse (ör. ortadaki logo alanı) yakındaki
    // uygun bir noktayı ara
    function nearestSpot(x, y, rad) {
      if (spotOk(x, y, rad)) return [x, y, rad];
      const step = mobile ? 30 : 50;
      for (let ring = 1; ring <= 8; ring++) {
        const off = rand(0, Math.PI * 2);
        for (let k = 0; k < 10; k++) {
          const a = off + (k / 10) * Math.PI * 2;
          const nx = x + Math.cos(a) * ring * step;
          const ny = y + Math.sin(a) * ring * step;
          if (spotOk(nx, ny, rad)) return [nx, ny, rad];
        }
      }
      return null;
    }

    // Aynı derinlikte, birbirine yakın üç parça bul (her türden bir tane)
    function findTrio() {
      const now = performance.now() / 1000;
      const free = parts.filter((p) => p.mode === "drift" && onScreen(p) && !(p.restUntil > now));
      // Rastgele bir "tohum" parçadan başla
      for (let attempt = 0; attempt < 12; attempt++) {
        const seed = free[Math.floor(Math.random() * free.length)];
        if (!seed) return null;
        const trio = { [seed.type]: seed };
        let ok = true;
        for (const type of TYPES) {
          if (trio[type]) continue;
          let best = null, bd = Infinity;
          for (const p of free) {
            if (p.type !== type) continue;
            const ratio = Math.max(p.baseS, seed.baseS) / Math.min(p.baseS, seed.baseS);
            if (ratio > (mobile ? CFG.sizeMatchMobile : CFG.sizeMatch)) continue;           // farklı derinlik: eşleşmez
            const dd = Math.hypot(p.x - seed.x, screenY(p) - screenY(seed));
            if (dd < bd) { bd = dd; best = p; }
          }
          if (!best || bd > Math.max(W, H) * CFG.reach) { ok = false; break; }
          trio[type] = best;
        }
        if (!ok) continue;
        const list = TYPES.map((t) => trio[t]);
        // Üç parçanın da birbirine uyumlu olduğundan emin ol
        const ss = list.map((p) => p.baseS);
        if (Math.max(...ss) / Math.min(...ss) > (mobile ? CFG.sizeMatchMobile : CFG.sizeMatch)) continue;
        return list;
      }
      return null;
    }

    function form() {
      measureAvoid();
      const trio = findTrio();
      if (!trio) { diag.noTrio++; return false; }

      // Ortak boy, derinlik: üç parçanın ortalaması (en fazla ~%15 uyum payı)
      const avg = (f) => trio.reduce((s, p) => s + f(p), 0) / 3;
      const S = avg((p) => p.baseS);
      const dF = avg((p) => p.baseD);
      // F, parçaların bulunduğu yerin ortasında oluşur
      const rad = 650 * S * 0.6;
      const spot = nearestSpot(avg((p) => p.x), avg((p) => screenY(p)), rad);
      if (!spot) { diag.noSpot++; return false; }
      const [fx, fy] = spot;

      forming++;
      spots.push(spot);
      formLog.push({ S, sizes: trio.map((p) => p.baseS), z: trio.map((p) => p.z) });
      if (formLog.length > 50) formLog.shift();
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
        const cap = p.type === "white" ? CFG.formGlowCap.white : CFG.formGlowCap.orange;
        tl.to(p, {
          x: fx + (c[0] - LOGO_C[0]) * S,
          y: fy + par * dF + (c[1] - LOGO_C[1]) * S,
          r: Math.round(p.r / 360) * 360,
          s: S,
          d: dF,
          o: Math.min(p.baseO * CFG.formGlow, cap),   // uzak F yine soluk kalır
          duration: CFG.formIn,
          ease: "power3.inOut",
        }, 0);
      });

      // Dağılma: F'nin merkezinden dışarı; her parça kendi derinliğine döner
      tl.add(() => {
        trio.forEach((p) => {
          p.restUntil = performance.now() / 1000 + CFG.formOut + CFG.rest;
          const ang = Math.atan2(screenY(p) - fy, p.x - fx) + rand(-0.5, 0.5);
          const push = rand(40, 110) * lerp(0.5, 1, p.z);
          randomVelocity(p, 1.2);
          gsap.to(p, {
            x: p.x + Math.cos(ang) * push,
            y: p.y + Math.sin(ang) * push,
            r: p.r + rand(-90, 90),
            s: p.baseS,
            o: p.baseO,
            d: p.baseD,
            duration: CFG.formOut,
            ease: "power2.out",
          });
        });
      }, CFG.formIn + CFG.hold);
      tl.to({}, { duration: CFG.formOut }, CFG.formIn + CFG.hold);
      return true;
    }

    /* ---------- Döngü ---------- */
    let visible = true;
    function tick(_, deltaMs) {
      if (!visible) return;   // hero ekranda değilse çalışma
      const dt = Math.min(deltaMs, 100) / 1000; // sekme dönüşünde büyük sıçrama olmasın
      par = window.scrollY * CFG.parallax;
      step(dt);
      if ((CFG.formOnMobile || !mobile) && forming < (mobile ? 1 : CFG.maxForming)) {
        nextForm -= dt;
        if (nextForm <= 0) {
          nextForm = form() ? rand(CFG.formEvery[0], CFG.formEvery[1]) : 0.25;
        }
      }
      render();
    }

    build();
    render();

    // Hata ayıklama için durum (konsoldan: FS.worlds.state())
    if (window.FS) {
      window.FS.worlds = { state: () => ({ W, H, avoid, forming, nextForm, visible, n: parts.length, spots: spots.map((s) => s.map(Math.round)), formLog, diag }) };
    }

    if (reduce) return; // sabit dursun

    // Açılışla birlikte belirsin (giriş, parçaların opaklığına çarpan
    // olarak uygulanır)
    gsap.to(look, { fade: 1, duration: 2, delay: 0.3, ease: "power2.out" });

    // Hero görünmüyorsa çalışma
    const hero = stage.closest(".hero");
    ScrollTrigger.create({
      trigger: hero,
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
