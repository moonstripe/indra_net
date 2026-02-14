import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../lib/api'
import { XCircle } from 'lucide-react'

export default function AuthCallback() {
  const { provider } = useParams<{ provider: 'github' | 'google' }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh, handleAuthTokens } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const exchangedRef = useRef(false)

  useEffect(() => {
    // Prevent double-execution in React Strict Mode
    if (exchangedRef.current) return
    
    const code = searchParams.get('code')
    
    if (!code) {
      setError('No authorization code received')
      return
    }

    exchangedRef.current = true

    const exchangeCode = async () => {
      try {
        const res = await fetch(apiUrl(`/api/auth/${provider}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Authentication failed')
        }

        // Store tokens for cross-origin auth
        if (data.access_token && data.refresh_token) {
          handleAuthTokens(data.access_token, data.refresh_token)
        }

        // Refresh auth context with new user
        await refresh()
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true })
      } catch (err: any) {
        console.error('Auth callback error:', err)
        setError(err.message || 'Authentication failed')
      }
    }

    exchangeCode()
  }, [provider, searchParams, navigate, refresh, handleAuthTokens])

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-gray-900/50 border border-red-800 rounded-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold text-red-400 mb-2">Authentication Failed</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400">Completing sign in...</p>
      </div>
    </div>
  )
}
