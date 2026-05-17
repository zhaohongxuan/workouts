import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, Loader, Route } from 'lucide-react'
import type { Activity, SportFilter } from '../types'
import { useLocale } from '../hooks/useLocale'
import { useGitHubAuthContext } from '../hooks/useGitHubAuthContext'
import { formatDistance, parseMovingTime, extractProvince } from '../hooks/useActivities'
import rawConfig from '@config'

const config = rawConfig as { repoOwner?: string; repoName?: string }
const REPO_OWNER = config.repoOwner ?? 'zhaohongxuan'
const REPO_NAME  = config.repoName  ?? 'workouts'
const WORKFLOW_FILE = 'run_data_sync.yml'

type RunStatus = 'idle' | 'triggering' | 'queued' | 'in_progress' | 'success' | 'failure' | 'error'

interface ProfileCardProps {
  activities: Activity[]
  filter?: SportFilter
}

export function ProfileCard({ activities, filter = 'all' }: ProfileCardProps) {
  const { t, locale } = useLocale()
  const { token } = useGitHubAuthContext()

  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [runUrl, setRunUrl] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => localStorage.getItem('lastSyncedAt'))

  // Fetch last successful workflow run time on mount (when token available)
  useEffect(() => {
    if (!token) return
    void (async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/runs?status=success&per_page=1`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
        )
        if (!res.ok) return
        const data = (await res.json()) as { workflow_runs: Array<{ updated_at: string }> }
        const run = data.workflow_runs[0]
        if (run) {
          setLastSyncedAt(run.updated_at)
          localStorage.setItem('lastSyncedAt', run.updated_at)
        }
      } catch { /* ignore */ }
    })()
  }, [token])

  const filteredActivities = filter === 'all' ? activities : activities.filter(a => a.type === filter)

  const totalDistance = filteredActivities.reduce((s, a) => s + a.distance, 0)
  const totalCount = filteredActivities.length
  const totalSeconds = filteredActivities.reduce((s, a) => s + parseMovingTime(a.moving_time), 0)

  const allDates = activities.map((a) => new Date(a.start_date_local).getFullYear())
  const yearsActive = allDates.length > 0 ? (Math.max(...allDates) - Math.min(...allDates) + 1) : 0

  const countries = new Set<string>()
  const provinces = new Set<string>()
  for (const a of activities) {
    const loc = a.location_country
    if (!loc || loc === 'None') continue
    if (loc.startsWith('{')) {
      try {
        const d = JSON.parse(loc.replace(/'/g, '"').replace(/None/g, 'null'))
        if (d.country) countries.add(d.country)
      } catch { /* ignore */ }
    } else if (loc.includes('泰国')) { countries.add('泰国')
    } else if (loc.includes('日本')) { countries.add('日本')
    } else { countries.add('中国') }
    const p = extractProvince(loc)
    if (p) provinces.add(p)
  }

  const formatHours = (secs: number) => `${(secs / 3600).toFixed(1)}h`

  const formatSyncTime = (isoStr: string) => {
    const diffMs = Date.now() - new Date(isoStr).getTime()
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (locale === 'zh') {
      if (mins < 1) return '刚刚'
      if (mins < 60) return `${mins} 分钟前`
      if (hours < 24) return `${hours} 小时前`
      return `${days} 天前`
    } else {
      if (mins < 1) return 'just now'
      if (mins < 60) return `${mins}m ago`
      if (hours < 24) return `${hours}h ago`
      return `${days}d ago`
    }
  }

  const latest = activities.length > 0
    ? [...activities].sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())[0]
    : null

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (locale === 'zh') return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ── Workflow trigger & poll ───────────────────────────────────────────────

  const pollRun = useCallback(async (runId: number, attempt = 0) => {
    if (attempt > 30) { setRunStatus('error'); setStatusMsg('Timeout'); return }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
      )
      if (!res.ok) { setRunStatus('error'); return }
      const data = (await res.json()) as { status: string; conclusion: string | null; html_url: string }
      setRunUrl(data.html_url)
      if (data.status === 'completed') {
        setRunStatus(data.conclusion === 'success' ? 'success' : 'failure')
        setStatusMsg(data.conclusion ?? '')
        if (data.conclusion === 'success') {
          const now = new Date().toISOString()
          setLastSyncedAt(now)
          localStorage.setItem('lastSyncedAt', now)
        }
      } else {
        setRunStatus(data.status as RunStatus)
        setTimeout(() => void pollRun(runId, attempt + 1), 5000)
      }
    } catch { setRunStatus('error') }
  }, [token])

  const triggerSync = useCallback(async () => {
    if (!token) return
    setRunStatus('triggering')
    setRunUrl(null)
    setStatusMsg('')
    try {
      // Trigger workflow_dispatch
      const triggerRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'master' }),
        }
      )
      if (!triggerRes.ok) {
        const err = (await triggerRes.json()) as { message?: string }
        throw new Error(err.message ?? `${triggerRes.status}`)
      }
      setRunStatus('queued')
      // Wait a bit then find the new run
      await new Promise((r) => setTimeout(r, 4000))
      const runsRes = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?per_page=5&event=workflow_dispatch`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
      )
      if (!runsRes.ok) throw new Error('Failed to list runs')
      const runsData = (await runsRes.json()) as { workflow_runs: Array<{ id: number; html_url: string; created_at: string }> }
      const latest = runsData.workflow_runs[0]
      if (latest) {
        setRunUrl(latest.html_url)
        void pollRun(latest.id)
      }
    } catch (e) {
      setRunStatus('error')
      setStatusMsg(String(e))
    }
  }, [token, pollRun])

  // ── Status badge ─────────────────────────────────────────────────────────

  function StatusBadge() {
    if (runStatus === 'idle') return null
    const map: Record<RunStatus, { icon: React.ReactNode; label: string; color: string }> = {
      idle:        { icon: null, label: '', color: '' },
      triggering:  { icon: <Loader className="w-3 h-3 animate-spin" />, label: locale === 'zh' ? '触发中...' : 'Triggering…', color: 'text-[var(--color-muted)]' },
      queued:      { icon: <Clock className="w-3 h-3" />,              label: locale === 'zh' ? '队列中' : 'Queued',       color: 'text-yellow-500' },
      in_progress: { icon: <Loader className="w-3 h-3 animate-spin" />, label: locale === 'zh' ? '运行中...' : 'Running…',  color: 'text-blue-500' },
      success:     { icon: <CheckCircle className="w-3 h-3" />,         label: locale === 'zh' ? '同步成功' : 'Synced',     color: 'text-green-500' },
      failure:     { icon: <XCircle className="w-3 h-3" />,             label: locale === 'zh' ? '同步失败' : 'Failed',     color: 'text-red-500' },
      error:       { icon: <XCircle className="w-3 h-3" />,             label: statusMsg || (locale === 'zh' ? '出错了' : 'Error'), color: 'text-red-500' },
    }
    const { icon, label, color } = map[runStatus]
    const content = (
      <span className={`flex items-center gap-1 text-xs ${color}`}>
        {icon}{label}
      </span>
    )
    return runUrl ? <a href={runUrl} target="_blank" rel="noopener noreferrer">{content}</a> : content
  }

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--color-accent)]/5 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/5">
      {/* Distance */}
      <div className="text-center">
        <p className="text-3xl font-bold font-mono flex items-center justify-center gap-2">
          <Route className="w-6 h-6 text-[var(--color-accent)]" />
          {formatDistance(totalDistance)}
          <span className="text-base font-normal text-[var(--color-muted)]">km</span>
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-muted)] flex items-center justify-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {countries.size} {t('countries')} ·
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {provinces.size} {t('provinces')}
          </p>
        </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-[var(--color-border)] pt-4">
        <div>
          <p className="text-xs text-[var(--color-muted)] flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {t('activities')}
          </p>
          <p className="text-lg font-bold">{totalCount.toLocaleString()}</p>
        </div>
        <div className="border-x border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-muted)] flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {t('years')}
          </p>
          <p className="text-lg font-bold">{yearsActive}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-muted)] flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {locale === 'zh' ? '时间' : 'Time'}
          </p>
          <p className="text-lg font-bold">{formatHours(totalSeconds)}</p>
        </div>
      </div>

      {/* Latest Activity + Sync */}
      {latest && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[var(--color-muted)]">{locale === 'zh' ? '最近活动' : 'Latest Activity'}</p>
            <div className="flex items-center gap-2">
              {lastSyncedAt && runStatus === 'idle' && (
                <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatSyncTime(lastSyncedAt)}
                </span>
              )}
              <StatusBadge />
              {token && (
                <button
                  onClick={() => void triggerSync()}
                  disabled={runStatus === 'triggering' || runStatus === 'queued' || runStatus === 'in_progress'}
                  title={locale === 'zh' ? '触发 Strava 同步' : 'Trigger Strava sync'}
                  className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runStatus === 'in_progress' || runStatus === 'triggering' ? 'animate-spin' : ''}`} />
                  {locale === 'zh' ? '同步' : 'Sync'}
                </button>
              )}
            </div>
          </div>
          <p className="text-sm font-medium">
            {latest.type === 'Run' ? '🏃 ' : latest.type === 'Ride' ? '🚴 ' : '🏋️ '}
            {latest.name || (latest.type === 'Run' ? 'Run' : 'Ride')}
            <span className="text-[var(--color-muted)] font-normal"> · {formatDistance(latest.distance)} km · {formatDate(latest.start_date_local)}</span>
          </p>
        </div>
      )}
    </div>
  )
}
