import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ChevronRight, Terminal, Brain, Cloud, Sparkles, GitBranch, Search, BookOpen, Zap, Code } from 'lucide-react'

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
        Get up and running with IndraDB in under 5 minutes. IndraDB is designed primarily for <strong>AI agents</strong> to persist memory across sessions — manual CLI usage is optional.
      </p>

      {/* Agent-first callout */}
      <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-4 mb-8 not-prose">
        <div className="flex gap-3">
          <Brain className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-purple-300 mb-1">Agent-First Design</h3>
            <p className="text-gray-400 text-sm">
              IndraDB is built for AI agents like Claude, GPT, and Codex to autonomously remember context, preferences, and insights. 
              The MCP server lets agents use <code className="text-purple-400">indra_remember</code> and <code className="text-purple-400">indra_search</code> naturally during conversations.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Install */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">1</span>
          Install the CLI & MCP Server
        </h2>
        <p className="text-gray-400 mb-4">
          Install both the CLI and MCP server:
        </p>
        <CodeBlock code={`# Install the CLI (requires Rust)
cargo install indra_db

# Install the MCP server (requires Bun)
bun add -g indra_db_mcp`} />
        <p className="text-gray-500 text-sm mt-2">
          Don't have these? <a href="https://rustup.rs" className="text-purple-400 hover:text-purple-300">Install Rust</a> • <a href="https://bun.sh" className="text-purple-400 hover:text-purple-300">Install Bun</a>
        </p>
      </div>

      {/* Step 2: Initialize in your project */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">2</span>
          Initialize in your project
        </h2>
        <p className="text-gray-400 mb-4">
          Create a <code className="text-purple-400">.indra</code> database in your repository:
        </p>
        <CodeBlock code={`cd your-project
indra init`} />
        <p className="text-gray-500 text-sm mt-2">
          This creates a portable <code className="text-purple-400">.indra</code> file that stores all thoughts with embeddings.
        </p>
      </div>

      {/* Step 3: Configure your agent */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">3</span>
          Configure your AI agent
        </h2>
        <p className="text-gray-400 mb-4">
          Add the MCP server to your agent's configuration. Here's an example for Claude Code:
        </p>
        <CodeBlock code={`# In your project's CLAUDE.md or ~/.claude/CLAUDE.md:

## Memory

Use the Indra MCP tools to remember important context:
- Use \`indra_remember\` to save user preferences, decisions, and insights
- Use \`indra_search\` to recall relevant context before responding

@import node_modules/indra_db_mcp/INDRA_INSTRUCTIONS.md`} />
        <p className="text-gray-500 text-sm mt-2">
          See the <button onClick={() => {}} className="text-purple-400 hover:text-purple-300">MCP Server</button> section for setup guides for Claude Desktop, OpenCode, and Codex.
        </p>
      </div>

      {/* Step 4: Start an agent session */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">4</span>
          Start an agent session
        </h2>
        <p className="text-gray-400 mb-4">
          Launch your agent and let it build context over time:
        </p>
        <CodeBlock code={`# The agent will automatically use Indra during conversations:
# - "Remember that I prefer TypeScript for new projects"
# - "What do you know about my coding preferences?"
# - "Save this architectural decision for future reference"`} />
        <p className="text-gray-500 text-sm mt-2">
          The agent handles memory autonomously — you don't need to manage it manually.
        </p>
      </div>

      {/* Step 5: Sync to IndraDB */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-sm">5</span>
          Visualize & sync (optional)
        </h2>
        <p className="text-gray-400 mb-4">
          Push to IndraDB to visualize your agent's knowledge in 3D:
        </p>
        <CodeBlock code={`# Login to IndraDB
indra login

# Add a remote
indra remote add origin ${user?.name || 'username'}/my-agent-memory

# Push (automatically includes visualization data)
indra push origin`} />
        <p className="text-gray-500 text-sm mt-2">
          {user ? (
            <Link to="/dashboard" className="text-purple-400 hover:text-purple-300">
              View your databases in the dashboard →
            </Link>
          ) : (
            <Link to="/login" className="text-purple-400 hover:text-purple-300">
              Sign up to sync and visualize →
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
            <span>Read the <button onClick={() => {}} className="text-purple-400 hover:text-purple-300">MCP Server</button> docs for detailed agent setup</span>
          </li>
          <li className="flex items-center gap-2 text-gray-400">
            <ChevronRight className="w-4 h-4 text-purple-400" />
            <span>Learn about <button onClick={() => {}} className="text-purple-400 hover:text-purple-300">branching</button> for parallel exploration</span>
          </li>
          <li className="flex items-center gap-2 text-gray-400">
            <ChevronRight className="w-4 h-4 text-purple-400" />
            <span>Explore <button onClick={() => {}} className="text-purple-400 hover:text-purple-300">CLI commands</button> for manual management</span>
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
        Complete reference for the <code className="text-purple-400">indra</code> command line tool.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Global Options</h2>
      <CodeBlock code={`indra [OPTIONS] <COMMAND>

Options:
  -d, --database <PATH>   Path to database file [default: .indra]
  -f, --format <FORMAT>   Output format: json or text [default: json]
  --embedder <PROVIDER>   Embedding provider: hf, mock, openai [default: hf]
  --model <MODEL>         Model name for embedder
  -h, --help              Print help
  -V, --version           Print version`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Core Commands</h2>
      
      <h3 className="text-lg font-medium mt-6 mb-2">init</h3>
      <p className="text-gray-400 mb-2">Initialize a new database:</p>
      <CodeBlock code="indra init" />

      <h3 className="text-lg font-medium mt-6 mb-2">add</h3>
      <p className="text-gray-400 mb-2">Add a thought with optional metadata:</p>
      <CodeBlock code={`indra add "Your thought content"
indra add "A note" --type note
indra add "Important insight" --attrs '{"priority": "high"}'`} />

      <h3 className="text-lg font-medium mt-6 mb-2">search</h3>
      <p className="text-gray-400 mb-2">Semantic search across thoughts:</p>
      <CodeBlock code={`indra search "query text" --limit 10
indra search "user preferences" --threshold 0.7`} />

      <h3 className="text-lg font-medium mt-6 mb-2">list</h3>
      <p className="text-gray-400 mb-2">List all thoughts:</p>
      <CodeBlock code={`indra list
indra list --limit 20`} />

      <h3 className="text-lg font-medium mt-6 mb-2">get</h3>
      <p className="text-gray-400 mb-2">Get a specific thought by ID:</p>
      <CodeBlock code="indra get <thought-id>" />

      <h2 className="text-xl font-semibold mt-8 mb-4">Branching Commands</h2>

      <h3 className="text-lg font-medium mt-6 mb-2">branch</h3>
      <p className="text-gray-400 mb-2">Create and manage branches:</p>
      <CodeBlock code={`indra branch                    # List branches
indra branch experiment         # Create new branch
indra branch -d old-branch      # Delete branch`} />

      <h3 className="text-lg font-medium mt-6 mb-2">checkout</h3>
      <p className="text-gray-400 mb-2">Switch between branches:</p>
      <CodeBlock code="indra checkout experiment" />

      <h3 className="text-lg font-medium mt-6 mb-2">merge</h3>
      <p className="text-gray-400 mb-2">Merge branches:</p>
      <CodeBlock code="indra merge experiment --into main" />

      <h2 className="text-xl font-semibold mt-8 mb-4">Sync Commands</h2>

      <h3 className="text-lg font-medium mt-6 mb-2">login</h3>
      <p className="text-gray-400 mb-2">Authenticate with IndraDB:</p>
      <CodeBlock code="indra login" />

      <h3 className="text-lg font-medium mt-6 mb-2">remote</h3>
      <p className="text-gray-400 mb-2">Manage remotes:</p>
      <CodeBlock code={`indra remote add origin username/repo
indra remote list
indra remote remove origin`} />

      <h3 className="text-lg font-medium mt-6 mb-2">push / pull</h3>
      <p className="text-gray-400 mb-2">Sync with remote:</p>
      <CodeBlock code={`indra push origin           # Push (includes visualization data by default)
indra pull origin          # Pull latest`} />

      <h3 className="text-lg font-medium mt-6 mb-2">clone</h3>
      <p className="text-gray-400 mb-2">Clone a remote database:</p>
      <CodeBlock code="indra clone username/repo" />
    </div>
  )
}

function MCPSection() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">MCP Server</h1>
      <p className="text-gray-400 text-lg mb-8">
        Integrate IndraDB with AI agents using the Model Context Protocol. Supports Claude Code, Claude Desktop, OpenCode, Codex, and any MCP-compatible client.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Installation</h2>
      <p className="text-gray-400 mb-4">
        Install the MCP server globally:
      </p>
      <CodeBlock code={`# Using Bun (recommended)
bun add -g indra_db_mcp

# Or using npm
npm install -g indra_db_mcp`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Claude Code Setup</h2>
      <p className="text-gray-400 mb-4">
        For Claude Code (Anthropic's CLI agent), add to your project's <code className="text-purple-400">CLAUDE.md</code> or global <code className="text-purple-400">~/.claude/CLAUDE.md</code>:
      </p>
      <CodeBlock code={`# CLAUDE.md

## Memory & Context

This project uses IndraDB for persistent memory. Use the Indra tools to:
- Remember important user preferences and decisions
- Search for relevant context before responding
- Track the evolution of understanding over time

@import node_modules/indra_db_mcp/INDRA_INSTRUCTIONS.md`} />
      <p className="text-gray-500 text-sm mt-2">
        Claude Code automatically discovers MCP servers from your project's <code className="text-purple-400">package.json</code> or config.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Claude Desktop Setup</h2>
      <p className="text-gray-400 mb-4">
        Add to your Claude Desktop config at <code className="text-purple-400">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) or <code className="text-purple-400">%APPDATA%\\Claude\\claude_desktop_config.json</code> (Windows):
      </p>
      <CodeBlock code={`{
  "mcpServers": {
    "indra": {
      "command": "bunx",
      "args": ["-y", "indra_db_mcp"],
      "env": {
        "INDRA_DB_PATH": "~/.indra"
      }
    }
  }
}`} />
      <p className="text-gray-500 text-sm mt-2">
        Restart Claude Desktop after saving. The Indra tools will appear in Claude's tool palette.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">OpenCode Setup</h2>
      <p className="text-gray-400 mb-4">
        For OpenCode, add to <code className="text-purple-400">~/.config/opencode/opencode.json</code> or your project's <code className="text-purple-400">opencode.json</code>:
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

      <h2 className="text-xl font-semibold mt-8 mb-4">Codex Setup</h2>
      <p className="text-gray-400 mb-4">
        For OpenAI Codex and compatible clients, configure the MCP server in your agent's tool configuration:
      </p>
      <CodeBlock code={`{
  "tools": {
    "mcp": {
      "servers": {
        "indra": {
          "command": "bunx",
          "args": ["-y", "indra_db_mcp"],
          "env": {
            "INDRA_DB_PATH": "./.indra"
          }
        }
      }
    }
  }
}`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Generic MCP Client</h2>
      <p className="text-gray-400 mb-4">
        For any MCP-compatible client, use this standard configuration:
      </p>
      <CodeBlock code={`{
  "mcpServers": {
    "indra": {
      "command": "bunx",
      "args": ["-y", "indra_db_mcp"],
      "env": {
        "INDRA_DB_PATH": "/path/to/.indra"
      }
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
              <td className="py-2 px-3 text-gray-400">Path to .indra database</td>
              <td className="py-2 px-3 text-gray-500">./.indra</td>
            </tr>
            <tr className="border-b border-gray-800/50">
              <td className="py-2 px-3 font-mono text-purple-400">INDRA_API_URL</td>
              <td className="py-2 px-3 text-gray-400">API endpoint for sync</td>
              <td className="py-2 px-3 text-gray-500">https://api.indradb.net</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Available Tools</h2>
      <p className="text-gray-400 mb-4">
        The MCP server exposes these tools to AI agents:
      </p>

      <div className="space-y-4">
        <ToolCard 
          name="indra_remember" 
          description="Save information to improve future conversations. Automatically creates embeddings for semantic search."
          params={['content: string', 'type?: string', 'attrs?: object']}
        />
        <ToolCard 
          name="indra_search" 
          description="Recall what you know about this user and topic. Use '*' to list all notes."
          params={['query: string', 'limit?: number']}
        />
        <ToolCard 
          name="indra_status" 
          description="Check database status - current branch, note count, sync state."
          params={[]}
        />
        <ToolCard 
          name="indra_branch" 
          description="Create, switch, or list branches for parallel exploration."
          params={['action: create|switch|list', 'name?: string']}
        />
        <ToolCard 
          name="indra_experiment" 
          description="Quick sandbox - creates and switches to a new branch in one step."
          params={['name: string']}
        />
        <ToolCard 
          name="indra_history" 
          description="View how notes evolved over time."
          params={['limit?: number']}
        />
        <ToolCard 
          name="indra_diff" 
          description="Compare two points in history to see what changed."
          params={['from: string', 'to?: string']}
        />
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Example Usage</h2>
      <p className="text-gray-400 mb-4">
        Once configured, AI agents can use IndraDB naturally:
      </p>
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
        <div>
          <p className="text-gray-300 italic">
            "Remember that the user prefers TypeScript over JavaScript for new projects."
          </p>
          <p className="text-gray-500 text-sm mt-1">
            → Agent uses <code className="text-purple-400">indra_remember</code> to store this preference
          </p>
        </div>
        <div>
          <p className="text-gray-300 italic">
            "What are this user's coding preferences?"
          </p>
          <p className="text-gray-500 text-sm mt-1">
            → Agent uses <code className="text-purple-400">indra_search</code> to find relevant context
          </p>
        </div>
        <div>
          <p className="text-gray-300 italic">
            "Let me explore an alternative approach..."
          </p>
          <p className="text-gray-500 text-sm mt-1">
            → Agent uses <code className="text-purple-400">indra_experiment</code> to create a sandbox branch
          </p>
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
      <div className="mt-2 flex flex-wrap gap-2">
        {params.map((param, i) => (
          <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded font-mono">
            {param}
          </span>
        ))}
      </div>
    </div>
  )
}

function WebSection() {
  return (
    <div className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-2">Web Platform</h1>
      <p className="text-gray-400 text-lg mb-8">
        Visualize and analyze your thought databases in the browser.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Features</h2>
      
      <div className="grid md:grid-cols-2 gap-4 not-prose">
        <FeatureCard 
          icon={<Sparkles className="w-6 h-6 text-purple-400" />}
          title="3D Visualization"
          description="See your thoughts as a 3D point cloud, clustered by semantic similarity using PCA."
        />
        <FeatureCard 
          icon={<GitBranch className="w-6 h-6 text-purple-400" />}
          title="Branch Comparison"
          description="Visualize different branches and see how thoughts diverge across explorations."
        />
        <FeatureCard 
          icon={<Search className="w-6 h-6 text-purple-400" />}
          title="Semantic Search"
          description="Search across all your synced databases with natural language queries."
        />
        <FeatureCard 
          icon={<Brain className="w-6 h-6 text-purple-400" />}
          title="Cluster Analysis"
          description="Automatic k-means clustering to identify topic groups in your knowledge."
        />
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4">Pricing Tiers</h2>
      
      <div className="not-prose">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Feature</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Hobby (Free)</th>
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
              <td className="py-3 px-4">Thoughts per database</td>
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
              <td className="py-3 px-4">API Access</td>
              <td className="py-3 px-4 text-gray-500">—</td>
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
        Understanding IndraDB's architecture and data model.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Thoughts</h2>
      <p className="text-gray-400 mb-4">
        A <strong>thought</strong> is the fundamental unit of data in IndraDB. Each thought contains:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li><strong>Content</strong> - The text content of the thought</li>
        <li><strong>Embedding</strong> - A vector representation for semantic search (auto-generated)</li>
        <li><strong>Type</strong> - Optional categorization (note, insight, decision, etc.)</li>
        <li><strong>Attributes</strong> - Arbitrary JSON metadata</li>
        <li><strong>ID</strong> - Content-addressed hash (changes if content changes)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Edges</h2>
      <p className="text-gray-400 mb-4">
        <strong>Edges</strong> represent relationships between thoughts:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li><strong>Type</strong> - The kind of relationship (references, contradicts, supports, etc.)</li>
        <li><strong>Weight</strong> - Strength of the relationship (0.0 to 1.0)</li>
        <li><strong>Directed</strong> - Whether the relationship has direction</li>
      </ul>
      <CodeBlock code={`# Create a relationship
indra relate <thought-a> <thought-b> --type "supports" --weight 0.8`} />

      <h2 className="text-xl font-semibold mt-8 mb-4">Commits</h2>
      <p className="text-gray-400 mb-4">
        Like Git, IndraDB uses <strong>commits</strong> to track changes over time:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li>Every mutation creates a new commit</li>
        <li>Commits are content-addressed (immutable)</li>
        <li>You can view history with <code className="text-purple-400">indra log</code></li>
        <li>Compare commits with <code className="text-purple-400">indra diff</code></li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Branches</h2>
      <p className="text-gray-400 mb-4">
        <strong>Branches</strong> enable parallel exploration:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li>Create branches to explore different reasoning paths</li>
        <li>Each branch maintains its own commit history</li>
        <li>Merge successful explorations back to main</li>
        <li>Perfect for A/B testing AI reasoning strategies</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Embeddings</h2>
      <p className="text-gray-400 mb-4">
        IndraDB generates <strong>embeddings</strong> automatically using local models:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li><strong>Default</strong>: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)</li>
        <li><strong>No API keys needed</strong> - runs entirely locally</li>
        <li><strong>Offline-first</strong> - works without internet</li>
        <li>Optional: Use OpenAI, Cohere, or Voyage APIs with <code className="text-purple-400">--embedder</code></li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">The .indra File</h2>
      <p className="text-gray-400 mb-4">
        Everything is stored in a single <code className="text-purple-400">.indra</code> file:
      </p>
      <ul className="text-gray-400 space-y-2">
        <li><strong>Portable</strong> - Copy it anywhere, it just works</li>
        <li><strong>Compressed</strong> - Uses zstd compression</li>
        <li><strong>Content-addressed</strong> - Efficient deduplication</li>
        <li><strong>Git-friendly</strong> - Can be versioned (though binary)</li>
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
