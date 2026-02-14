import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ChevronRight, Terminal, Brain, Cloud, GitBranch, Search, BookOpen, Zap, Code } from 'lucide-react'

type DocSection = 'quickstart' | 'cli' | 'mcp' | 'web' | 'concepts'

export default function Docs() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<DocSection>('quickstart')

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <nav className="lg:w-64 flex-shrink-0">
            <div className="sticky top-8">
              <h2 className="text-lg font-semibold mb-4">Documentation</h2>
              <ul className="space-y-1">
                <NavItem 
                  icon={<Zap className="w-4 h-4" />}
                  label="Quickstart" 
                  section="quickstart" 
                  active={activeSection} 
                  onClick={setActiveSection} 
                />
                <NavItem 
                  icon={<Terminal className="w-4 h-4" />}
                  label="CLI Reference" 
                  section="cli" 
                  active={activeSection} 
                  onClick={setActiveSection} 
                />
                <NavItem 
                  icon={<Code className="w-4 h-4" />}
                  label="MCP Server" 
                  section="mcp" 
                  active={activeSection} 
                  onClick={setActiveSection} 
                />
                <NavItem 
                  icon={<Cloud className="w-4 h-4" />}
                  label="Web Platform" 
                  section="web" 
                  active={activeSection} 
                  onClick={setActiveSection} 
                />
                <NavItem 
                  icon={<BookOpen className="w-4 h-4" />}
                  label="Concepts" 
                  section="concepts" 
                  active={activeSection} 
                  onClick={setActiveSection} 
                />
              </ul>
              
              <div className="mt-8 p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg">
                <p className="text-sm text-purple-300 mb-2">Need help?</p>
                <a 
                  href="https://github.com/moonstripe/indra_db/issues"
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Open an issue on GitHub →
                </a>
              </div>
            </div>
          </nav>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {activeSection === 'quickstart' && <QuickstartSection user={user} />}
            {activeSection === 'cli' && <CLISection />}
            {activeSection === 'mcp' && <MCPSection />}
            {activeSection === 'web' && <WebSection />}
            {activeSection === 'concepts' && <ConceptsSection />}
          </main>
        </div>
      </div>
    </div>
  )
}

