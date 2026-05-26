// ─── Backend API shapes ────────────────────────────────────────────────────────

export interface BackendAthleteInfo {
  key: string
  name: string
  year_of_birth: number
  sex: string
  society: string
}

export interface BackendSplit {
  metres: number
  time: string
}

export interface BackendResult {
  event: string
  time: string
  position: number
  category: string
  splits?: BackendSplit[]
}

export interface BackendStatRecord {
  competition: string
  date: string
  year: string
  results: BackendResult[]
}

export interface BackendAthleteStats extends BackendAthleteInfo {
  records: BackendStatRecord[]
}

export interface BackendEventInfo {
  name: string
}

export interface BackendNationalRecordEntry {
  specialita: string
  atleta: string
  tempo: string
  data: string
  luogo: string
  sezione: string
  componenti?: string
}

export interface BackendNationalRecordsPage {
  records: BackendNationalRecordEntry[]
}

export interface BackendNationalRecordsIndexEntry {
  vasca: string
  championship: string
  gender: string
}

// ─── App domain types ──────────────────────────────────────────────────────────

export type Gender = 'M' | 'F'

export interface Swimmer {
  id: string
  fullName: string
  firstName: string
  lastName: string
  initials: string
  club: string
  birthYear: number
  sex: Gender
  category: string
}

export interface Split {
  metres: number
  time: string
}

export interface RaceResult {
  id: string
  competitionName: string
  date: string
  year: string
  style: string
  distance: number
  time: string
  timeSeconds: number
  position: number
  category: string
  splits: Split[]
}

export interface PersonalBest {
  style: string
  distance: number
  time: string
  timeSeconds: number
  date: string
  competitionName: string
  category: string
}

export interface Competition {
  key: string
  name: string
  date: string
  year: string
  results: RaceResult[]
}

export interface NationalRecord {
  specialita: string
  athlete: string
  time: string
  date: string
  location: string
  section: string
  components?: string
}

export interface NationalRecordsIndexEntry {
  vasca: string
  championship: string
  gender: string
}

export interface EventInfo {
  name: string
}

// ─── Session types ─────────────────────────────────────────────────────────────

export interface UserProfile {
  fullName: string
  email: string
  registrationNumber: string
}

export interface Session {
  user: UserProfile
  athlete: Swimmer
}

// ─── Qualification types ───────────────────────────────────────────────────────

export interface QualificationResult {
  event: string
  style: string
  distance: number
  yourTime: string
  yourTimeSeconds: number
  limitTime: string
  limitSeconds: number
  qualified: boolean
}
