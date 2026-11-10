# izlix-source (hassas mod)

Izlix varsayılan olarak bileşen konumunu component stack + source map ile çözer (kurulum gerektirmez; satır doğruluğu yüksek ama her zaman kesin değil). Bu isteğe bağlı dönüşüm, **geliştirme derlemesinde** her üst düzey bileşenin tanım yerini bileşene `__izlix_src` olarak ekler; click-to-source bu bilgiyi önceliklendirir.

- Vite: `import izlixSource from '<yol>/vite.mjs'` → `plugins: [izlixSource(), react()]` (yalnızca `vite dev`)
- Next.js / webpack: `webpack-loader.cjs` (dosya başındaki yoruma bak)

Kod dosyanın sonuna eklenir; mevcut satırlar kaymaz. Production derlemesine eklemeyin.
