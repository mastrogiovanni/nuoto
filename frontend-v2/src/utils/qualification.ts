import type { Gender, PersonalBest, QualificationResult } from '../types'
import { secondsToTimeString } from './time'

export type SwimCategory = 'Assoluti' | 'Cadetti' | 'Juniores' | 'Ragazzi' | 'Esordienti A' | 'Esordienti B'

export function getCategory(birthYear: number): SwimCategory {
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  if (age >= 18) return 'Assoluti'
  if (age >= 16) return 'Cadetti'
  if (age >= 14) return 'Juniores'
  if (age >= 12) return 'Ragazzi'
  if (age >= 10) return 'Esordienti A'
  return 'Esordienti B'
}

// Approximate FIN qualifying times (seconds) for Italian national championships.
// Organised as: category → "distance style" → { M, F }
const QUALIFICATION_TIMES: Partial<Record<SwimCategory, Record<string, Record<Gender, number>>>> = {
  Assoluti: {
    '50 Stile Libero':   { M: 25.5,  F: 28.8  },
    '100 Stile Libero':  { M: 55.0,  F: 62.0  },
    '200 Stile Libero':  { M: 120.0, F: 135.0 },
    '400 Stile Libero':  { M: 255.0, F: 285.0 },
    '800 Stile Libero':  { M: 530.0, F: 595.0 },
    '1500 Stile Libero': { M: 1020.0,F: 1145.0 },
    '50 Dorso':          { M: 28.8,  F: 32.5  },
    '100 Dorso':         { M: 61.5,  F: 70.0  },
    '200 Dorso':         { M: 134.0, F: 151.0 },
    '50 Rana':           { M: 31.5,  F: 36.0  },
    '100 Rana':          { M: 68.5,  F: 78.5  },
    '200 Rana':          { M: 149.0, F: 170.0 },
    '50 Delfino':        { M: 27.5,  F: 31.0  },
    '100 Delfino':       { M: 59.5,  F: 67.0  },
    '200 Delfino':       { M: 130.0, F: 147.0 },
    '200 Misto':         { M: 128.0, F: 144.0 },
    '400 Misto':         { M: 270.0, F: 302.0 },
  },
  Cadetti: {
    '50 Stile Libero':   { M: 27.5,  F: 30.5  },
    '100 Stile Libero':  { M: 60.0,  F: 67.0  },
    '200 Stile Libero':  { M: 130.0, F: 145.0 },
    '400 Stile Libero':  { M: 272.0, F: 305.0 },
    '800 Stile Libero':  { M: 565.0, F: 634.0 },
    '1500 Stile Libero': { M: 1085.0,F: 1215.0 },
    '50 Dorso':          { M: 31.5,  F: 35.0  },
    '100 Dorso':         { M: 67.0,  F: 75.0  },
    '200 Dorso':         { M: 146.0, F: 163.0 },
    '50 Rana':           { M: 34.5,  F: 39.5  },
    '100 Rana':          { M: 75.0,  F: 85.0  },
    '200 Rana':          { M: 164.0, F: 185.0 },
    '50 Delfino':        { M: 30.0,  F: 34.0  },
    '100 Delfino':       { M: 65.0,  F: 73.0  },
    '200 Delfino':       { M: 142.0, F: 160.0 },
    '200 Misto':         { M: 141.0, F: 158.0 },
    '400 Misto':         { M: 295.0, F: 332.0 },
  },
  Juniores: {
    '50 Stile Libero':   { M: 29.0,  F: 32.5  },
    '100 Stile Libero':  { M: 63.0,  F: 71.0  },
    '200 Stile Libero':  { M: 137.0, F: 153.0 },
    '400 Stile Libero':  { M: 288.0, F: 323.0 },
    '50 Dorso':          { M: 33.5,  F: 37.5  },
    '100 Dorso':         { M: 71.0,  F: 80.0  },
    '200 Dorso':         { M: 155.0, F: 175.0 },
    '50 Rana':           { M: 36.5,  F: 42.0  },
    '100 Rana':          { M: 79.0,  F: 90.0  },
    '200 Rana':          { M: 172.0, F: 197.0 },
    '50 Delfino':        { M: 31.5,  F: 35.5  },
    '100 Delfino':       { M: 68.0,  F: 77.0  },
    '200 Delfino':       { M: 150.0, F: 169.0 },
    '200 Misto':         { M: 150.0, F: 169.0 },
    '400 Misto':         { M: 312.0, F: 353.0 },
  },
  Ragazzi: {
    '50 Stile Libero':   { M: 30.5,  F: 34.0  },
    '100 Stile Libero':  { M: 66.0,  F: 74.0  },
    '200 Stile Libero':  { M: 143.0, F: 160.0 },
    '50 Dorso':          { M: 36.0,  F: 40.0  },
    '100 Dorso':         { M: 77.0,  F: 86.0  },
    '50 Rana':           { M: 39.0,  F: 45.0  },
    '100 Rana':          { M: 83.0,  F: 95.0  },
    '50 Delfino':        { M: 33.0,  F: 37.5  },
    '100 Delfino':       { M: 73.0,  F: 82.0  },
    '200 Misto':         { M: 160.0, F: 180.0 },
  },
}

export function checkQualification(
  bests: PersonalBest[],
  category: SwimCategory,
  sex: Gender,
): QualificationResult[] {
  const catTimes = QUALIFICATION_TIMES[category] ?? QUALIFICATION_TIMES['Assoluti']!
  const results: QualificationResult[] = []

  for (const best of bests) {
    const eventKey = `${best.distance} ${best.style}`
    const limit = catTimes[eventKey]?.[sex]
    if (limit !== undefined) {
      results.push({
        event: eventKey,
        style: best.style,
        distance: best.distance,
        yourTime: best.time,
        yourTimeSeconds: best.timeSeconds,
        limitTime: secondsToTimeString(limit),
        limitSeconds: limit,
        qualified: best.timeSeconds <= limit,
      })
    }
  }

  return results
}

export function isQualifiedForNationals(
  bests: PersonalBest[],
  category: SwimCategory,
  sex: Gender,
): boolean {
  return checkQualification(bests, category, sex).some(r => r.qualified)
}
