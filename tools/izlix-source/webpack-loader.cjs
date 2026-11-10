// Next.js / webpack / Turbopack loader (yalnizca gelistirme). next.config.js:
//   webpack: (config, { dev }) => { if (dev) config.module.rules.push({ test: /\.[jt]sx?$/, exclude: /node_modules/, enforce: 'pre', use: [{ loader: require.resolve('<yol>/webpack-loader.cjs') }] }); return config }
//   turbopack: { rules: { '*.{js,jsx,ts,tsx}': { loaders: [require.resolve('<yol>/webpack-loader.cjs')] } } }
module.exports = function izlixSourceLoader(source, map) {
  const cb = this.async()
  import('./transform.mjs').then(({ annotate }) => {
    const r = annotate(String(source), this.resourcePath)
    cb(null, r ? r.code : source, r ? r.map : map)
  }).catch(() => cb(null, source, map))
}
