import { useState, useEffect } from 'react'
import * as polyline from '@mapbox/polyline'
import { Calendar, Rows3, Tag, Route, Clock, Gauge, Heart } from 'lucide-react'
import type { Activity, SportFilter } from '../types'
import { WORKOUT_TYPES } from '../types'
import { formatDuration, formatPace } from '../hooks/useActivities'
import { useLocale } from '../hooks/useLocale'

interface ActivityLogProps {
  activities: Activity[]
  years: number[]
  year: number | null
  setYear: (y: number | null) => void
  selectedActivity?: Activity | null
  onSelectActivity?: (a: Activity | null) => void
  filter?: SportFilter
  selectedProvince?: string | null
  onClearProvince?: () => void
}

const PAGE_SIZE = 16

type DistanceFilter = 'all' | '10' | '20' | '40'

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    Run: '🏃',
    Ride: '🚴',
    Hike: '🥾',
    Swim: '🏊',
    WeightTraining: '🏋️',
    Workout: '💪',
    StairStepper: '🪜',
    WaterSport: '🏊',
  }
  return icons[type] ?? '📌'
}

function typeLabel(type: string, locale: string): string {
  const map: Record<string, { zh: string; en: string }> = {
    WeightTraining: { zh: '力量', en: 'Weights' },
    Workout:        { zh: '训练', en: 'Workout' },
    StairStepper:   { zh: '楼梯', en: 'Stairs' },
    WaterSport:     { zh: '水上', en: 'Water' },
  }
  return map[type]?.[locale as 'zh' | 'en'] ?? type
}

// lucide icon for table headers.
function HeaderIcon({ kind }: { kind: 'date' | 'type' | 'name' | 'distance' | 'duration' | 'pace' | 'hr' }) {
  const map = { date: Calendar, type: Rows3, name: Tag, distance: Route, duration: Clock, pace: Gauge, hr: Heart }
  const Icon = map[kind]
  return <Icon className="w-3 h-3 shrink-0" strokeWidth={2} aria-hidden="true" />
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    WeightTraining: '#f97316',
    Workout:        '#c026d3',
    StairStepper:   '#3b82f6',
    WaterSport:     '#06b6d4',
  }
  return colors[type] ?? 'var(--color-accent)'
}

// Sport-specific color for the track thumbnail.
function trackColor(type: string): string {
  if (type === 'Run') return '#f97316'
  if (type === 'Ride') return '#3b82f6'
  if (type === 'Hike') return '#22c55e'
  if (type === 'Swim') return '#06b6d4'
  return 'var(--color-accent)'
}

