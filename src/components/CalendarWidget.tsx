import { useMemo, useState } from 'react'
import * as polyline from '@mapbox/polyline'
import type { Activity } from '../types'
import { formatDistance } from '../hooks/useActivities'
import { useLocale } from '../hooks/useLocale'

// SVG polyline points for a thumbnail of the given polyline.
function renderTrackSVG(summaryPolyline: string, width: number, height: number): string {
  try {
    const coords = polyline.decode(summaryPolyline)
    if (coords.length < 2) return ''
    const lats = coords.map(c => c[0])
    const lngs = coords.map(c => c[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001
    const pad = 4
    const scale = Math.min((width - pad * 2) / lngRange, (height - pad * 2) / latRange)
    const offsetX = (width - lngRange * scale) / 2
    const offsetY = (height - latRange * scale) / 2
    return coords.map(([lat, lng]) => {
      const x = (lng - minLng) * scale + offsetX
      const y = height - ((lat - minLat) * scale + offsetY)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  } catch {
    return ''
  }
}

function trackColor(type: string): string {
  if (type === 'Run') return '#f97316'
  if (type === 'Ride') return '#3b82f6'
  if (type === 'Hike') return '#22c55e'
  if (type === 'Swim') return '#06b6d4'
  return 'var(--color-accent)'
}

interface CalendarWidgetProps {
  activities: Activity[]
  onSelectActivity: (activity: Activity | null) => void
}

export function CalendarWidget({ activities, onSelectActivity }: CalendarWidgetProps) {
  const { t } = useLocale()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  const { days, monthDistance, monthCount } = useMemo(() => {
    const firstDaySun = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
    const firstDay = (firstDaySun + 6) % 7 // convert to Mon=0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const dayActivities = new Map<number, Activity[]>()
    for (const a of activities) {
      const d = new Date(a.start_date_local)
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const day = d.getDate()
        const arr = dayActivities.get(day) || []
        arr.push(a)
        dayActivities.set(day, arr)
      }
    }

    let totalDist = 0
    let totalCount = 0
    for (const acts of dayActivities.values()) {
      totalCount += acts.length
      totalDist += acts.reduce((s, a) => s + a.distance, 0)
    }

    // Per-day representative track: longest activity that has a polyline.
    const dayTrack = (acts: Activity[]): { polyline: string; type: string } | null => {
      let best: { polyline: string; type: string } | null = null
      let bestDist = -1
      for (const a of acts) {
        if (a.summary_polyline && a.summary_polyline.length > 20 && a.distance > bestDist) {
          bestDist = a.distance
          best = { polyline: a.summary_polyline, type: a.type }
        }
      }
      return best
    }

    const days: { day: number; activities: Activity[]; distance: number; track: { polyline: string; type: string } | null }[] = []
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, activities: [], distance: 0, track: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const acts = dayActivities.get(d) || []
      const dist = acts.reduce((s, a) => s + a.distance, 0)
      days.push({ day: d, activities: acts, distance: dist, track: dayTrack(acts) })
    }

    return { days, monthDistance: totalDist, monthCount: totalCount }
  }, [activities, viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }

  // 4 tiers: returns px size of circle
  const getCircleSize = (dist: number): number => {
    if (!dist) return 0
    const km = dist / 1000
    if (km < 5) return 20
    if (km < 10) return 26
    if (km < 20) return 32
    return 38
  }

  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const monthStr = `${String(viewMonth + 1).padStart(2, '0')}/${viewYear}`

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-lg font-bold">{monthStr}</span>
          <span className="text-sm text-[var(--color-muted)] ml-3">
            {formatDistance(monthDistance)} km
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="text-[var(--color-muted)] hover:text-[var(--color-text)] px-1">←</button>
          <button onClick={nextMonth} className="text-[var(--color-muted)] hover:text-[var(--color-text)] px-1">→</button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((d, i) => (
          <div key={i} className="text-center text-xs text-[var(--color-muted)] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid — fixed height so 5-row and 6-row months are identical */}
      <div className="grid grid-cols-7 gap-0.5" style={{ height: '240px', gridAutoRows: '1fr' }}>
        {days.map((d, i) => {
          const isHovered = hoveredDay === i && d.distance > 0
          return (
            <div
              key={i}
              onClick={() => { if (d.activities.length > 0) onSelectActivity(d.activities[0]) }}
              onMouseEnter={() => d.distance > 0 && setHoveredDay(i)}
              onMouseLeave={() => setHoveredDay(null)}
              className={`flex items-center justify-center relative rounded transition-colors ${
                d.day === 0 ? '' : d.activities.length > 0 ? 'cursor-pointer' : ''
              } ${isHovered ? 'ring-1 ring-[var(--color-accent)]' : ''}`}
              title={d.day > 0 && d.activities.length > 0 ? `${d.day} · ${(d.distance / 1000).toFixed(1)} km` : undefined}
            >
              {d.day > 0 && (
                <div className="relative flex items-center justify-center">
                  {(() => {
                    const size = 30
                    const points = d.track ? renderTrackSVG(d.track.polyline, size, size) : ''
                    if (points) {
                      // Day has a GPS track: show its thumbnail.
                      return (
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                          <polyline
                            points={points}
                            fill="none"
                            stroke={trackColor(d.track!.type)}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )
                    }
                    // No track (rest day, or no-GPS activity): original circle + label.
                    const circleSize = getCircleSize(d.distance)
                    return (
                      <>
                        {circleSize > 0 && (
                          <div
                            className="absolute rounded-full bg-[var(--color-accent)]/25 transition-all duration-200"
                            style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                          />
                        )}
                        <span className={`relative text-[10px] font-medium leading-none transition-all ${
                          isHovered
                            ? 'text-[var(--color-text)]'
                            : d.activities.length > 0
                              ? 'text-[var(--color-accent)]'
                              : 'text-[var(--color-muted)]'
                        }`}>
                          {isHovered
                            ? d.day
                            : d.activities.length > 0
                              ? `${(d.distance / 1000).toFixed(0)}k`
                              : d.day}
                        </span>
                      </>
                    )
                  })()}
                  {/* Activity count badge */}
                  {d.activities.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[12px] h-3 px-0.5 flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-[8px] font-bold leading-none">
                      {d.activities.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>{monthCount} {t('calendarActivities')}</span>
        <span>{formatDistance(monthDistance)} km</span>
      </div>
    </div>
  )
}
