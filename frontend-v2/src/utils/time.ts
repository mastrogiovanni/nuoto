const ITALIAN_MONTHS: Record<string, string> = {
  Gennaio: '01', Febbraio: '02', Marzo: '03', Aprile: '04',
  Maggio: '05', Giugno: '06', Luglio: '07', Agosto: '08',
  Settembre: '09', Ottobre: '10', Novembre: '11', Dicembre: '12',
}

export function parseDate(dateStr: string): string {
  if (!dateStr) return ''
  const itMatch = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (itMatch) {
    const month = ITALIAN_MONTHS[itMatch[2]] ?? '01'
    return `${itMatch[3]}-${month}-${itMatch[1].padStart(2, '0')}`
  }
  const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`
  }
  return dateStr
}

export function normalizeTime(t: string): string {
  return t ? t.replace("'", ':') : ''
}

export function parseEvent(eventStr: string): { distance: number; style: string } {
  const m = eventStr?.match(/^(\d+)m\s+(.+)$/)
  if (m) return { distance: parseInt(m[1]), style: m[2] }
  return { distance: 0, style: eventStr ?? '' }
}

export function timeToSeconds(t: string): number {
  if (!t) return Infinity
  if (t.includes(':')) {
    const [min, sec] = t.split(':')
    const result = parseInt(min) * 60 + parseFloat(sec)
    return isNaN(result) ? Infinity : result
  }
  const result = parseFloat(t)
  return isNaN(result) ? Infinity : result
}

export function secondsToTimeString(secs: number): string {
  if (!isFinite(secs)) return '—'
  const min = Math.floor(secs / 60)
  const sec = (secs % 60).toFixed(2)
  if (min === 0) return sec
  return `${min}:${sec.padStart(5, '0')}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export function formatAthleteNameFull(upperName: string): string {
  return titleCase(upperName)
}

export function getFirstName(upperName: string): string {
  const parts = upperName.trim().split(/\s+/)
  const first = parts.slice(0, -1)
  return first.length > 0 ? titleCase(first.join(' ')) : titleCase(parts[0])
}

export function getLastName(upperName: string): string {
  const parts = upperName.trim().split(/\s+/)
  return titleCase(parts[parts.length - 1])
}

export function getInitials(upperName: string): string {
  const parts = upperName.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(0, -1)[0]
  return ((firstName?.[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '?'
}
