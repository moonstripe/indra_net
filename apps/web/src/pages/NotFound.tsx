import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl mb-6">🔮</div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-400 mb-8">
          This thought hasn't been committed yet.
        </p>
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-block bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Go Home
          </Link>
          <p className="text-gray-500">
            or{' '}
            <Link to="/dashboard" className="text-purple-400 hover:text-purple-300">
              view your databases
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
