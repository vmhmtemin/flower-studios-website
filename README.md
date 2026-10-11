# Flower Studios — Website

Flower Studios'un resmi web sitesi. Oyunlar ve uygulamalar geliştiren bağımsız stüdyo.

Saf **HTML / CSS / JavaScript**. Kaydırma animasyonları için [GSAP](https://gsap.com) + ScrollTrigger, yumuşak kaydırma için [Lenis](https://lenis.darkroom.engineering) (ikisi de CDN'den yüklenir, kurulum gerekmez).

## Dosya yapısı

```
index.html            Ana sayfa
css/base.css          Ortak stiller: renkler, fontlar, nav, butonlar, footer
css/pages.css         Sayfa bölümleri (hero, projeler, marquee, CTA...)
js/main.js            Ortak davranışlar: Lenis, nav, ilerleme çubuğu, [data-reveal]
js/parallax.js        Ana sayfa parallax ve scroll animasyonları
assets/logo/          Logo (SVG)
```

## Yerelde çalıştırma

Dosyayı doğrudan açmak yeterli, ama en doğru sonuç için basit bir sunucu kullan:

```bash
python3 -m http.server 8000
# sonra tarayıcıda http://localhost:8000
```

## Hareket sistemi

- **F'nin birleşmesi** sayfanın tek büyük anı. Hero, ekran yüksekliğinden biraz uzun (`--run`);
  bu aralıkta `position: sticky` ile sahne sabit kalır ve parçalar doğrudan kaydırma
  ilerlemesine göre birleşir (JS pin yok, geri kaydırınca geri ayrılır).
  Dağınık konumlar SVG'nin kendi koordinatlarında tanımlı (`js/parallax.js` → `SCATTER`),
  birleşik hâl her zaman tam `0,0,0`. Kapanış bölümünde dev F aynı şekilde tekrar birleşir.
- **Marquee**: iki özdeş grup, `-50%` ile dikişsiz döngü; kaydırma hızı akışı geçici hızlandırır.
- **Hareketi azalt** açıksa: F birleşik, sticky aralık yok, döngüler durur.

## HTML yardımcıları

| Özellik | Etki |
|---|---|
| `data-reveal="words"` | Başlığın kelime kelime girişi |
| `data-fit` + `.fit-inner` | Yazıyı kapsayıcının genişliğine tam oturtur |
| `data-depth="0.4"` | Proje sahnesi katmanının derinliği |
| `data-marquee="1"` / `"-1"` | Marquee yönü |

## Yayın

GitHub Pages dosyaları 10 dk önbelleğe alır. CSS/JS değiştiğinde `index.html` içindeki
`?v=` numarasını artır; yoksa yeni HTML eski CSS ile açılabilir.

## Yol haritası

- [x] Ana sayfa
- [ ] Projeler sayfası
- [ ] Proje detay sayfası
- [ ] Hakkında
- [ ] İletişim
