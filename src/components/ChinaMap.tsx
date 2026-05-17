import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity, SportFilter } from '../types'
import { useLocale } from '../hooks/useLocale'
import { extractProvince } from '../hooks/useActivities'

interface ChinaMapProps {
  activities: Activity[]
  filter: SportFilter
  onSelectProvince?: (province: string | null) => void
  selectedProvince?: string | null
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

export function ChinaMap({ activities, filter, onSelectProvince, selectedProvince }: ChinaMapProps) {
  const { locale } = useLocale()
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null)
  const [features, setFeatures] = useState<GeoFeature[]>([])

  // Zoom/pan state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const SVG_W = 260
  const SVG_H = 190

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
  const displayProvince = hoveredProvince ?? selectedProvince
  const displayCount = displayProvince ? (provinceCount.get(displayProvince) ?? 0) : 0

  // Zoom with mouse wheel
  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.85 : 1.18
    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * delta, 1), 8)
      // Zoom toward cursor position
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { ...prev, scale: newScale }
      const cx = ((e.clientX - rect.left) / rect.width) * SVG_W
      const cy = ((e.clientY - rect.top) / rect.height) * SVG_H
      const ratio = newScale / prev.scale
      return {
        scale: newScale,
        x: cx - ratio * (cx - prev.x),
        y: cy - ratio * (cy - prev.y),
      }
    })
  }

  function handleMouseDown(e: React.MouseEvent) {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scaleX = SVG_W / rect.width
    const scaleY = SVG_H / rect.height
    setTransform(prev => ({
      ...prev,
      x: prev.x + dx * scaleX,
      y: prev.y + dy * scaleY,
    }))
  }

  function handleMouseUp() { dragging.current = false }

  function resetView() {
    setTransform({ x: 0, y: 0, scale: 1 })
  }

  function handleClick(name: string) {
    if (!onSelectProvince) return
    const visited = (provinceCount.get(name) ?? 0) > 0
    if (!visited) return
    onSelectProvince(selectedProvince === name ? null : name)
  }

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">
          {locale === 'zh' ? '足迹地图' : 'Footprint Map'}
        </h2>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          {selectedProvince ? (
            <button
              onClick={() => onSelectProvince?.(null)}
              className="flex items-center gap-1 text-[var(--color-accent)] hover:opacity-70 transition-opacity"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {locale === 'zh' ? '清除筛选' : 'Clear'}
            </button>
          ) : (
            <>
              <span className="font-mono font-bold text-[var(--color-accent)]">{visitedCount}</span>
              <span>/ {features.length || 35} {locale === 'zh' ? '省份' : 'provinces'}</span>
            </>
          )}
          {transform.scale > 1.05 && (
            <button
              onClick={resetView}
              className="ml-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              title={locale === 'zh' ? '重置视图' : 'Reset view'}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* SVG Map — aspect-ratio wrapper prevents stretching */}
      <div className="relative" style={{ aspectRatio: `${SVG_W} / ${SVG_H}` }}>
        <svg
          ref={svgRef}
          key={filter}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          height="100%"
          style={{ display: 'block', position: 'absolute', inset: 0, cursor: transform.scale > 1.05 ? 'grab' : 'default' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {features.map(feature => {
            const name = feature.properties.name
            const count = provinceCount.get(name) ?? 0
            const visited = count > 0
            const isHovered = hoveredProvince === name
            const isSelected = selectedProvince === name

            let fill: string
            if (visited) {
              if (isSelected) {
                fill = 'var(--color-accent)'
              } else if (isHovered) {
                fill = 'color-mix(in srgb, var(--color-accent) 80%, transparent)'
              } else if (selectedProvince) {
                // dim other provinces when one is selected
                fill = 'color-mix(in srgb, var(--color-accent) 25%, transparent)'
              } else {
                fill = 'color-mix(in srgb, var(--color-accent) 55%, transparent)'
              }
            } else {
              fill = 'var(--color-border)'
            }

            return (
              <path
                key={feature.properties.adcode}
                d={featureToPath(feature, SVG_W, SVG_H)}
                fill={fill}
                stroke="var(--color-bg)"
                strokeWidth={0.5 / transform.scale}
                className={`transition-all duration-150 ${visited ? 'cursor-pointer' : 'cursor-default'}`}
                onMouseEnter={() => setHoveredProvince(name)}
                onMouseLeave={() => setHoveredProvince(null)}
                onClick={() => handleClick(name)}
              />
            )
          })}
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      <div className="mt-1.5 h-4 text-xs text-[var(--color-muted)]">
        {displayProvince && (
          <>
            <span className="font-medium text-[var(--color-text)]">{displayProvince}</span>
            {displayCount > 0 && (
              <span className="ml-1.5">
                {displayCount} {locale === 'zh' ? '次' : 'activities'}
              </span>
            )}
            {selectedProvince === displayProvince && !hoveredProvince && (
              <span className="ml-1.5 text-[var(--color-accent)]">
                {locale === 'zh' ? '（已筛选）' : '(filtered)'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
