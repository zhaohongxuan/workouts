import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Footprints, Bike, Mountain, Dumbbell } from 'lucide-react'
import * as polyline from '@mapbox/polyline'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Activity } from '../types'
import { parseMovingTime, formatPace } from '../hooks/useActivities'
import { useLocale } from '../hooks/useLocale'

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYmVuLTI5IiwiYSI6ImNrZ3Q4Ym9mMDBqMGYyeXFvODV2dWl6YzQifQ.gSKoWF-fMjhzU67TuDezJQ'

interface MarathonPageProps {
  activities: Activity[]
  dark?: boolean
  onBack: () => void
  onSelectActivity?: (a: Activity | null) => void
}

// Long-distance milestone thresholds (km) per sport type.
const THRESHOLDS: { type: string; km: number; zh: string; en: string; color: string }[] = [
  { type: 'Run', km: 21, zh: '跑步 21km+', en: 'Run 21km+', color: '#f97316' },
  { type: 'Ride', km: 40, zh: '骑行 40km+', en: 'Ride 40km+', color: '#3b82f6' },
  { type: 'Hike', km: 10, zh: '徒步 10km+', en: 'Hike 10km+', color: '#22c55e' },
]

function typeColor(type: string): string {
  return THRESHOLDS.find(t => t.type === type)?.color ?? 'var(--color-accent)'
}

function TypeIcon({ type, className = 'w-3.5 h-3.5', style }: { type: string; className?: string; style?: CSSProperties }) {
  const Icon = type === 'Run' ? Footprints : type === 'Ride' ? Bike : type === 'Hike' ? Mountain : Dumbbell
  return <Icon className={className} style={style} strokeWidth={2} aria-hidden="true" />
}

function renderTrackSVG(summaryPolyline: string, size = 120): string {
  try {
    const coords = polyline.decode(summaryPolyline)
    if (coords.length < 2) return ''
    const lats = coords.map(c => c[0])
    const lngs = coords.map(c => c[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001
    const pad = 8
    const scale = Math.min((size - pad * 2) / lngRange, (size - pad * 2) / latRange)
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

function fmtDate(a: Activity, locale: string): string {
  return new Date(a.start_date_local).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// Fullscreen-ish map modal showing a single track.
function TrackMapModal({ activity, dark, onClose }: { activity: Activity; dark?: boolean; onClose: () => void }) {
  const { locale } = useLocale()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const style = dark !== false ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'

  useEffect(() => {
    if (!mapContainer.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const m = new mapboxgl.Map({ container: mapContainer.current, style, center: [108, 35], zoom: 4 })
    m.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.current = m
    m.on('load', () => {
      if (!activity.summary_polyline) return
      const coords = polyline.decode(activity.summary_polyline).map(([lat, lng]) => [lng, lat] as [number, number])
      m.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } })
      m.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': typeColor(activity.type), 'line-width': 3, 'line-opacity': 0.95 } })
      const bounds = new mapboxgl.LngLatBounds()
      coords.forEach(c => bounds.extend(c))
      m.fitBounds(bounds, { padding: 60, maxZoom: 14 })
    })
    return () => { m.remove(); map.current = null }
  }, [activity, style])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-[var(--color-text)] flex items-center gap-1.5">
              <TypeIcon type={activity.type} className="w-4 h-4" style={{ color: typeColor(activity.type) }} /> {activity.name || activity.type}
            </p>
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
              {fmtDate(activity, locale)} · {(activity.distance / 1000).toFixed(2)} km
            </p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-muted)] hover:text-[var(--color-text)]" aria-label={locale === 'zh' ? '关闭' : 'Close'}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="relative flex-1" ref={mapContainer} />
      </div>
    </div>
  )
}

