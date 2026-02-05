import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  tier: 'hobby' | 'pro' | 'enterprise'
  created_at: string
  github_id?: string
  google_id?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (provider: 'github' | 'google') => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const data = await res.json()
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const login = (provider: 'github' | 'google') => {
    // Redirect to OAuth provider
    const clientId = provider === 'github' 
      ? import.meta.env.VITE_GITHUB_CLIENT_ID 
      : import.meta.env.VITE_GOOGLE_CLIENT_ID
    
    const redirectUri = `${window.location.origin}/auth/callback/${provider}`
    
    if (provider === 'github') {
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`
    } else {
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include' 
    })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
