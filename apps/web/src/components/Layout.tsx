import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, loading, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🔮</span>
              <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                IndraNet
              </span>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-6">
              {loading ? (
                <div className="h-8 w-8 rounded-full bg-gray-700 animate-pulse" />
              ) : user ? (
                <>
                  <Link 
                    to="/dashboard" 
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                  <div className="flex items-center gap-3">
                    <Link to="/settings">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.name}
                          className="h-8 w-8 rounded-full ring-2 ring-purple-500/50"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center">
                          {user.name[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <button
                      onClick={logout}
                      className="text-gray-400 hover:text-white text-sm transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to="/login"
                  className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-gray-500 text-sm">
            <p>© 2026 IndraNet. Open source.</p>
            <div className="flex gap-6">
              <a href="https://github.com/moonstripe/indra_net" className="hover:text-gray-300">
                GitHub
              </a>
              <a href="/docs" className="hover:text-gray-300">
                Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
