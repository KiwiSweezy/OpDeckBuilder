/**
 * Cross-browser clipboard write with Safari/older-browser fallback.
 *
 * Safari rejects async navigator.clipboard.writeText calls when they're
 * not synchronous to the user-event handler. We try the modern API first
 * (fire-and-forget) and always also run a textarea + execCommand('copy')
 * fallback that works across every browser.
 */
export function copyToClipboard(text: string): boolean {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => { /* fall through to fallback */ })
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
