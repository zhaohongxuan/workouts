export interface Checkin {
  date: string              // YYYY-MM-DD
  pushups: boolean
  pushupsCount?: number     // reps
  pushupsAt?: string        // ISO timestamp e.g. "2026-05-18T06:30:00"
  squats: boolean
  squatsCount?: number      // reps
  squatsAt?: string
  coldShower: boolean
  coldShowerAt?: string
}

export interface CheckinData {
  checkins: Checkin[]
}

export type CheckinItem = 'pushups' | 'squats' | 'coldShower'

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}

export interface CheckinDefaults {
  pushupsCount: number
  squatsCount: number
}
