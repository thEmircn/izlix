# Izlix (geçici ad)

React geliştiricisinin ikincil tarayıcısı: bir hatanın sebebini **tıklamadan render'a kadar tek zaman çizelgesinde** gör, kaynağını tek tıkla editöründe aç, backend'e dokunmadan istekleri değiştir. Ürün planı: `docs/PLAN.md`; durum ve ölçümler: `../docs/mvp-durum.md`.

## Çalıştırma

```bash
npm install
npm run dev          # geliştirme (electron-vite)
npm test             # birim testleri (vitest)
npm run typecheck
npm run pack         # imzasız .app (dist/), Electron fuse'ları uygulanır
npm run e2e          # uçtan uca regresyon paketi (17 betik, geçti/kaldı); önkoşul: localhost:5173'te test uygulaması
```

> Ortamında `ELECTRON_RUN_AS_NODE` tanımlıysa Electron Node gibi çalışır; script'ler bunu `env -u` ile temizler.

## Özellikler (MVP)

Sekmeler/Workspace (oturum izolasyonu, dev sunucusu algılama) · gömülü Chrome DevTools · Unified Timeline (kesin/tahmini nedensellik okları) · React Inspector + Render Tracker · click-to-source · Responsive Lab (4 senkron viewport) · Request Rules (mock/gecikme/durum/yönlendirme/header) · Command Palette (⌘K) · Bug Report (zip, maskeli) · `izlix open .` CLI · Chrome yardımcı eklentisi (`extension/`).

## Mimari (kısa)

- `src/main`: pencere/sekme (`tabs.ts`), CDP toplayıcı (`cdp.ts`), React köprüsü (`react-bridge.ts`), olay veriyolu (`bus.ts`), korelatör (`correlate.ts`), kaynak çözümleme (`sources.ts`), Request Rules (`interceptor.ts`), Lab (`lab.ts`).
- `src/renderer`: shell arayüzü (React + Zustand). Sayfa görünümleriyle **hiç** doğrudan konuşmaz; her şey IPC (izin listesi + zod).
- `src/shared`: saf mantık (kural motoru, yerleşim, fuzzy, i18n, maskeleme) — birim testli.
- `tests/e2e/*.cjs`: gerçek Electron ile uçtan uca senaryolar (`tests/e2e/run.sh <betik>`).

## Test uygulamaları

e2e testleri `localhost:5173`'te bir Vite + React uygulaması bekler (`../spike/testapps/vite-react19`: `npx vite`). Demo uygulaması paketle gelir (`samples/`, `npm run build:demo`).