export function MarathonPage({ activities, dark, onBack, onSelectActivity }: MarathonPageProps) {
  const { locale } = useLocale()
  const [selected, setSelected] = useState<Activity | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  // Long-distance activities by per-type threshold.
  const longActs = useMemo(() => {
    return activities
      .filter(a => {
        const t = THRESHOLDS.find(x => x.type === a.type)
        if (!t) return false
        return a.distance / 1000 >= t.km && !!a.summary_polyline && a.summary_polyline.length > 20
      })
      .sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())
  }, [activities])

  const filtered = typeFilter ? longActs.filter(a => a.type === typeFilter) : longActs

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of longActs) c[a.type] = (c[a.type] ?? 0) + 1
    return c
  }, [longActs])

  const presentTypes = THRESHOLDS.filter(t => (counts[t.type] ?? 0) > 0)

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {locale === 'zh' ? '返回' : 'Back'}
        </button>
        <h1 className="text-lg font-bold shrink-0">Memory</h1>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] flex-wrap">
          {THRESHOLDS.map(t => (
            <span key={t.type} className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-0.5">
              <TypeIcon type={t.type} style={{ color: t.color }} />
              {locale === 'zh' ? t.zh : t.en}
            </span>
          ))}
        </div>
      </div>

      {/* Type filter chips */}
      {presentTypes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => setTypeFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${typeFilter === null ? 'bg-[var(--color-accent)] text-white border-transparent' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}>
            {locale === 'zh' ? '全部' : 'All'} · {longActs.length}
          </button>
          {presentTypes.map(t => (
            <button key={t.type} onClick={() => setTypeFilter(typeFilter === t.type ? null : t.type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${typeFilter === t.type ? 'text-white border-transparent' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
              style={typeFilter === t.type ? { backgroundColor: t.color } : {}}>
              <span className="inline-flex items-center gap-1"><TypeIcon type={t.type} style={{ color: typeFilter === t.type ? '#fff' : t.color }} />{locale === 'zh' ? (t.type === 'Run' ? '跑步' : t.type === 'Ride' ? '骑行' : '徒步') : t.type} · {counts[t.type]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] py-12 text-center">
          {locale === 'zh' ? '暂无长距离记录' : 'No long-distance activities yet'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(a => {
            const points = renderTrackSVG(a.summary_polyline!, 120)
            const isRun = a.type === 'Run'
            return (
              <button
                key={a.run_id}
                onClick={() => { setSelected(a); onSelectActivity?.(a) }}
                className="group text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-all hover:border-[var(--color-accent)]/60 hover:shadow-lg"
              >
                <div className="relative flex h-[120px] items-center justify-center rounded-lg bg-[var(--color-bg)] overflow-hidden">
                  {/* Map-like backdrop: grid texture + soft vignette */}
                  <svg width={120} height={120} viewBox="0 0 120 120" className="absolute inset-0" aria-hidden="true">
                    <defs>
                      <pattern id={`grid-${a.run_id}`} width="12" height="12" patternUnits="userSpaceOnUse">
                        <path d="M12 0H0V12" fill="none" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.5" />
                      </pattern>
                    </defs>
                    <rect width="120" height="120" fill={`url(#grid-${a.run_id})`} />
                  </svg>
                  <svg width={120} height={120} viewBox="0 0 120 120" className="relative" aria-hidden="true">
                    {points && (
                      <>
                        <polyline points={points} fill="none" stroke={typeColor(a.type)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
                        <polyline points={points} fill="none" stroke={typeColor(a.type)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    )}
                  </svg>
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center" style={{ color: typeColor(a.type) }}>
                    <TypeIcon type={a.type} className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-sm font-semibold truncate text-[var(--color-text)]">{a.name || a.type}</p>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[var(--color-text)]">
                      {(a.distance / 1000).toFixed(isRun ? 2 : 1)} <span className="text-[var(--color-muted)] font-normal">km</span>
                    </span>
                    <span className="text-[var(--color-muted)]">
                      {isRun ? formatPace(a.average_speed) : `${(a.average_speed * 3.6).toFixed(1)} km/h`}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--color-muted)] flex items-center justify-between">
                    <span>{fmtDate(a, locale)}</span>
                    <span>{Math.floor(parseMovingTime(a.moving_time) / 3600)}h {Math.floor((parseMovingTime(a.moving_time) % 3600) / 60)}m</span>
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <TrackMapModal
          activity={selected}
          dark={dark}
          onClose={() => { setSelected(null); onSelectActivity?.(null) }}
        />
      )}
    </div>
  )
}
