import { useEffect, useMemo, useState } from 'react'
import * as polyline from '@mapbox/polyline'
import type { Activity, SportFilter } from '../types'
import { getAvailableYears, formatDistance, parseMovingTime, formatPace } from '../hooks/useActivities'
import { useLocale } from '../hooks/useLocale'

interface TracksPageProps {
  activities: Activity[]
  filter: SportFilter
  onBack: () => void
  onSelectActivity?: (a: Activity | null) => void
}

function renderTrackSVG(summaryPolyline: string, size = 80): string {
  try {
    const coords = polyline.decode(summaryPolyline) // [lat, lng]
    if (coords.length < 2) return ''

    const lats = coords.map(c => c[0])
    const lngs = coords.map(c => c[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001
    const scale = Math.min((size - 8) / lngRange, (size - 8) / latRange)
    const offsetX = (size - lngRange * scale) / 2
    const offsetY = (size - latRange * scale) / 2

    const points = coords.map(([lat, lng]) => {
      const x = (lng - minLng) * scale + offsetX
      const y = size - ((lat - minLat) * scale + offsetY)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')

    return points
  } catch {
    return ''
  }
}

function TrackThumb({ activity, color, onClick }: { activity: Activity; color: string; onClick: () => void }) {
  const size = 80
  const points = activity.summary_polyline ? renderTrackSVG(activity.summary_polyline, size) : ''

  if (!points) return null

  return (
    <div
      className="cursor-pointer group"
      onClick={onClick}
      title={`${activity.name} — ${(activity.distance / 1000).toFixed(1)} km`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transition-opacity group-hover:opacity-100 opacity-70"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function TracksPage({ activities, onBack, onSelectActivity }: TracksPageProps) {
  const { locale } = useLocale()
  const allYears = getAvailableYears(activities)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const withPolyline = useMemo(() => {
    const base = activities.filter(a => a.summary_polyline && a.summary_polyline.length > 20)
    if (selectedYear === null) return base
    return base.filter(a => new Date(a.start_date_local).getFullYear() === selectedYear)
  }, [activities, selectedYear])

  const yearStats = useMemo(() => {
    return allYears.map(yr => {
      const acts = withPolyline.filter(a => new Date(a.start_date_local).getFullYear() === yr)
      const allActs = activities.filter(a => new Date(a.start_date_local).getFullYear() === yr)
      const dist = allActs.reduce((s, a) => s + a.distance, 0)
      const time = allActs.reduce((s, a) => s + parseMovingTime(a.moving_time), 0)
      const runs = allActs.filter(a => a.type === 'Run' && a.average_speed > 0)
      const pace = runs.length > 0 ? runs.reduce((s, a) => s + a.average_speed, 0) / runs.length : 0
      return { year: yr, count: allActs.length, dist, time, pace, acts }
    })
  }, [activities, withPolyline, allYears])

  const filteredActivities = selectedYear === null
    ? activities
    : activities.filter(a => new Date(a.start_date_local).getFullYear() === selectedYear)

  // Total summary always uses all activities
  const allTotalDist = activities.reduce((s, a) => s + a.distance, 0)
  const allTotalTime = activities.reduce((s, a) => s + parseMovingTime(a.moving_time), 0)
  const allRunsTotal = activities.filter(a => a.type === 'Run' && a.average_speed > 0)
  const allAvgPace = allRunsTotal.length > 0 ? allRunsTotal.reduce((s, a) => s + a.average_speed, 0) / allRunsTotal.length : 0

  // Bottom stats follow the year filter
  const totalDist = filteredActivities.reduce((s, a) => s + a.distance, 0)
  const totalTime = filteredActivities.reduce((s, a) => s + parseMovingTime(a.moving_time), 0)
  const allRuns = filteredActivities.filter(a => a.type === 'Run' && a.average_speed > 0)
  const avgPace = allRuns.length > 0 ? allRuns.reduce((s, a) => s + a.average_speed, 0) / allRuns.length : 0

  // Cluster similar routes: round start/end lat/lng to ~1km grid + round distance to 2km bucket
  type Cluster = { representative: Activity; count: number; color: string }
  const [clusteredTracks, setClusteredTracks] = useState<Cluster[]>([])
  const [clustering, setClustering] = useState(true)

  useEffect(() => {
    setClustering(true)
    // Defer to next tick so the page shell renders first
    const id = setTimeout(() => {
      const acts = withPolyline
      // Pre-decode all polylines once
      type Decoded = { start: [number, number]; end: [number, number]; distBucket: number }
      const decoded: (Decoded | null)[] = acts.map(a => {
        try {
          const coords = polyline.decode(a.summary_polyline!)
          if (coords.length < 2) return null
          return {
            start: coords[0] as [number, number],
            end: coords[coords.length - 1] as [number, number],
            distBucket: Math.round(a.distance / 2000),
          }
        } catch { return null }
      })

      const clusters: Cluster[] = []
      const used = new Set<number>()

      for (let i = 0; i < acts.length; i++) {
        if (used.has(i)) continue
        const di = decoded[i]
        if (!di) continue
        let count = 1
        for (let j = i + 1; j < acts.length; j++) {
          if (used.has(j)) continue
          const dj = decoded[j]
          if (!dj) continue
          if (di.distBucket !== dj.distBucket) continue
          const startClose = Math.abs(di.start[0] - dj.start[0]) < 0.005 && Math.abs(di.start[1] - dj.start[1]) < 0.005
          const endClose = Math.abs(di.end[0] - dj.end[0]) < 0.005 && Math.abs(di.end[1] - dj.end[1]) < 0.005
          if (startClose && endClose) { used.add(j); count++ }
        }
        used.add(i)
        clusters.push({ representative: acts[i], count, color: getColor(acts[i]) })
      }
      setClusteredTracks(clusters)
      setClustering(false)
    }, 0)
    return () => clearTimeout(id)
  }, [withPolyline])

  function getColor(a: Activity): string {
    const km = a.distance / 1000
    if (a.type === 'Run') {
      if (km >= 40) return '#ef4444'
      if (km >= 20) return '#f97316'
      return 'var(--color-accent)'
    }
    if (a.type === 'Ride') return '#3b82f6'
    if (a.type === 'Hike') return '#22c55e'
    return 'var(--color-accent)'
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      {/* Back button */}
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
        <h1 className="text-xl font-bold">
          {locale === 'zh' ? '轨迹墙' : 'Track Wall'}
        </h1>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: year stats sidebar */}
        <div className="w-56 flex-shrink-0 space-y-3">
          {/* Total summary card */}
          <div
            onClick={() => setSelectedYear(null)}
            className={`bg-[var(--color-card)] border rounded-xl p-4 cursor-pointer transition-all ${
              selectedYear === null
                ? 'border-[var(--color-accent)] shadow-md shadow-[var(--color-accent)]/10'
                : 'border-[var(--color-accent)]/40 hover:border-[var(--color-accent)]'
            }`}
          >
            <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">Total Summary</p>
            <p className="text-3xl font-bold font-mono text-[var(--color-accent)]">{formatDistance(allTotalDist)}</p>
            <p className="text-xs text-[var(--color-muted)] mb-3">km</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">Activities</p>
                <p className="font-bold font-mono">{activities.length}</p>
              </div>
              <div>
                <p className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">Time</p>
                <p className="font-bold font-mono">{Math.floor(allTotalTime / 3600)}h {Math.floor((allTotalTime % 3600) / 60)}m</p>
              </div>
              {allAvgPace > 0 && (
                <div>
                  <p className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">Avg Pace</p>
                  <p className="font-bold font-mono">{formatPace(allAvgPace)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Per-year cards */}
          {yearStats.map(({ year: yr, count, dist, time, pace }) => (
            <div
              key={yr}
              onClick={() => setSelectedYear(selectedYear === yr ? null : yr)}
              className={`bg-[var(--color-card)] border rounded-xl p-4 cursor-pointer transition-all ${
                selectedYear === yr
                  ? 'border-[var(--color-accent)] shadow-md shadow-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-bold">{yr}</span>
                <span className="text-xs text-[var(--color-muted)]">{count} {locale === 'zh' ? '次' : 'runs'}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <p className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">Distance</p>
                  <p className="font-mono font-semibold">{formatDistance(dist)} km</p>
                </div>
                <div>
                  <p className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">Time</p>
                  <p className="font-mono font-semibold">{Math.floor(time / 3600)}h {Math.floor((time % 3600) / 60)}m</p>
                </div>
                {pace > 0 && (
                  <div>
                    <p className="text-[var(--color-muted)] uppercase tracking-wider text-[10px]">Avg Pace</p>
                    <p className="font-mono font-semibold">{formatPace(pace)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: track grid */}
        <div className="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 min-w-0">
          {clustering ? (
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="w-[80px] h-[80px] rounded bg-[var(--color-border)] animate-pulse" style={{ animationDelay: `${i * 20}ms` }} />
              ))}
            </div>
          ) : (
          <div className="flex flex-wrap gap-1">
            {clusteredTracks.map(({ representative: a, count, color }) => (
              <div key={a.run_id} className="relative">
                <TrackThumb
                  activity={a}
                  color={color}
                  onClick={() => onSelectActivity?.(a)}
                />
                {count > 1 && (
                  <span className="absolute bottom-1 right-1 bg-[var(--color-bg)]/80 text-[var(--color-muted)] text-[9px] font-bold px-1 py-0.5 rounded leading-none">
                    ×{count}
                  </span>
                )}
              </div>
            ))}
          </div>
          )}

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center gap-6 text-xs text-[var(--color-muted)]">
            <span className="font-medium uppercase tracking-wider">
              {locale === 'zh' ? '特殊轨迹' : 'Special Tracks'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-[#f97316] rounded" />
              {locale === 'zh' ? '超过 20 km' : 'Over 20.0 km'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-[#ef4444] rounded" />
              {locale === 'zh' ? '超过 40 km' : 'Over 40.0 km'}
            </span>
            <div className="ml-auto flex items-center gap-6">
              <span>{locale === 'zh' ? '活动数' : 'Runs'}: <strong>{filteredActivities.length}</strong></span>
              <span>{locale === 'zh' ? '总距离' : 'Dist'}: <strong>{formatDistance(totalDist)} km</strong></span>
              <span>{locale === 'zh' ? '时间' : 'Time'}: <strong>{Math.floor(totalTime / 3600)}h {Math.floor((totalTime % 3600) / 60)}m</strong></span>
              {avgPace > 0 && <span>{locale === 'zh' ? '均配速' : 'Pace'}: <strong>{formatPace(avgPace)}</strong></span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
