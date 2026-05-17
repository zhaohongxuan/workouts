import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { GitHubUser } from '../types/checkin'

const STORAGE_TOKEN_KEY = 'checkin_github_token'
const STORAGE_USER_KEY = 'checkin_github_user'

export interface GitHubAuthContextValue {
  token: string | null
  user: GitHubUser | null
  loading: boolean
  showPATInput: boolean
  setShowPATInput: (v: boolean) => void
  submitPAT: (pat: string) => Promise<void>
  logout: () => void
}

const GitHubAuthContext = createContext<GitHubAuthContextValue | null>(null)

export function GitHubAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN_KEY))
  const [user, setUser] = useState<GitHubUser | null>(() => {
    const s = localStorage.getItem(STORAGE_USER_KEY)
    return s ? (JSON.parse(s) as GitHubUser) : null
  })
  const [loading, setLoading] = useState(false)
  const [showPATInput, setShowPATInput] = useState(false)
  const didInit = useRef(false)

  const fetchUser = useCallback(async (t: string): Promise<boolean> => {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      })
      if (!res.ok) {
        localStorage.removeItem(STORAGE_TOKEN_KEY)
        localStorage.removeItem(STORAGE_USER_KEY)
        setToken(null); setUser(null)
        return false
      }
      const data = (await res.json()) as GitHubUser
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data))
      setUser(data)
      return true
    } catch { return false }
  }, [])

  useEffect(() => {
    if (!didInit.current && token && !user) {
      didInit.current = true
      void fetchUser(token)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submitPAT = useCallback(async (pat: string) => {
    const trimmed = pat.trim()
    if (!trimmed) return
    setLoading(true)
    const ok = await fetchUser(trimmed)
    if (ok) {
      localStorage.setItem(STORAGE_TOKEN_KEY, trimmed)
      setToken(trimmed)
      setShowPATInput(false)
    } else {
      alert('Token 无效或权限不足，请检查后重试。\nInvalid token or insufficient permissions.')
    }
    setLoading(false)
  }, [fetchUser])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY)
    localStorage.removeItem(STORAGE_USER_KEY)
    setToken(null); setUser(null); setShowPATInput(false)
  }, [])

  return (
    <GitHubAuthContext.Provider value={{ token, user, loading, showPATInput, setShowPATInput, submitPAT, logout }}>
      {children}
    </GitHubAuthContext.Provider>
  )
}

export function useGitHubAuthContext(): GitHubAuthContextValue {
  const ctx = useContext(GitHubAuthContext)
  if (!ctx) throw new Error('useGitHubAuthContext must be used within GitHubAuthProvider')
  return ctx
}
