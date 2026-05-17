import { useState, useMemo } from 'react'
import { Dumbbell, Droplets } from 'lucide-react'
import type { Checkin } from '../types/checkin'
import { useLocale } from '../hooks/useLocale'

const MONTH_LABELS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const MONTH_LABELS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS_ZH = ['一','二','三','四','五','六','日']
const DAY_LABELS_EN = ['M','T','W','T','F','S','S']

interface HeatmapTrack {
  key: 'pushups' | 'squats' | 'coldShower'
  zh: string
  en: string
  colors: [string, string, string, string]  // level 1–4
  emptyColor: { light: string; dark: string }
}

const TRACKS: HeatmapTrack[] = [
  {
    key: 'pushups',
    zh: '俯卧撑', en: 'Pushups',
    colors: ['#fed7aa','#fb923c','#f97316','#c2410c'],
    emptyColor: { light: '#fff7ed', dark: '#1c1008' },
  },
  {
    key: 'squats',
    zh: '深蹲', en: 'Squats',
    colors: ['#bfdbfe','#60a5fa','#3b82f6','#1d4ed8'],
    emptyColor: { light: '#eff6ff', dark: '#080f1c' },
  },
  {
    key: 'coldShower',
    zh: '冷水澡', en: 'Cold Shower',
    colors: ['#a5f3fc','#22d3ee','#06b6d4','#0e7490'],
    emptyColor: { light: '#ecfeff', dark: '#021014' },
  },
]

function TrackIcon({ trackKey, className }: { trackKey: HeatmapTrack['key']; className?: string }) {
  if (trackKey === 'pushups') return <Dumbbell className={className} />
  if (trackKey === 'squats') return <Dumbbell className={className} style={{ transform: 'rotate(90deg)' }} />
  return <Droplets className={className} />
}

type GridCell = { date: string; value: number } | null

interface YearGridResult {
  grid: GridCell[][]
  monthPositions: { month: number; weekIndex: number }[]
  totalDays: number
  totalReps: number
}

function buildGrid(year: number, checkins: Checkin[], track: HeatmapTrack): YearGridResult {
  const jan1 = new Date(year, 0, 1)
  const startDow = (jan1.getDay() + 6) % 7
  const daysInYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365

  const valueMap = new Map<string, number>()
  let totalDays = 0, totalReps = 0

  for (const c of checkins) {
    if (new Date(c.date).getFullYear() !== year) continue
    if (!c[track.key]) continue
    totalDays++
    let val = 1
    if (track.key === 'pushups' && c.pushupsCount) { val = c.pushupsCount; totalReps += val }
    else if (track.key === 'squats' && c.squatsCount) { val = c.squatsCount; totalReps += val }
    valueMap.set(c.date, val)
  }

  // max for scaling
  let maxVal = 0
  valueMap.forEach((v) => { if (v > maxVal) maxVal = v })

  const numWeeks = Math.ceil((startDow + daysInYear) / 7)
  const grid: GridCell[][] = []

  for (let w = 0; w < numWeeks; w++) {
    const week: GridCell[] = []
    for (let d = 0; d < 7; d++) {
      const dayIndex = w * 7 + d - startDow
      if (dayIndex < 0 || dayIndex >= daysInYear) { week.push(null); continue }
      const date = new Date(year, 0, dayIndex + 1).toLocaleDateString('sv-SE')
      const v = valueMap.get(date) ?? 0
      week.push({ date, value: v })
    }
    grid.push(week)
  }

  // month positions
  const monthPositions: { month: number; weekIndex: number }[] = []
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1)
    const dayIndex = Math.floor((firstDay.getTime() - jan1.getTime()) / 86400000)
    const weekIndex = Math.floor((startDow + dayIndex) / 7)
    monthPositions.push({ month: m, weekIndex })
  }

  return { grid, monthPositions, totalDays, totalReps }
}

function getColor(value: number, maxVal: number, track: HeatmapTrack, dark: boolean): string {
  if (value === 0) return dark ? track.emptyColor.dark : track.emptyColor.light
  if (maxVal === 0) return track.colors[0]
  const ratio = value / maxVal
  const level = ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 0.75 ? 2 : 3
  return track.colors[level]
}

// ── Single track heatmap ──────────────────────────────────────────────────────

