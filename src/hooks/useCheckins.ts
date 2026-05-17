import { useState, useEffect, useCallback } from 'react'
import type { Checkin, CheckinData } from '../types/checkin'
import rawConfig from '@config'

const config = rawConfig as { repoOwner?: string; repoName?: string }
const REPO_OWNER = config.repoOwner ?? ''
const REPO_NAME = config.repoName ?? ''
const FILE_PATH = 'data/checkins.json'

function todayStr() {
  return new Date().toLocaleDateString('sv-SE')
}

async function encodeContent(obj: unknown): Promise<string> {
  const jsonStr = JSON.stringify(obj, null, 2) + '\n'
  const bytes = new TextEncoder().encode(jsonStr)
  return btoa(bytes.reduce((s, b) => s + String.fromCharCode(b), ''))
}

interface UseCheckinsResult {
  checkins: Checkin[]
  todayCheckin: Checkin | null
  saveCheckin: (patch: Partial<Checkin>) => Promise<void>
  loading: boolean
  saving: boolean
  error: string | null
}

export function useCheckins(token: string | null): UseCheckinsResult {
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileSha, setFileSha] = useState<string | null>(null)

  const today = todayStr()
  const todayCheckin = checkins.find((c) => c.date === today) ?? null

  const fetchCheckins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      if (!REPO_OWNER || !REPO_NAME) { setCheckins([]); setLoading(false); return }
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        { headers }
      )
      if (!res.ok) {
        if (res.status === 404) setCheckins([])
        else setError(`GitHub API error: ${res.status}`)
        setLoading(false)
        return
      }
      const data = (await res.json()) as { content: string; sha: string }
      setFileSha(data.sha)
      const decoded = atob(data.content.replace(/\n/g, ''))
      const json = JSON.parse(decoded) as CheckinData
      setCheckins(json.checkins ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void fetchCheckins() }, [fetchCheckins])

  const saveCheckin = useCallback(async (patch: Partial<Checkin>) => {
    if (!token) return
    if (!REPO_OWNER || !REPO_NAME) {
      alert('请先在 config.yml 中配置 repoOwner 和 repoName。')
      return
    }
    const prev = checkins
    const existing = checkins.find((c) => c.date === today)
    const base: Checkin = existing ?? { date: today, pushups: false, squats: false, coldShower: false }
    const merged: Checkin = { ...base, ...patch }
    const updated = existing
      ? checkins.map((c) => (c.date === today ? merged : c))
      : [...checkins, merged].sort((a, b) => a.date.localeCompare(b.date))
    setCheckins(updated)

    setSaving(true)
    try {
      const content = await encodeContent({ checkins: updated })
      const body: Record<string, string> = { message: `checkin: update ${today}`, content }
      if (fileSha) body['sha'] = fileSha
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const err = (await res.json()) as { message?: string }
        throw new Error(err.message ?? `GitHub API error: ${res.status}`)
      }
      const result = (await res.json()) as { content: { sha: string } }
      setFileSha(result.content.sha)
    } catch (e) {
      setCheckins(prev)
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }, [token, checkins, today, fileSha])

  return { checkins, todayCheckin, saveCheckin, loading, saving, error }
}
