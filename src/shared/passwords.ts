// Sifre yoneticisi: sayfa tarafi betikler (saf dizgeler) ve yardimcilar.
export const PW_BINDING = '__dbPw'

/** Belge basinda enjekte edilir: giris formunu yakalar (kaydet teklifi) ve kullanici alana odaklaninca doldurma ister. Sifreyi YALNIZCA kullanicinin yazdigi alandan okur. */
export const PW_SCRIPT = `(() => {
  if (window.__dbPwInit) return
  window.__dbPwInit = true
  const send = (o) => { try { if (window.${PW_BINDING}) window.${PW_BINDING}(JSON.stringify(o)) } catch (e) {} }
  const isPw = (el) => !!el && el.tagName === 'INPUT' && el.type === 'password'
  const userField = (pw) => {
    const scope = pw.form || document, ins = [...scope.querySelectorAll('input')], i = ins.indexOf(pw)
    for (let k = i - 1; k >= 0; k--) { const t = (ins[k].type || 'text').toLowerCase(); if ((t === 'text' || t === 'email' || t === 'tel') && ins[k].offsetParent !== null) return ins[k] }
    return null
  }
  const capture = (pw) => { if (pw && pw.value) { const u = userField(pw); send({ t: 'save', u: u ? u.value : '', p: pw.value }) } }
  document.addEventListener('submit', (e) => { const f = e.target; const pw = f && f.querySelector ? f.querySelector('input[type=password]') : null; if (pw) capture(pw) }, true)
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && isPw(e.target)) capture(e.target) }, true)
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button,[type=submit],input[type=submit]') : null; if (!b) return
    const f = b.form || b.closest('form'), pw = (f || document).querySelector('input[type=password]'); if (pw && pw.value) capture(pw)
  }, true)
  document.addEventListener('focusin', (e) => {
    if (!e.isTrusted) return
    const el = e.target
    if (isPw(el) || (el && el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'email') && el.form && el.form.querySelector('input[type=password]'))) send({ t: 'fill' })
  }, true)
})()`

/** Ana belgedeki gorunur sifre alanina (ve oncesindeki kullanici adi alanina) deger yazar; yazildiysa true */
export const fillScript = (user: string, pass: string): string => `(() => {
  const pw = [...document.querySelectorAll('input[type=password]')].find((el) => el.offsetParent !== null && !el.disabled && !el.readOnly)
  if (!pw) return false
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const scope = pw.form || document, ins = [...scope.querySelectorAll('input')], i = ins.indexOf(pw)
  let uf = null
  for (let k = i - 1; k >= 0; k--) { const t = (ins[k].type || 'text').toLowerCase(); if ((t === 'text' || t === 'email' || t === 'tel') && ins[k].offsetParent !== null) { uf = ins[k]; break } }
  if (uf && ${JSON.stringify(user)}) set(uf, ${JSON.stringify(user)})
  set(pw, ${JSON.stringify(pass)})
  return true
})()`

export interface LoginMeta { origin: string; username: string; ts: number }