function NavItem({ 
  icon, 
  label, 
  section, 
  active, 
  onClick 
}: { 
  icon: React.ReactNode
  label: string
  section: DocSection
  active: DocSection
  onClick: (section: DocSection) => void 
}) {
  const isActive = active === section
  return (
    <li>
      <button
        onClick={() => onClick(section)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          isActive 
            ? 'bg-purple-600 text-white' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        {icon}
        {label}
      </button>
    </li>
  )
}

function QuickstartSection({ user }: { user: any }) {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">Quickstart</h1>
      <p className="text-gray-400 text-lg mb-8">
        Give your AI agent persistent memory in under 5 minutes.
      </p>

      {/* What Indra Does */}
      <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4 mb-8 not-prose">
        <div className="flex gap-3">
          <Brain className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-purple-300 mb-1">What Indra Does</h3>
            <p className="text-gray-400 text-sm">
              Indra gives your AI agent memory that persists across sessions. The agent uses <code className="text-purple-400">indra_remember</code> to record its reasoning and <code className="text-purple-400">indra_search</code> to recall past decisions. It can also branch to explore alternatives without losing its main thread.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Install */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">1</span>
          Install
        </h2>
        <CodeBlock code={`# Install the CLI (requires Rust)
cargo install indra_db

# Install the MCP server (requires Bun)
bun add -g indra_db_mcp`} />
        <p className="text-gray-500 text-sm mt-2">
          <a href="https://rustup.rs" className="text-purple-400 hover:text-purple-300">Install Rust</a> • <a href="https://bun.sh" className="text-purple-400 hover:text-purple-300">Install Bun</a>
        </p>
      </div>

      {/* Step 2: Configure */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">2</span>
          Configure Your Agent
        </h2>
        <p className="text-gray-400 mb-4">
          Add the MCP server to your agent. For Claude Code:
        </p>
        <CodeBlock code={`# Add to your project's CLAUDE.md:
@import node_modules/indra_db_mcp/INDRA_INSTRUCTIONS.md`} />
        <p className="text-gray-500 text-sm mt-2">
          See the <button className="text-purple-400 hover:text-purple-300">MCP Server</button> section for Claude Desktop, OpenCode, and Codex setup.
        </p>
      </div>

      {/* Step 3: Use */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">3</span>
          Use Naturally
        </h2>
        <p className="text-gray-400 mb-4">
          Your agent now has memory tools. It will use them when relevant:
        </p>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3 text-sm font-mono">
          <p className="text-gray-300">
            <span className="text-purple-400">User:</span> Should I use PostgreSQL or MongoDB?
          </p>
          <p className="text-gray-500">
            → Agent searches for past database decisions
          </p>
          <p className="text-gray-500">
            → Agent makes recommendation based on context
          </p>
          <p className="text-gray-500">
            → Agent records its reasoning for future reference
          </p>
        </div>
      </div>

      {/* Step 4: Visualize (Optional) */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">4</span>
          Visualize (Optional)
        </h2>
        <p className="text-gray-400 mb-4">
          Push to IndraDB to see your agent's reasoning in 3D:
        </p>
        <CodeBlock code={`indra login
indra remote add origin ${user?.name || 'username'}/my-agent
indra push origin`} />
        <p className="text-gray-500 text-sm mt-2">
          {user ? (
            <Link to="/dashboard" className="text-purple-400 hover:text-purple-300">
              View your databases →
            </Link>
          ) : (
            <Link to="/login" className="text-purple-400 hover:text-purple-300">
              Sign up to visualize →
            </Link>
          )}
        </p>
      </div>

      {/* Next steps */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mt-8">
        <h3 className="font-semibold mb-4">Next Steps</h3>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-gray-400">
            <ChevronRight className="w-4 h-4 text-purple-400" />
            <span>Read about <button className="text-purple-400 hover:text-purple-300">branching</button> for exploring alternatives</span>
          </li>
          <li className="flex items-center gap-2 text-gray-400">
            <ChevronRight className="w-4 h-4 text-purple-400" />
            <span>See all <button className="text-purple-400 hover:text-purple-300">MCP tools</button> available to your agent</span>
          </li>
          <li className="flex items-center gap-2 text-gray-400">
            <ChevronRight className="w-4 h-4 text-purple-400" />
            <span>Learn <button className="text-purple-400 hover:text-purple-300">key concepts</button> like commits and semantic search</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function CLISection() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">CLI Reference</h1>
      <p className="text-gray-400 text-lg mb-8">
        Manual commands for the <code className="text-purple-400">indra</code> CLI. Usually your agent uses these through the MCP server.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Core Commands</h2>
      
      <h3 className="text-lg font-medium mt-6 mb-2">init</h3>
      <p className="text-gray-400 mb-2">Initialize a new database:</p>
      <CodeBlock code="indra init" />

      <h3 className="text-lg font-medium mt-6 mb-2">create</h3>
      <p className="text-gray-400 mb-2">Create an entry:</p>
      <CodeBlock code={`indra create "Your content here"
indra create "With ID" --id my-id`} />

      <h3 className="text-lg font-medium mt-6 mb-2">search</h3>
      <p className="text-gray-400 mb-2">Semantic search:</p>
      <CodeBlock code={`indra search "query" --limit 10`} />

      <h3 className="text-lg font-medium mt-6 mb-2">list</h3>
      <p className="text-gray-400 mb-2">List all entries:</p>
      <CodeBlock code="indra list" />

      <h2 className="text-xl font-semibold mt-8 mb-4">Branching</h2>

      <h3 className="text-lg font-medium mt-6 mb-2">branch</h3>
      <p className="text-gray-400 mb-2">Create or list branches:</p>
      <CodeBlock code={`indra branch                    # List
indra branch experiment         # Create`} />

      <h3 className="text-lg font-medium mt-6 mb-2">checkout</h3>
      <p className="text-gray-400 mb-2">Switch branches:</p>
      <CodeBlock code="indra checkout experiment" />

      <h3 className="text-lg font-medium mt-6 mb-2">diff</h3>
      <p className="text-gray-400 mb-2">Compare branches or commits:</p>
      <CodeBlock code={`indra diff main experiment
indra diff abc123 def456`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Sync</h2>

      <h3 className="text-lg font-medium mt-6 mb-2">login</h3>
      <p className="text-gray-400 mb-2">Authenticate with IndraDB:</p>
      <CodeBlock code="indra login" />

      <h3 className="text-lg font-medium mt-6 mb-2">remote / push / pull</h3>
      <p className="text-gray-400 mb-2">Sync with cloud:</p>
      <CodeBlock code={`indra remote add origin username/repo
indra push origin
indra pull origin`} />
    </div>
  )
}

function MCPSection() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">MCP Server</h1>
      <p className="text-gray-400 text-lg mb-8">
        The MCP server gives your AI agent memory tools. Configure it once, then the agent uses it naturally.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Installation</h2>
      <CodeBlock code={`bun add -g indra_db_mcp`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Configuration</h2>

      <h3 className="text-lg font-medium mt-6 mb-2">Claude Code</h3>
      <p className="text-gray-400 mb-4">
        Add to <code className="text-purple-400">CLAUDE.md</code>:
      </p>
      <CodeBlock code={`@import node_modules/indra_db_mcp/INDRA_INSTRUCTIONS.md`} />

      <h3 className="text-lg font-medium mt-6 mb-2">Claude Desktop</h3>
      <p className="text-gray-400 mb-4">
        Add to <code className="text-purple-400">claude_desktop_config.json</code>:
      </p>
      <CodeBlock code={`{
  "mcpServers": {
    "indra": {
      "command": "bunx",
      "args": ["-y", "indra_db_mcp"]
    }
  }
}`} />

      <h3 className="text-lg font-medium mt-6 mb-2">OpenCode</h3>
      <p className="text-gray-400 mb-4">
        Add to <code className="text-purple-400">opencode.json</code>:
      </p>
      <CodeBlock code={`{
  "mcpServers": {
    "indra": {
      "command": ["bunx", "-y", "indra_db_mcp"],
      "type": "local"
    }
  },
  "instructions": ["node_modules/indra_db_mcp/INDRA_INSTRUCTIONS.md"]
}`} />

      <h3 className="text-lg font-medium mt-6 mb-2">Generic MCP Client</h3>
      <CodeBlock code={`{
  "mcpServers": {
    "indra": {
      "command": "bunx",
      "args": ["-y", "indra_db_mcp"],
      "env": { "INDRA_DB_PATH": "./.indra" }
    }
  }
}`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Environment Variables</h2>
      <div className="not-prose">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400">Variable</th>
              <th className="text-left py-2 px-3 text-gray-400">Description</th>
              <th className="text-left py-2 px-3 text-gray-400">Default</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-800/50">
              <td className="py-2 px-3 font-mono text-purple-400">INDRA_DB_PATH</td>
              <td className="py-2 px-3 text-gray-400">Database file path</td>
              <td className="py-2 px-3 text-gray-500">./.indra</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-2 px-3 font-mono text-purple-400">INDRA_API_URL</td>
              <td className="py-2 px-3 text-gray-400">Sync endpoint</td>
              <td className="py-2 px-3 text-gray-500">https://api.indradb.net</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Available Tools</h2>

      <div className="space-y-4">
        <ToolCard 
          name="indra_remember" 
          description="Record reasoning, decisions, and insights. Creates embeddings for semantic search."
          params={['content: string', 'id?: string']}
        />
        <ToolCard 
          name="indra_search" 
          description="Find past reasoning by meaning. Use '*' to list all."
          params={['query: string', 'limit?: number']}
        />
        <ToolCard 
          name="indra_status" 
          description="Check current branch, entry count, and sync state."
          params={[]}
        />
        <ToolCard 
          name="indra_branch" 
          description="Create, switch, or list branches for parallel exploration."
          params={['action: create|switch|list', 'name?: string']}
        />
        <ToolCard 
          name="indra_experiment" 
          description="Create and switch to a new branch in one step."
          params={['name: string']}
        />
        <ToolCard 
          name="indra_history" 
          description="View how reasoning evolved over time."
          params={['limit?: number']}
        />
        <ToolCard 
          name="indra_diff" 
          description="Compare two points in history."
          params={['from?: string', 'to?: string']}
        />
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Example: Agent Making Decisions</h2>
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4 text-sm font-mono">
        <div>
          <p className="text-purple-400">User: Should I use microservices or a monolith?</p>
        </div>
        <div>
          <p className="text-gray-500">→ indra_search(&#123; query: "architecture decisions" &#125;)</p>
          <p className="text-gray-600 ml-4">Found: "Recommended monolith-first for small teams..."</p>
        </div>
        <div>
          <p className="text-gray-300">Agent: Based on your team size and my previous analysis, I recommend starting with a monolith...</p>
        </div>
        <div>
          <p className="text-gray-500">→ indra_remember(&#123;</p>
          <p className="text-gray-500 ml-4">content: "Recommended monolith for this project. Team of 3, need fast iteration.",</p>
          <p className="text-gray-500 ml-4">id: "arch-decision"</p>
          <p className="text-gray-500">&#125;)</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Example: Branching for Exploration</h2>
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4 text-sm font-mono">
        <div>
          <p className="text-gray-300">Agent: Let me explore an alternative approach...</p>
        </div>
        <div>
          <p className="text-gray-500">→ indra_experiment(&#123; name: "try-nosql" &#125;)</p>
        </div>
        <div>
          <p className="text-gray-600">[Agent explores MongoDB path, records reasoning]</p>
        </div>
        <div>
          <p className="text-gray-500">→ indra_diff(&#123; from: "main" &#125;)</p>
          <p className="text-gray-600 ml-4">Shows what's different from main reasoning</p>
        </div>
        <div>
          <p className="text-gray-500">→ indra_branch(&#123; action: "switch", name: "main" &#125;)</p>
          <p className="text-gray-600 ml-4">Back to main thread</p>
        </div>
      </div>
    </div>
  )
}

function ToolCard({ name, description, params }: { name: string; description: string; params: string[] }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <h3 className="font-mono text-purple-400 font-medium">{name}</h3>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
      {params.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {params.map((param, i) => (
            <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded font-mono">
              {param}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function WebSection() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">Web Platform</h1>
      <p className="text-gray-400 text-lg mb-8">
        Visualize your agent's reasoning in 3D. See clusters form, track evolution, analyze patterns.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Features</h2>
      
      <div className="grid md:grid-cols-2 gap-4 not-prose">
        <FeatureCard 
          icon={<Brain className="w-6 h-6 text-purple-400" />}
          title="3D Visualization"
          description="See reasoning as a point cloud, clustered by semantic similarity."
        />
        <FeatureCard 
          icon={<GitBranch className="w-6 h-6 text-purple-400" />}
          title="Branch Comparison"
          description="Visualize different reasoning paths side by side."
        />
        <FeatureCard 
          icon={<Search className="w-6 h-6 text-purple-400" />}
          title="Search Across Databases"
          description="Find relevant reasoning across all your synced agents."
        />
        <FeatureCard 
          icon={<Brain className="w-6 h-6 text-purple-400" />}
          title="Cluster Analysis"
          description="Automatic grouping reveals topic patterns in reasoning."
        />
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Pricing</h2>
      
      <div className="not-prose">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Feature</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Free</th>
              <th className="text-left py-3 px-4 text-purple-400 font-medium">Pro ($8/mo)</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-gray-800/50">
              <td className="py-3 px-4">Databases</td>
              <td className="py-3 px-4 text-gray-400">3</td>
              <td className="py-3 px-4">Unlimited</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-3 px-4">Entries per database</td>
              <td className="py-3 px-4 text-gray-400">1,000</td>
              <td className="py-3 px-4">100,000</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-3 px-4">Storage</td>
              <td className="py-3 px-4 text-gray-400">10 MB</td>
              <td className="py-3 px-4">1 GB</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-3 px-4">3D Visualization</td>
              <td className="py-3 px-4 text-green-400">✓</td>
              <td className="py-3 px-4 text-green-400">✓</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-3 px-4">Private Databases</td>
              <td className="py-3 px-4 text-gray-500">—</td>
              <td className="py-3 px-4 text-green-400">✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="mb-2">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}

function ConceptsSection() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">Concepts</h1>
      <p className="text-gray-400 text-lg mb-8">
        Key ideas behind Indra's design.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Entries</h2>
      <p className="text-gray-400 mb-4">
        An entry is a piece of recorded reasoning. Each contains:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li><strong>Content</strong> — The reasoning text</li>
        <li><strong>Embedding</strong> — Vector for semantic search (auto-generated)</li>
        <li><strong>ID</strong> — Content-addressed hash (or custom ID)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Commits</h2>
      <p className="text-gray-400 mb-4">
        Every change creates a commit. This means:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li>Full history is preserved</li>
        <li>You can diff between any two points</li>
        <li>Nothing is truly deleted (just unreferenced)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Branches</h2>
      <p className="text-gray-400 mb-4">
        Branches let you explore alternatives:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li>Create a branch before risky exploration</li>
        <li>Each branch has its own history</li>
        <li>Compare branches to see divergence</li>
        <li>Switch back when done experimenting</li>
      </ul>
      <CodeBlock code={`# Typical branching workflow
indra branch experiment
indra checkout experiment
# ... make changes ...
indra diff main          # compare with main
indra checkout main      # back to main`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Semantic Search</h2>
      <p className="text-gray-400 mb-4">
        Search finds entries by meaning, not keywords:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li>Uses local HF model (no API keys needed)</li>
        <li>"Database choice" finds "PostgreSQL recommendation"</li>
        <li>Scores show relevance (0-1)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">The .indra File</h2>
      <p className="text-gray-400 mb-4">
        Everything in one portable file:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li>Copy anywhere, it just works</li>
        <li>Content-addressed (efficient deduplication)</li>
        <li>Compressed with zstd</li>
        <li>Can sync to IndraDB cloud</li>
      </ul>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-x-auto">
      <code className="text-sm text-green-400 font-mono">{code}</code>
    </pre>
  )
}
