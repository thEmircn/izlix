import type { SourceLookup } from '../../../src/core/correlate'
import type { Resolver } from '../../../src/core/collector'

/** Eklenti surumunde kaynak cozumleme (click-to-source) sonraki adimda: simdilik bos cozumleyici */
export function emptyResolver(): Resolver & SourceLookup {
  return {
    rootProvider: null,
    components: new Map(),
    settled: () => Promise.resolve(),
    resolveType: () => Promise.resolve(null),
    setPrecise: () => null,
    firstAppFrame: () => Promise.resolve(null),
    componentAt: () => null
  }
}
