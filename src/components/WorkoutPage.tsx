import { useMemo, useState } from 'react'
import type { Activity } from '../types'
import { WORKOUT_TYPES } from '../types'
import { parseMovingTime, getAvailableYears } from '../hooks/useActivities'
import { useLocale } from '../hooks/useLocale'

interface WorkoutPageProps {
  activities: Activity[]
  onBack: () => void
}

// Extract seconds from "1970-01-01 HH:MM:SS.000000" or "H:MM:SS"
function parseTime(t: string): number {
  if (!t) return 0
  // "1970-01-01 00:33:52.000000" → take time part
  const timePart = t.includes(' ') ? t.split(' ')[1] : t
  return parseMovingTime(timePart.split('.')[0])
}

function formatSecs(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function typeLabel(type: string, locale: string): string {
  const map: Record<string, { zh: string; en: string }> = {
    WeightTraining: { zh: '力量训练', en: 'Weight Training' },
    Workout:        { zh: '综合训练', en: 'Workout' },
    StairStepper:   { zh: '楼梯机', en: 'Stair Stepper' },
    WaterSport:     { zh: '水上运动', en: 'Water Sport' },
  }
  return map[type]?.[locale as 'zh' | 'en'] ?? type
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    WeightTraining: '#f97316',
    Workout:        '#a855f7',
    StairStepper:   '#3b82f6',
    WaterSport:     '#06b6d4',
  }
  return colors[type] ?? '#6b7280'
}

// Dumbbell icon
function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M6 9h12M6 15h12M3 6h3M3 18h3M18 6h3M18 18h3" />
    </svg>
  )
}

