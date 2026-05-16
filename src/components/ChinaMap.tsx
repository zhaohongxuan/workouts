import { useEffect, useMemo, useState } from 'react'
import type { Activity } from '../types'
import { useLocale } from '../hooks/useLocale'

interface ChinaMapProps {
  activities: Activity[]
}

type GeoFeature = {
  type: 'Feature'
  properties: { name: string; adcode: number }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][][]
  }
}

// Extract province name from location_country string (handles all 3 formats)
function extractProvince(loc: string | null): string | null {
  if (!loc || loc === 'None') return null
  // Format 1: Python dict string  {'country':'中国','province':'河南省',...}
  if (loc.startsWith('{')) {
    try {
      const d = JSON.parse(loc.replace(/'/g, '"').replace(/None/g, 'null'))
      if (d.province) return d.province as string
    } catch { /* ignore */ }
    return null
  }
  // Format 2 & 3: search for province keywords in the string
  const provincePatterns = [
    '北京市', '天津市', '上海市', '重庆市',
    '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
    '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
    '河南省', '湖北省', '湖南省', '广东省', '海南省',
    '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省',
    '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
    '香港特别行政区', '澳门特别行政区', '台湾省',
  ]
  for (const p of provincePatterns) {
    if (loc.includes(p)) return p
  }
  // Fuzzy: short names → full names
  const fuzzy: Record<string, string> = {
    '上海': '上海市', '北京': '北京市', '天津': '天津市', '重庆': '重庆市',
    '江苏': '江苏省', '浙江': '浙江省', '广东': '广东省', '河南': '河南省',
    '四川': '四川省', '湖北': '湖北省', '湖南': '湖南省', '福建': '福建省',
    '安徽': '安徽省', '山东': '山东省', '河北': '河北省', '山西': '山西省',
    '云南': '云南省', '贵州': '贵州省', '陕西': '陕西省', '甘肃': '甘肃省',
    '辽宁': '辽宁省', '吉林': '吉林省', '黑龙江': '黑龙江省', '海南': '海南省',
    '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区',
    '新疆': '新疆维吾尔自治区', '宁夏': '宁夏回族自治区',
    '香港': '香港特别行政区', '澳门': '澳门特别行政区', '台湾': '台湾省',
  }
  for (const [key, val] of Object.entries(fuzzy)) {
    if (loc.includes(key)) return val
  }
  return null
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

export function ChinaMap({ activities }: ChinaMapProps) {
  const { locale } = useLocale()
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null)
  const [features, setFeatures] = useState<GeoFeature[]>([])

  const SVG_W = 340
  const SVG_H = 240

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
        <span className="text-xs text-[var(--color-muted)]">
          <span className="font-mono font-bold text-[var(--color-accent)]">{visitedCount}</span>
          {' '}{locale === 'zh' ? '个省份' : ' provinces'}
        </span>
      </div>

      {/* SVG Map */}
      <div className="relative">
        <svg
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

      {/* Footer stats */}
      <div className="mt-2 pt-3 border-t border-[var(--color-border)] flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 55%, transparent)' }} />
          {locale === 'zh' ? '到访' : 'Visited'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[var(--color-border)]" />
          {locale === 'zh' ? '未到' : 'Not yet'}
        </span>
        <span className="ml-auto">
          {visitedCount} / {features.length || 35} {locale === 'zh' ? '省份' : 'provinces'}
        </span>
      </div>
    </div>
  )
}
