import { useEffect, useMemo, useState } from 'react'
import type { Activity, SportFilter } from '../types'
import { useLocale } from '../hooks/useLocale'
import { extractProvince } from '../hooks/useActivities'

interface ChinaMapProps {
  activities: Activity[]
  filter: SportFilter
}

type GeoFeature = {
  type: 'Feature'
  properties: { name: string; adcode: number }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][][]
  }
}

// Simple equirectangular projection bounded to China
const BOUNDS = { minLng: 73, maxLng: 136, minLat: 15, maxLat: 54 }

function project(lng: number, lat: number, w: number, h: number): [number, number] {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * w
  const y = h - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h
  return [x, y]
}

function ringToPath(ring: number[][], w: number, h: number): string {
  return ring.map(([lng, lat], i) => {
    const [x, y] = project(lng, lat, w, h)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

function featureToPath(feature: GeoFeature, w: number, h: number): string {
  const { type, coordinates } = feature.geometry
  if (type === 'Polygon') {
    return (coordinates as unknown as number[][][]).map(r => ringToPath(r, w, h)).join(' ')
  }
  // MultiPolygon
  return (coordinates as unknown as number[][][][])
    .flatMap(poly => poly.map(r => ringToPath(r, w, h)))
    .join(' ')
}

export function ChinaMap({ activities, filter }: ChinaMapProps) {
  const { locale } = useLocale()
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null)
  const [features, setFeatures] = useState<GeoFeature[]>([])

  const SVG_W = 260
  const SVG_H = 180

  // Lazy-load GeoJSON to keep initial bundle small
  useEffect(() => {
    import('../assets/china-provinces.json').then(mod => {
      setFeatures((mod.default as { features: GeoFeature[] }).features)
    })
  }, [])

  // Build province → activity count map
  const provinceCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of activities) {
      const p = extractProvince(a.location_country)
      if (p) map.set(p, (map.get(p) ?? 0) + 1)
    }
    return map
  }, [activities])

  const visitedCount = provinceCount.size
  const hoveredCount = hoveredProvince ? (provinceCount.get(hoveredProvince) ?? 0) : 0

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">
          {locale === 'zh' ? '足迹地图' : 'Footprint Map'}
        </h2>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="font-mono font-bold text-[var(--color-accent)]">{visitedCount}</span>
          <span>/ {features.length || 35} {locale === 'zh' ? '省份' : 'provinces'}</span>
        </div>
      </div>

      {/* SVG Map */}
      <div className="relative">
        <svg
          key={filter}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: 'block' }}
        >
          {features.map(feature => {
            const name = feature.properties.name
            const count = provinceCount.get(name) ?? 0
            const visited = count > 0
            const isHovered = hoveredProvince === name

            return (
              <path
                key={feature.properties.adcode}
                d={featureToPath(feature, SVG_W, SVG_H)}
                fill={visited
                  ? isHovered
                    ? 'var(--color-accent)'
                    : 'color-mix(in srgb, var(--color-accent) 55%, transparent)'
                  : 'var(--color-border)'}
                stroke="var(--color-bg)"
                strokeWidth="0.5"
                className="transition-all duration-150 cursor-default"
                onMouseEnter={() => setHoveredProvince(name)}
                onMouseLeave={() => setHoveredProvince(null)}
              />
            )
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredProvince && (
          <div className="absolute bottom-0 left-0 text-xs text-[var(--color-muted)] pointer-events-none">
            <span className="font-medium text-[var(--color-text)]">{hoveredProvince}</span>
            {hoveredCount > 0 && (
              <span className="ml-1.5">
                {hoveredCount} {locale === 'zh' ? '次' : 'activities'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
