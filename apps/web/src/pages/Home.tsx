import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Brain, GitBranch, BarChart3, Check, Clock, Search } from 'lucide-react'

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
              Memory
            </span>
            <br />
            <span className="text-gray-100">for AI Agents</span>
          </h1>
          
          <p className="mt-6 text-xl text-gray-400 max-w-2xl mx-auto">
            Give your AI agents persistent memory that survives sessions. 
            Track their reasoning, decisions, and how their understanding evolves.
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

      {/* The Problem */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">The Problem</h2>
          <p className="text-gray-400 text-lg text-center">
            AI agents start fresh every session. Yesterday's insights evaporate. 
            Decisions get re-made. Your agent recommends something different each time 
            because it can't remember why it chose the first approach.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">What Indra Gives Your Agent</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Brain className="w-10 h-10 text-purple-400" />}
            title="Persistent Reasoning"
            description="Agents record their decisions and why they made them. Next session, they remember."
          />
          <FeatureCard
            icon={<GitBranch className="w-10 h-10 text-purple-400" />}
            title="Branching Exploration"
            description="Try alternative approaches in isolated branches. Keep the main reasoning thread intact."
          />
          <FeatureCard
            icon={<Search className="w-10 h-10 text-purple-400" />}
            title="Semantic Search"
            description="Find past decisions by meaning, not keywords. 'Database choice' finds 'PostgreSQL recommendation'."
          />
        </div>
        <div className="grid md:grid-cols-2 gap-8 mt-8 max-w-2xl mx-auto">
          <FeatureCard
            icon={<Clock className="w-10 h-10 text-purple-400" />}
            title="Reasoning History"
            description="See how understanding evolved. Debug why conclusions changed."
          />
          <FeatureCard
            icon={<BarChart3 className="w-10 h-10 text-purple-400" />}
            title="3D Visualization"
            description="Watch reasoning clusters form. See connections between decisions."
          />
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Indra is an MCP server. Your agent uses it like any other tool.
        </p>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <StepCard
            number="1"
            title="Agent Makes Decision"
            description="User asks for a recommendation. Agent reasons and decides."
          />
          <StepCard
            number="2"
            title="Agent Records Reasoning"
            description="Agent calls indra_remember with its decision and rationale."
          />
          <StepCard
            number="3"
            title="Next Session"
            description="Agent calls indra_search to find past reasoning. Maintains consistency."
          />
        </div>

        <div className="mt-12 bg-gray-900/50 border border-gray-800 rounded-xl p-6 max-w-3xl mx-auto">
          <p className="text-gray-300 font-mono text-sm">
            <span className="text-purple-400">User:</span> Should I use PostgreSQL or MongoDB?<br/><br/>
            <span className="text-green-400">Agent:</span> <span className="text-gray-500">→ indra_search(&#123; query: "database recommendations" &#125;)</span><br/>
            <span className="text-gray-500 ml-4">Found: "Recommended PostgreSQL for projects with relational data..."</span><br/><br/>
            <span className="text-green-400">Agent:</span> Based on your e-commerce use case and my previous analysis, PostgreSQL is the better choice. You need ACID transactions for orders...<br/><br/>
            <span className="text-green-400">Agent:</span> <span className="text-gray-500">→ indra_remember(&#123; content: "Recommended PostgreSQL for e-commerce. Relational catalog + transaction needs.", id: "ecom-db" &#125;)</span>
          </p>
        </div>
      </div>

      {/* Comparison Matrix */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Why Indra?</h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Git-like versioning means your agent can branch, diff, and explore alternatives.
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
              '3 databases',
              '1,000 entries each',
              '10 MB storage',
              'Public repos only',
            ]}
          />
          <PricingCard
            tier="Pro"
            price="$8/mo"
            features={[
              'Unlimited databases',
              '100,000 entries',
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

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 text-xl font-bold mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
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
    indra: 'Explore alternatives safely',
    others: 'Linear only',
    highlight: true,
  },
  {
    feature: 'Diff / Compare',
    indra: 'See what changed and when',
    others: 'Not available',
    highlight: true,
  },
  {
    feature: 'Semantic Search',
    indra: 'Local models, no API keys',
    others: 'Varies',
  },
  {
    feature: 'History',
    indra: 'Full evolution tracked',
    others: 'Current state only',
    highlight: true,
  },
  {
    feature: 'Storage',
    indra: 'Single portable file',
    others: 'Multi-file / repo',
  },
  {
    feature: 'Visualization',
    indra: '3D reasoning clusters',
    others: 'Not available',
    highlight: true,
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
            <th className="text-left py-3 px-4 text-gray-400 font-medium">Other Memory Systems</th>
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