function TrackHeatmap({
  track,
  checkins,
  selectedYear,
  allYears,
  onYearChange,
  dark,
}: {
  track: HeatmapTrack
  checkins: Checkin[]
  selectedYear: number
  allYears: number[]
  onYearChange: (y: number) => void
  dark: boolean
}) {
  const { locale } = useLocale()
  const monthLabels = locale === 'zh' ? MONTH_LABELS_ZH : MONTH_LABELS_EN
  const dayLabels = locale === 'zh' ? DAY_LABELS_ZH : DAY_LABELS_EN

  const { grid, monthPositions, totalDays, totalReps } = useMemo(
    () => buildGrid(selectedYear, checkins, track),
    [selectedYear, checkins, track]
  )

  // compute max for this year/track
  const maxVal = useMemo(() => {
    let m = 0
    for (const c of checkins) {
      if (new Date(c.date).getFullYear() !== selectedYear) continue
      if (!c[track.key]) continue
      let v = 1
      if (track.key === 'pushups' && c.pushupsCount) v = c.pushupsCount
      if (track.key === 'squats' && c.squatsCount) v = c.squatsCount
      if (v > m) m = v
    }
    return m
  }, [selectedYear, checkins, track])

  const [tooltip, setTooltip] = useState<{ date: string; value: number; x: number; y: number } | null>(null)

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: track.colors[2] }}>
            <TrackIcon trackKey={track.key} className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {locale === 'zh' ? track.zh : track.en}
            </span>
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              {totalDays} {locale === 'zh' ? '天' : 'd'}
              {(track.key === 'pushups' || track.key === 'squats') && totalReps > 0 && (
                <> · {totalReps} {locale === 'zh' ? '个' : 'reps'}</>
              )}
            </span>
          </div>
        </div>
        {/* Year tabs */}
        <div className="flex items-center gap-1">
          {allYears.map((y) => (
            <button
              key={y}
              onClick={() => onYearChange(y)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                y === selectedYear
                  ? 'text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
              style={y === selectedYear ? { backgroundColor: track.colors[2] } : {}}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1 min-w-max">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] pt-5">
            {dayLabels.map((d, i) => (
              <div key={i} className={`w-3 h-3 flex items-center justify-center text-[8px] text-[var(--color-muted)] ${i % 2 === 0 ? 'opacity-0' : ''}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="relative">
            {/* Month labels */}
            <div className="relative h-5 mb-1">
              {monthPositions.map(({ month, weekIndex }) => (
                <span key={month} className="absolute text-[10px] text-[var(--color-muted)]"
                  style={{ left: weekIndex * 15 }}>
                  {monthLabels[month]}
                </span>
              ))}
            </div>
            {/* Cells */}
            <div className="flex gap-[3px]" onMouseLeave={() => setTooltip(null)}>
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className="w-3 h-3 rounded-sm cursor-default transition-opacity"
                      style={{
                        backgroundColor: day ? getColor(day.value, maxVal, track, dark) : 'transparent',
                        opacity: day === null ? 0 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!day) return
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({ date: day.date, value: day.value, x: rect.left, y: rect.top })
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 pointer-events-none bg-[var(--color-text)] text-[var(--color-bg)] text-xs px-2 py-1 rounded shadow"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}>
          {tooltip.date}
          {tooltip.value > 0
            ? `: ${tooltip.value}${(track.key !== 'coldShower') ? (locale === 'zh' ? ' 个' : ' reps') : ''}`
            : `: ${locale === 'zh' ? '未打卡' : 'no log'}`}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-[10px] text-[var(--color-muted)]">{locale === 'zh' ? '少' : 'Less'}</span>
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: dark ? track.emptyColor.dark : track.emptyColor.light, border: `1px solid ${track.colors[0]}33` }} />
        {track.colors.map((c) => (
          <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span className="text-[10px] text-[var(--color-muted)]">{locale === 'zh' ? '多' : 'More'}</span>
      </div>
    </div>
  )
}

// ── Exported component ────────────────────────────────────────────────────────

export function CheckinHeatmap({ checkins }: { checkins: Checkin[] }) {
  const dark = document.documentElement.classList.contains('dark')

  const allYears = useMemo(() => {
    const s = new Set<number>()
    for (const c of checkins) s.add(new Date(c.date).getFullYear())
    s.add(new Date().getFullYear())
    return [...s].sort((a, b) => b - a)
  }, [checkins])

  const currentYear = new Date().getFullYear()
  const [years, setYears] = useState<Record<string, number>>({
    pushups: currentYear,
    squats: currentYear,
    coldShower: currentYear,
  })

  return (
    <div className="space-y-4">
      {TRACKS.map((track) => (
        <TrackHeatmap
          key={track.key}
          track={track}
          checkins={checkins}
          selectedYear={years[track.key] ?? currentYear}
          allYears={allYears}
          onYearChange={(y) => setYears((prev) => ({ ...prev, [track.key]: y }))}
          dark={dark}
        />
      ))}
    </div>
  )
}
