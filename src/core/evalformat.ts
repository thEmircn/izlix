/** Runtime.evaluate sonucunu (RemoteObject / exceptionDetails) okunur bir metne cevirir. */
export interface EvalResult { ok: boolean; text: string; type?: string }

/** RemoteObject -> kisa okunur onizleme (console argumanlari ve REPL sonuclari icin) */
export function preview(o: any, depth = 0): string {
  if (!o) return 'undefined'
  switch (o.type) {
    case 'undefined': return 'undefined'
    case 'string': return JSON.stringify(o.value)
    case 'number': case 'boolean': return String(o.unserializableValue ?? o.value)
    case 'bigint': return String(o.unserializableValue ?? o.description)
    case 'symbol': case 'function': return String(o.description ?? o.type).split('\n')[0].slice(0, 120)
  }
  if (o.subtype === 'null') return 'null'
  if (o.subtype === 'error') return String(o.description ?? 'Error').split('\n')[0]
  const p = o.preview
  if (p && depth < 2) {
    const props: string[] = (p.properties ?? []).slice(0, 8).map((x: any) => `${p.subtype === 'array' ? '' : x.name + ': '}${x.type === 'string' ? JSON.stringify(x.value) : x.subtype === 'null' ? 'null' : (x.value ?? x.valuePreview?.description ?? x.type)}`)
    const more = p.overflow ? ', …' : ''
    return p.subtype === 'array' ? `${o.description} [${props.join(', ')}${more}]` : `${o.description ?? o.className ?? 'Object'} {${props.join(', ')}${more}}`
  }
  return String(o.description ?? o.className ?? o.type)
}

export function formatEval(r: any): EvalResult {
  if (r?.exceptionDetails) {
    const ex = r.exceptionDetails
    return { ok: false, text: String(ex.exception?.description ?? ex.text ?? 'Error').split('\n').slice(0, 4).join('\n') }
  }
  return { ok: true, text: preview(r?.result), type: r?.result?.subtype ?? r?.result?.type }
}
