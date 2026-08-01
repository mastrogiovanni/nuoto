/**
 * Format a backend time string into double-prime notation.
 * "1:02.34" → "1'02''34"
 * "32.79"   → "32''79"
 */
export function formatTime(t) {
  if (!t) return '—'
  let min = null, sec, cs = '00'
  if (t.includes(':')) {
    const colonIdx = t.indexOf(':')
    min = t.slice(0, colonIdx)
    const rest = t.slice(colonIdx + 1)
    const dotIdx = rest.indexOf('.')
    if (dotIdx >= 0) {
      sec = rest.slice(0, dotIdx)
      cs = rest.slice(dotIdx + 1).padEnd(2, '0').slice(0, 2)
    } else {
      sec = rest
    }
  } else {
    const dotIdx = t.indexOf('.')
    if (dotIdx >= 0) {
      sec = t.slice(0, dotIdx)
      cs = t.slice(dotIdx + 1).padEnd(2, '0').slice(0, 2)
    } else {
      sec = t
    }
  }
  sec = sec.padStart(2, '0')
  if (min !== null) return `${min}'${sec}''${cs}`
  return `${parseInt(sec, 10)}''${cs}`
}
