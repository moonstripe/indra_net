import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Brain, RefreshCw, BarChart3, Check } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()

  // Redirect logged-in users to dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Version Control
            </span>
            <br />
            <span className="text-gray-100">for AI Reasoning</span>
          </h1>
          
          <p className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto">
            IndraDB is a GitHub-like platform for <code className="text-purple-400">.indra</code> databases. 
            Track what your AI agents are thinking, storing, and how their understanding evolves over time.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/login"
              className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/moonstripe/indra_db"
              className="border border-gray-700 hover:border-gray-500 px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Brain className="w-10 h-10 text-purple-400" />}
            title="Track AI Memory"
            description="See exactly what your AI agents remember across sessions. Every thought, every insight, versioned and searchable."
          />
          <FeatureCard
            icon={<RefreshCw className="w-10 h-10 text-purple-400" />}
            title="Sync Everywhere"
            description="Push and pull .indra databases like git repos. Keep your agents' knowledge in sync across machines."
          />
          <FeatureCard
            icon={<BarChart3 className="w-10 h-10 text-purple-400" />}
            title="Analyze Reasoning"
            description="Visualize how understanding evolves. Detect semantic drift, cluster topics, and understand your AI better."
          />
        </div>
      </div>

      {/* Comparison Matrix */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Why Indra?</h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          There are many MCP memory servers. Here's how Indra's git-like architecture gives you capabilities others can't.
        </p>
        <ComparisonMatrix />
      </div>

      {/* Pricing Preview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <PricingCard
            tier="Hobby"
            price="Free"
            features={[
              '1 database',
              '1,000 thoughts',
              '10 MB storage',
              'Public repos only',
            ]}
          />
          <PricingCard
            tier="Pro"
            price="$8/mo"
            features={[
              'Unlimited databases',
              '100,000 thoughts',
              '1 GB storage',
              'Private repos',
              'API access',
              'Analytics dashboard',
            ]}
            highlighted
          />
          <PricingCard
            tier="Enterprise"
            price="Custom"
            features={[
              'Everything in Pro',
              'Unlimited storage',
              'SSO / SAML',
              'Audit logs',
              'Dedicated support',
              'On-prem option',
            ]}
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}

type ComparisonFeature = {
  feature: string
  indra: string
  others: string
  highlight?: boolean
}

const comparisonData: ComparisonFeature[] = [
  {
    feature: 'Branching',
    indra: 'Multi-branch exploration',
    others: 'Linear only',
    highlight: true,
  },
  {
    feature: 'Diff / Compare',
    indra: 'Commit-level diffs',
    others: 'Not supported',
    highlight: true,
  },
  {
    feature: 'Semantic Search',
    indra: 'Local HF models',
    others: 'Varies (API-dependent)',
  },
  {
    feature: 'Graph Relations',
    indra: 'Typed + weighted edges',
    others: 'Flat or basic',
    highlight: true,
  },
  {
    feature: 'Storage',
    indra: 'Single portable .indra file',
    others: 'Repo-based / multi-file',
  },
  {
    feature: '3D Visualization',
    indra: 'PCA + WebGL via IndraDB',
    others: 'Not available',
    highlight: true,
  },
  {
    feature: 'Offline-First',
    indra: 'Full local operation',
    others: 'Varies',
  },
]

function ComparisonMatrix() {
  return (
    <div className="overflow-x-auto">
      {/* Desktop table */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Feature</th>
            <th className="text-left py-3 px-4 font-semibold text-purple-400">Indra</th>
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Other MCP Memory Servers</th>
          </tr>
        </thead>
        <tbody>
          {comparisonData.map((row) => (
            <tr key={row.feature} className="border-b border-gray-800/50">
              <td className="py-3 px-4 font-medium">{row.feature}</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className={row.highlight ? 'text-purple-300' : 'text-gray-300'}>
                    {row.indra}
                  </span>
                </span>
              </td>
              <td className="py-3 px-4 text-gray-500">{row.others}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {comparisonData.map((row) => (
          <div key={row.feature} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <h4 className="font-medium mb-2">{row.feature}</h4>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-purple-300 font-medium">Indra:</span>
                <span className="text-gray-300">{row.indra}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">—</span>
                <span className="text-gray-500 font-medium">Others:</span>
                <span className="text-gray-500">{row.others}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Compared against medha-mcp, git-notes-memory, Grigori, and other MCP memory servers.{' '}
        <a
          href="https://github.com/moonstripe/indra_db#how-indra-compares"
          className="text-purple-400 hover:text-purple-300"
        >
          Full comparison →
        </a>
      </p>
    </div>
  )
}

function PricingCard({ 
  tier, 
  price, 
  features, 
  highlighted = false 
}: { 
  tier: string
  price: string
  features: string[]
  highlighted?: boolean 
}) {
  return (
    <div className={`rounded-xl p-6 ${
      highlighted 
        ? 'bg-purple-900/30 border-2 border-purple-500' 
        : 'bg-gray-900/50 border border-gray-800'
    }`}>
      <h3 className="text-xl font-semibold">{tier}</h3>
      <div className="text-3xl font-bold mt-2 mb-6">{price}</div>
      <ul className="space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-gray-300">
            <Check className="w-4 h-4 text-purple-400" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
