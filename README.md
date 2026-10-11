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

## Animasyon yardımcıları

HTML'de JS yazmadan animasyon eklemek için:

| Özellik | Etki |
|---|---|
| `data-reveal` | Aşağıdan yumuşak belirme |
| `data-reveal="words"` | Kelime kelime yukarı kayma |
| `data-reveal="chars"` | Harf harf yukarı kayma |
| `data-reveal="slash"` | Açılı maskeyle soldan açılma |
| `data-delay="0.2"` | Gecikme (saniye) |
| `data-speed="1.2"` | Parallax hızı (negatif = ters yön) |

Kullanıcının cihazında "hareketi azalt" ayarı açıksa tüm animasyonlar kapanır.

## Yol haritası

- [x] Ana sayfa
- [ ] Projeler sayfası
- [ ] Proje detay sayfası
- [ ] Hakkında
- [ ] İletişim
