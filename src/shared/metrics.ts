// Bellek/DOM metrikleri icin saf yardimcilar.
export const metricMap = (list: { name: string; value: number }[] | undefined): Record<string, number> => Object.fromEntries((list ?? []).map((m) => [m.name, m.value]))

/**
 * Sizinti ipucu: en az `min` ornek, son/ilk >= 1.25 ve artislarin cogu monoton (azalis az).
 * Dalgalanan (artip azalan) seriler isaretlenmez.
 */
export function leakHint(series: number[], min = 20): boolean {
  if (series.length < min) return false
  const first = series[0], last = series[series.length - 1]
  if (first <= 0 || last / first < 1.25) return false
  let up = 0, down = 0
  for (let i = 1; i < series.length; i++) { if (series[i] > series[i - 1]) up++; else if (series[i] < series[i - 1]) down++ }
  return up >= 3 && down <= up * 0.2
}

export const mb = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} MB`
