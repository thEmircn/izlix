# Open in Izlix (Chrome eklentisi)

Chrome'da açık sayfayı Izlix'da açar.

**Kurulum (geliştirici modu):** `chrome://extensions` → *Developer mode* → *Load unpacked* → bu klasörü seç.
**Kullanım:** araç çubuğundaki düğme veya sağ tık → "Izlix'da aç". Uygulama `izlix://open?url=…` bağlantısını işler (yalnızca http/https).

`izlix://` şeması paketlenmiş uygulama kurulunca macOS'a kaydolur (`npm run pack`/DMG). Geliştirme modunda şema kaydı yapılmaz; CLI kullan: `izlix open .`
