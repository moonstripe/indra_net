import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()

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
            IndraNet is a GitHub-like platform for <code className="text-purple-400">.indra</code> databases. 
            Track what your AI agents are thinking, storing, and how their understanding evolves over time.
          </p>

          <div className="mt-10 flex justify-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
              >
                Get Started Free
              </Link>
            )}
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
            icon="🧠"
            title="Track AI Memory"
            description="See exactly what your AI agents remember across sessions. Every thought, every insight, versioned and searchable."
          />
          <FeatureCard
            icon="🔄"
            title="Sync Everywhere"
            description="Push and pull .indra databases like git repos. Keep your agents' knowledge in sync across machines."
          />
          <FeatureCard
            icon="📊"
            title="Analyze Reasoning"
            description="Visualize how understanding evolves. Detect semantic drift, cluster topics, and understand your AI better."
          />
        </div>
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
            price="$10/mo"
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

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
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
            <span className="text-purple-400">✓</span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
