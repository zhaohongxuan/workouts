/**
 * App configuration — edit this file to customize your workout dashboard.
 */

import type { Locale } from './i18n'

// ─── Appearance ──────────────────────────────────────────────────────────────

/** Default UI language. 'zh' | 'en' */
export const DEFAULT_LOCALE: Locale = 'zh'

/** Default color theme. 'light' | 'dark' | 'system' */
export const DEFAULT_THEME: 'light' | 'dark' | 'system' = 'system'

// ─── Goals ───────────────────────────────────────────────────────────────────

/**
 * Distance goals are in **km**.
 * Time goals (Gym filter) are in **minutes**.
 */
export interface GoalConfig {
  yearly: number
  monthly: number
  weekly: number
  /** 'distance' (km) | 'time' (minutes) */
  unit: 'distance' | 'time'
}

export const GOALS: Record<string, GoalConfig> = {
  /** Shown when "全部 / All" filter is active */
  all: {
    yearly: 2000,
    monthly: 150,
    weekly: 35,
    unit: 'distance',
  },
  Run: {
    yearly: 1200,
    monthly: 100,
    weekly: 25,
    unit: 'distance',
  },
  Ride: {
    yearly: 3000,
    monthly: 250,
    weekly: 60,
    unit: 'distance',
  },
  Hike: {
    yearly: 300,
    monthly: 25,
    weekly: 6,
    unit: 'distance',
  },
  /** Gym goals are tracked by total workout time (minutes) */
  Gym: {
    yearly: 6000, // 100 h
    monthly: 600, // 10 h
    weekly: 150,  // 2.5 h
    unit: 'time',
  },
}

/** Fallback when a filter key is not found in GOALS */
export const DEFAULT_GOAL: GoalConfig = GOALS.all
