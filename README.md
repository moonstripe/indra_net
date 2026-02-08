# IndraNet

A GitHub-like platform for `.indra` reasoning trace databases.

## Architecture

```
indra_net/
├── apps/
│   ├── api/           # Cloudflare Workers + Hono + D1
│   └── web/           # React + Vite + TailwindCSS
├── packages/
│   └── shared/        # Shared types, utils
└── turbo.json         # Turborepo config
```

## Key Features

- **Visualization**: Server-side PCA reduces embeddings to 3D positions
- **Sync**: Push/pull `.indra` files from CLI
- **OAuth**: GitHub and Google authentication
- **Analytics**: Thought patterns, activity timelines (coming soon)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| API | Cloudflare Workers | Edge-first, serverless, global distribution |
| Database | Cloudflare D1 (SQLite) | Zero-config, automatic replication, SQL |
| Blob Storage | Cloudflare R2 | S3-compatible, stores `.indra` files |
| Frontend | React + Vite | Fast iteration, mature ecosystem |
| Styling | TailwindCSS | Utility-first, rapid UI development |
| Auth | Cloudflare Access + OAuth | GitHub/Google login |
| Payments | Stripe | Industry standard |

## Development

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Deploy API to Cloudflare
pnpm --filter api deploy

# Build and deploy web
pnpm --filter web build
```

## Data Model

### Core Entities

```
User
├── id (uuid)
├── email
├── name
├── github_id (optional)
├── google_id (optional)
├── tier (hobby | pro | enterprise)
├── stripe_customer_id
└── created_at

IndraBase (a remote .indra database)
├── id (uuid)
├── owner_id → User
├── name
├── description
├── visibility (public | private)
├── storage_key (R2 path)
├── size_bytes
├── thought_count
├── created_at
└── updated_at

Thought (denormalized for search/analytics)
├── id (uuid)
├── base_id → IndraBase
├── thought_id (from .indra)
├── content
├── embedding (vector, for similarity search)
├── created_at
└── committed_at

Commit (for history tracking)
├── id (uuid)
├── base_id → IndraBase
├── hash
├── message
├── author
├── timestamp
└── parent_hash

ApiKey
├── id (uuid)
├── user_id → User
├── name
├── key_hash
├── last_used
└── created_at
```

## API Endpoints (v1)

### Auth
- `POST /auth/github` - GitHub OAuth callback
- `POST /auth/google` - Google OAuth callback
- `POST /auth/logout` - End session
- `GET /auth/me` - Get current user

### Users
- `GET /users/:id` - Get user profile
- `PATCH /users/:id` - Update profile

### IndraBases
- `GET /bases` - List user's databases
- `POST /bases` - Create new database
- `GET /bases/:id` - Get database details
- `PATCH /bases/:id` - Update database metadata
- `DELETE /bases/:id` - Delete database

### Sync (for `indra push/pull`)
- `POST /bases/:id/push` - Upload .indra file
- `GET /bases/:id/pull` - Download .indra file
- `GET /bases/:id/status` - Get remote status (HEAD hash, etc.)

### Visualization
- `GET /bases/:id/viz` - Get 3D positions (computed server-side via PCA)
- `GET /bases/:id/commits` - Get commit history
- `GET /bases/:id/thoughts` - Get thoughts list

### Analytics (Phase 4)
- `GET /bases/:id/thoughts` - List thoughts (paginated)
- `GET /bases/:id/search` - Semantic search
- `GET /bases/:id/timeline` - Activity over time
- `GET /bases/:id/topics` - Topic clusters

### Billing
- `POST /billing/checkout` - Create Stripe checkout session
- `POST /billing/portal` - Access Stripe customer portal
- `POST /billing/webhook` - Stripe webhook handler

## Billing Tiers

| Feature | Hobby (Free) | Pro ($10/mo) | Enterprise |
|---------|-------------|--------------|------------|
| Databases | 1 | Unlimited | Unlimited |
| Thoughts | 1,000 | 100,000 | Unlimited |
| Storage | 10 MB | 1 GB | Custom |
| API Access | No | Yes | Yes |
| Analytics | Basic | Full | Full + Custom |
| Support | Community | Email | Dedicated |
| SSO | No | No | Yes |
| Audit Logs | No | No | Yes |
