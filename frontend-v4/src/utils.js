const ITALIAN_MONTHS = {
  'Gennaio': '01', 'Febbraio': '02', 'Marzo': '03', 'Aprile': '04',
  'Maggio': '05', 'Giugno': '06', 'Luglio': '07', 'Agosto': '08',
  'Settembre': '09', 'Ottobre': '10', 'Novembre': '11', 'Dicembre': '12',
}

export function parseDate(dateStr) {
  if (!dateStr) return ''
  const itMatch = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (itMatch) {
    const month = ITALIAN_MONTHS[itMatch[2]] ?? '01'
    return `${itMatch[3]}-${month}-${itMatch[1].padStart(2, '0')}`
  }
  const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`
  return dateStr
}

export function formatDateLocal(isoDate) {
  if (!isoDate) return ''
  try {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('it-IT', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

export function normalizeTime(t) {
  return t ? t.replace("'", ':') : ''
}

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

export function parseTimeToSeconds(t) {
  if (!t) return Infinity
  let secs
  if (t.includes(':')) {
    const [m, s] = t.split(':')
    secs = parseInt(m) * 60 + parseFloat(s)
  } else {
    secs = parseFloat(t)
  }
  return isNaN(secs) ? Infinity : secs
}

export function parseEvent(eventStr) {
  const m = eventStr?.match(/^(\d+)m\s+(.+)$/)
  if (m) return { distance: parseInt(m[1]), style: m[2] }
  return { distance: 0, style: eventStr ?? '' }
}

export function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export function toSwimmer(athlete) {
  const parts = athlete.name.trim().split(/\s+/)
  const lastName = parts[parts.length - 1]
  const firstNames = parts.slice(0, -1)
  const initials = (
    (firstNames[0]?.[0] ?? '') + (lastName[0] ?? '')
  ).toUpperCase()
  return {
    key: athlete.key,
    name: titleCase(athlete.name),
    displayName: `${titleCase(firstNames.join(' '))} ${titleCase(lastName)}`.trim(),
    firstName: firstNames.length > 0 ? titleCase(firstNames.join(' ')) : titleCase(lastName),
    lastName: titleCase(lastName),
    club: athlete.society,
    birthYear: athlete.year_of_birth,
    sex: athlete.sex,
    initials: initials || '?',
  }
}

export function toResults(stats) {
  const results = []
  let id = 0
  for (const record of stats.records ?? []) {
    const date = parseDate(record.date)
    for (const result of record.results ?? []) {
      const { distance, style } = parseEvent(result.event)
      results.push({
        id: id++,
        date,
        competition: record.competition,
        eventDir: record.event_dir,
        year: record.year,
        style,
        distance,
        time: normalizeTime(result.time),
        position: result.position,
        category: result.category,
        splits: (result.splits ?? []).map(s => ({
          metres: s.metres,
          time: normalizeTime(s.time),
        })),
      })
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date))
  return results
}

export function getBestTimes(results) {
  const best = {}
  results.forEach(r => {
    if (!r.time) return
    const key = `${r.style}||${r.distance}`
    if (!best[key] || parseTimeToSeconds(r.time) < parseTimeToSeconds(best[key].time)) {
      best[key] = r
    }
  })
  return Object.values(best).sort(
    (a, b) => a.style.localeCompare(b.style) || a.distance - b.distance,
  )
}

export function rankLabel(i) {
  if (i === 0) return 'rank-badge--gold'
  if (i === 1) return 'rank-badge--silver'
  if (i === 2) return 'rank-badge--bronze'
  return ''
}