// Heatmap: how many sessions per week per year
function WorkoutHeatmap({ workouts }: { workouts: Activity[] }) {
  const { locale } = useLocale()
  if (workouts.length === 0) return null

  const years = Array.from(new Set(workouts.map(a => new Date(a.start_date_local).getFullYear()))).sort((a, b) => b - a)

  return (
    <div className="space-y-4">
      {years.map(yr => {
        const dayMap = new Map<string, number>()
        workouts
          .filter(a => new Date(a.start_date_local).getFullYear() === yr)
          .forEach(a => {
            const d = a.start_date_local.slice(0, 10)
            dayMap.set(d, (dayMap.get(d) || 0) + 1)
          })

        const startDate = new Date(yr, 0, 1)
        const startDay = startDate.getDay()
        const endDate = new Date(yr, 11, 31)
        const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1

        const grid: { date: string; count: number }[][] = []
        const monthPositions: { label: number; weekIdx: number }[] = []
        let currentMonth = -1

        for (let d = 0; d < totalDays; d++) {
          const date = new Date(yr, 0, 1 + d)
          const weekIdx = Math.floor((d + startDay) / 7)
          while (grid.length <= weekIdx) grid.push([])
          const key = `${yr}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          grid[weekIdx].push({ date: key, count: dayMap.get(key) || 0 })
          if (date.getMonth() !== currentMonth) {
            currentMonth = date.getMonth()
            monthPositions.push({ label: currentMonth + 1, weekIdx })
          }
        }

        const monthNames = locale === 'zh'
          ? ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
          : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

        const yearCount = workouts.filter(a => new Date(a.start_date_local).getFullYear() === yr).length

        return (
          <div key={yr}>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-sm font-bold">{yr}</span>
              <span className="text-xs text-[var(--color-muted)]">{yearCount} {locale === 'zh' ? '次' : 'sessions'}</span>
            </div>
            <div className="overflow-x-auto">
              <div className="flex ml-5 mb-1">
                {monthPositions.map((m, i) => {
                  const nextStart = monthPositions[i + 1]?.weekIdx ?? grid.length
                  const span = nextStart - m.weekIdx
                  return (
                    <div key={i} className="text-[10px] text-[var(--color-muted)]" style={{ width: `${span * 14}px`, minWidth: `${span * 14}px` }}>
                      {monthNames[m.label - 1]}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-[3px]">
                {grid.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        className="w-3 h-3 rounded-sm"
                        style={{
                          backgroundColor: day.count === 0
                            ? 'var(--color-border)'
                            : day.count === 1
                              ? '#f97316aa'
                              : '#f97316',
                        }}
                        title={day.count > 0 ? `${day.date}: ${day.count} session(s)` : day.date}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WorkoutPage({ activities, onBack }: WorkoutPageProps) {
  const { locale } = useLocale()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')

  const workouts = useMemo(
    () => activities.filter(a => (WORKOUT_TYPES as string[]).includes(a.type)),
    [activities]
  )

  const allYears = getAvailableYears(workouts)

  const filtered = useMemo(() => {
    let list = workouts
    if (selectedYear !== null) list = list.filter(a => new Date(a.start_date_local).getFullYear() === selectedYear)
    if (selectedType !== 'all') list = list.filter(a => a.type === selectedType)
    return list.slice().sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())
  }, [workouts, selectedYear, selectedType])

  // All-time stats
  const totalSessions = workouts.length
  const totalSecs = workouts.reduce((s, a) => s + parseTime(a.moving_time), 0)
  const avgHR = workouts.filter(a => a.average_heartrate).reduce((s, a, _, arr) => s + (a.average_heartrate ?? 0) / arr.length, 0)

  // Per-type breakdown
  const typeBreakdown = useMemo(() => {
    return WORKOUT_TYPES.map(t => ({
      type: t,
      count: workouts.filter(a => a.type === t).length,
      secs: workouts.filter(a => a.type === t).reduce((s, a) => s + parseTime(a.moving_time), 0),
    })).filter(t => t.count > 0)
  }, [workouts])

  // Monthly cadence for the selected year (or current year)
  const cadenceYear = selectedYear ?? new Date().getFullYear()
  const monthlyCounts = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => ({
      month: m,
      count: workouts.filter(a => {
        const d = new Date(a.start_date_local)
        return d.getFullYear() === cadenceYear && d.getMonth() === m
      }).length,
    }))
  }, [workouts, cadenceYear])
  const maxMonthCount = Math.max(...monthlyCounts.map(m => m.count), 1)

  const monthLabels = locale === 'zh'
    ? ['1','2','3','4','5','6','7','8','9','10','11','12']
    : ['J','F','M','A','M','J','J','A','S','O','N','D']

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {locale === 'zh' ? '返回' : 'Back'}
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <DumbbellIcon className="w-5 h-5 text-[var(--color-accent)]" />
          {locale === 'zh' ? '健身记录' : 'Gym & Workouts'}
        </h1>
      </div>

      {/* All-time summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 text-center">
          <p className="text-[var(--color-muted)] text-xs mb-1">{locale === 'zh' ? '总训练次数' : 'Total Sessions'}</p>
          <p className="font-bold font-mono text-3xl text-[var(--color-accent)]">{totalSessions}</p>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 text-center">
          <p className="text-[var(--color-muted)] text-xs mb-1">{locale === 'zh' ? '总训练时长' : 'Total Time'}</p>
          <p className="font-bold font-mono text-3xl">{formatSecs(totalSecs)}</p>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 text-center">
          <p className="text-[var(--color-muted)] text-xs mb-1">{locale === 'zh' ? '平均心率' : 'Avg Heart Rate'}</p>
          <p className="font-bold font-mono text-3xl">{avgHR > 0 ? `${Math.round(avgHR)}` : '--'}<span className="text-sm font-normal text-[var(--color-muted)] ml-1">bpm</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Left: heatmap + log */}
        <div className="space-y-6">

          {/* Activity heatmap */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">{locale === 'zh' ? '训练热力图' : 'Training Heatmap'}</h2>
            <WorkoutHeatmap workouts={workouts} />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year filter */}
            <button
              onClick={() => setSelectedYear(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedYear === null ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50'}`}
            >
              {locale === 'zh' ? '全部年份' : 'All Years'}
            </button>
            {allYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr === selectedYear ? null : yr)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedYear === yr ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50'}`}
              >
                {yr}
              </button>
            ))}
            <div className="w-px h-4 bg-[var(--color-border)]" />
            {/* Type filter */}
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedType === 'all' ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50'}`}
            >
              {locale === 'zh' ? '全部类型' : 'All Types'}
            </button>
            {typeBreakdown.map(t => (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type === selectedType ? 'all' : t.type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedType === t.type ? 'text-white' : 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50'}`}
                style={selectedType === t.type ? { backgroundColor: typeColor(t.type) } : {}}
              >
                {typeLabel(t.type, locale)}
              </button>
            ))}
          </div>

          {/* Activity log */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <span className="text-sm font-semibold">{locale === 'zh' ? '训练记录' : 'Session Log'}</span>
              <span className="text-xs text-[var(--color-muted)]">{filtered.length} {locale === 'zh' ? '条' : 'records'}</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.length === 0 && (
                <p className="text-center py-10 text-[var(--color-muted)] text-sm">{locale === 'zh' ? '暂无数据' : 'No sessions found'}</p>
              )}
              {filtered.map((a, idx) => {
                const secs = parseTime(a.moving_time)
                const date = new Date(a.start_date_local)
                const dateStr = locale === 'zh'
                  ? `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`
                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const timeStr = date.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                const color = typeColor(a.type)

                return (
                  <div
                    key={a.run_id}
                    className="px-5 py-3.5 flex items-center gap-4 hover:bg-[var(--color-accent)]/5 transition-colors animate-[fadeSlideIn_0.2s_ease-out_both]"
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    {/* Type badge */}
                    <div
                      className="w-2 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{dateStr} · {timeStr}</p>
                    </div>
                    {/* Type label */}
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color + '22', color }}
                    >
                      {typeLabel(a.type, locale)}
                    </span>
                    {/* Duration */}
                    <div className="text-right flex-shrink-0 w-14">
                      <p className="text-sm font-mono font-semibold">{formatSecs(secs)}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">{locale === 'zh' ? '时长' : 'duration'}</p>
                    </div>
                    {/* HR */}
                    {a.average_heartrate && (
                      <div className="text-right flex-shrink-0 w-14">
                        <p className="text-sm font-mono font-semibold">{Math.round(a.average_heartrate)}</p>
                        <p className="text-[10px] text-[var(--color-muted)]">bpm</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: type breakdown + monthly cadence */}
        <div className="space-y-6">

          {/* Type breakdown */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">{locale === 'zh' ? '训练类型分布' : 'Type Breakdown'}</h2>
            <div className="space-y-3">
              {typeBreakdown.map(t => {
                const pct = Math.round((t.count / totalSessions) * 100)
                return (
                  <div key={t.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: typeColor(t.type) }}>{typeLabel(t.type, locale)}</span>
                      <span className="text-xs text-[var(--color-muted)] font-mono">{t.count} {locale === 'zh' ? '次' : 'sessions'} · {formatSecs(t.secs)}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: typeColor(t.type) }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Monthly cadence */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">{locale === 'zh' ? `${cadenceYear} 月度频次` : `${cadenceYear} Monthly`}</h2>
              <div className="flex gap-1">
                {allYears.slice(0, 4).map(yr => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr === selectedYear ? null : yr)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-all ${(selectedYear ?? allYears[0]) === yr ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1.5" style={{ height: '80px' }}>
              {monthlyCounts.map(m => {
                const barH = m.count > 0 ? Math.max(Math.round((m.count / maxMonthCount) * 64), 6) : 0
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex items-end justify-center" style={{ height: '64px' }}>
                      {m.count > 0 && (
                        <div
                          className="w-full rounded-t-sm transition-colors bg-[var(--color-accent)]/50 group-hover:bg-[var(--color-accent)] relative"
                          style={{ height: `${barH}px` }}
                        >
                          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {m.count}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--color-muted)]">{monthLabels[m.month]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Personal records (longest session, highest HR) */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4">{locale === 'zh' ? '个人最佳' : 'Personal Bests'}</h2>
            <div className="space-y-3">
              {(() => {
                const longest = workouts.reduce<Activity | null>((best, a) =>
                  !best || parseTime(a.moving_time) > parseTime(best.moving_time) ? a : best, null)
                const highestHR = workouts.filter(a => a.average_heartrate).reduce<Activity | null>((best, a) =>
                  !best || (a.average_heartrate ?? 0) > (best.average_heartrate ?? 0) ? a : best, null)
                const mostFreqMonth = (() => {
                  const counts = new Map<string, number>()
                  workouts.forEach(a => {
                    const k = a.start_date_local.slice(0, 7)
                    counts.set(k, (counts.get(k) || 0) + 1)
                  })
                  let best = { key: '', count: 0 }
                  counts.forEach((count, key) => { if (count > best.count) best = { key, count } })
                  return best
                })()

                const records = [
                  {
                    label: locale === 'zh' ? '最长单次训练' : 'Longest Session',
                    value: longest ? formatSecs(parseTime(longest.moving_time)) : '--',
                    sub: longest?.name ?? '',
                    icon: '⏱️',
                  },
                  {
                    label: locale === 'zh' ? '最高平均心率' : 'Peak Avg HR',
                    value: highestHR ? `${Math.round(highestHR.average_heartrate!)} bpm` : '--',
                    sub: highestHR?.name ?? '',
                    icon: '❤️',
                  },
                  {
                    label: locale === 'zh' ? '最勤奋的月份' : 'Most Active Month',
                    value: mostFreqMonth.key ? `${mostFreqMonth.count} ${locale === 'zh' ? '次' : 'sessions'}` : '--',
                    sub: mostFreqMonth.key,
                    icon: '🏆',
                  },
                ]

                return records.map(r => (
                  <div key={r.label} className="flex items-start gap-3">
                    <span className="text-lg leading-none mt-0.5">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">{r.label}</p>
                      <p className="text-sm font-bold font-mono">{r.value}</p>
                      {r.sub && <p className="text-[10px] text-[var(--color-muted)] truncate">{r.sub}</p>}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