// Build an SVG polyline "points" string for a small track thumbnail.
function renderTrackSVG(summaryPolyline: string | null, size = 26): string {
  if (!summaryPolyline) return ''
  try {
    const coords = polyline.decode(summaryPolyline)
    if (coords.length < 2) return ''
    const lats = coords.map(c => c[0])
    const lngs = coords.map(c => c[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001
    const scale = Math.min((size - 6) / lngRange, (size - 6) / latRange)
    const offsetX = (size - lngRange * scale) / 2
    const offsetY = (size - latRange * scale) / 2
    return coords.map(([lat, lng]) => {
      const x = (lng - minLng) * scale + offsetX
      const y = size - ((lat - minLat) * scale + offsetY)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  } catch {
    return ''
  }
}

function parseTimeSecs(t: string): number {
  if (!t) return 0
  const timePart = t.includes(' ') ? t.split(' ')[1] : t
  const parts = timePart.split('.')[0].split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0]
}

function formatSecs(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function ActivityLog({ activities, years, year, setYear, selectedActivity, onSelectActivity, filter = 'all', selectedProvince, onClearProvince }: ActivityLogProps) {
  const { t, locale } = useLocale()
  const [page, setPage] = useState(0)
  const [distFilter, setDistFilter] = useState<DistanceFilter>('all')
  const [gymTypeFilter, setGymTypeFilter] = useState<string>('all')

  const isGym = filter === 'Gym'

  const distFiltered = activities.filter((a) => {
    if (isGym) return true
    const km = a.distance / 1000
    switch (distFilter) {
      case '10': return km >= 10 && km < 20
      case '20': return km >= 20 && km < 40
      case '40': return km >= 40
      default: return true
    }
  }).filter((a) => {
    if (!isGym || gymTypeFilter === 'all') return true
    return a.type === gymTypeFilter
  })

  const sorted = [...distFiltered].sort(
    (a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()
  )

  useEffect(() => {
    if (selectedActivity) {
      const idx = sorted.findIndex(a => a.run_id === selectedActivity.run_id)
      if (idx >= 0) {
        setPage(Math.floor(idx / PAGE_SIZE))
      } else {
        setDistFilter('all')
      }
    }
  }, [selectedActivity?.run_id])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const gymTypes = WORKOUT_TYPES.filter(t => activities.some(a => a.type === t))

  const logTitle = filter === 'Run'  ? (locale === 'zh' ? '跑步记录' : 'Run Log')
    : filter === 'Ride' ? (locale === 'zh' ? '骑行记录' : 'Ride Log')
    : filter === 'Hike' ? (locale === 'zh' ? '徒步记录' : 'Hike Log')
    : filter === 'Swim' ? (locale === 'zh' ? '游泳记录' : 'Swim Log')
    : filter === 'Gym'  ? (locale === 'zh' ? '健身记录' : 'Gym Log')
    : t('activityLog')

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{logTitle}</h2>
        <span className="text-sm text-[var(--color-muted)]">
          {t('showing')} {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} {t('of')} {sorted.length}
        </span>
      </div>

      {/* Active filter chips */}
      {selectedProvince && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-[var(--color-muted)]">{locale === 'zh' ? '当前筛选' : 'Filtered by'}</span>
          <button
            onClick={() => onClearProvince?.()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-colors"
            title={locale === 'zh' ? '清除筛选' : 'Clear filter'}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {selectedProvince}
            <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Year tabs */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setYear(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${year === null ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
        >
          All
        </button>
        {years.map((y) => (
          <button key={y} onClick={() => { setYear(y); setPage(0) }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${year === y ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Gym: type filter / Normal: distance filter */}
      {isGym ? (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={() => { setGymTypeFilter('all'); setPage(0) }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${gymTypeFilter === 'all' ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
          >
            {t('all')}
          </button>
          {gymTypes.map(gt => (
            <button key={gt} onClick={() => { setGymTypeFilter(gt === gymTypeFilter ? 'all' : gt); setPage(0) }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${gymTypeFilter === gt ? 'text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
              style={gymTypeFilter === gt ? { backgroundColor: typeColor(gt) } : {}}
            >
              {typeLabel(gt, locale)}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-5">
          {([['all', t('all')], ['10', '10km+'], ['20', '20km+'], ['40', '40km+']] as [DistanceFilter, string][]).map(([val, label]) => (
            <button key={val} onClick={() => { setDistFilter(val); setPage(0) }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${distFilter === val ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="date" />{t('date')}</span></th>
              <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="type" />{t('type')}</span></th>
              <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="name" />{t('name')}</span></th>
              {isGym ? (
                <>
                  <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="duration" />{t('duration')}</span></th>
                  <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="hr" />{t('hr')}</span></th>
                </>
              ) : (
                <>
                  <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="distance" />{t('distance')}</span></th>
                  <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="duration" />{t('duration')}</span></th>
                  <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="pace" />{t('pace')}</span></th>
                  <th className="pb-3 font-medium"><span className="inline-flex items-center gap-1"><HeaderIcon kind="hr" />{t('hr')}</span></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.map((a) => (
              <tr
                key={a.run_id}
                onClick={() => onSelectActivity?.(selectedActivity?.run_id === a.run_id ? null : a)}
                className={`border-b border-[var(--color-border)]/30 cursor-pointer transition-colors ${
                  selectedActivity?.run_id === a.run_id
                    ? 'bg-[var(--color-accent)]/10 border-l-2 border-l-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-bg)]'
                }`}
              >
                <td className="py-3 text-[var(--color-muted)]">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="tabular-nums">{a.start_date_local.slice(0, 16).replace('T', ' ')}</span>
                    {/* Fixed-width slot so rows without a track keep the same alignment */}
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center">
                      {(() => {
                        const points = renderTrackSVG(a.summary_polyline, 28)
                        if (!points) return null
                        return (
                          <svg
                            width={28}
                            height={28}
                            viewBox="0 0 28 28"
                            className="rounded bg-[var(--color-border)]/25"
                            aria-hidden="true"
                          >
                            <polyline
                              points={points}
                              fill="none"
                              stroke={trackColor(a.type)}
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )
                      })()}
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  {isGym ? (
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: typeColor(a.type) + '22', color: typeColor(a.type) }}>
                      {typeIcon(a.type)} {typeLabel(a.type, locale)}
                    </span>
                  ) : (
                    <span className="text-[var(--color-muted)]">{typeIcon(a.type)} {a.type}</span>
                  )}
                </td>
                <td className="py-3">{a.name || (a.type === 'Run' ? t('run') : t('ride'))}</td>
                {isGym ? (
                  <>
                    <td className="py-3 font-mono font-medium">{formatSecs(parseTimeSecs(a.moving_time))}</td>
                    <td className="py-3 text-[var(--color-muted)]">{a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : '--'}</td>
                  </>
                ) : (
                  <>
                    <td className="py-3 font-mono font-medium">
                      {a.distance > 0
                        ? <>{(a.distance / 1000).toFixed(1)}<span className="text-[var(--color-muted)] ml-1 font-normal text-xs">km</span></>
                        : <span className="text-[var(--color-muted)]">--</span>}
                    </td>
                    <td className="py-3 text-[var(--color-muted)]">{formatDuration(a.moving_time)}</td>
                    <td className="py-3 text-[var(--color-muted)]">
                      {a.average_speed > 0
                        ? (a.type === 'Run' ? formatPace(a.average_speed) : `${(a.average_speed * 3.6).toFixed(1)} km/h`)
                        : '--'}
                    </td>
                    <td className="py-3 text-[var(--color-muted)]">{a.average_heartrate ? Math.round(a.average_heartrate) : '--'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-border)]">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors">←</button>
        <span className="text-sm text-[var(--color-muted)]">{t('page')} {page + 1} {t('pageOf')} {totalPages} {t('pages')}</span>
        <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors">→</button>
      </div>
    </div>
  )
}
