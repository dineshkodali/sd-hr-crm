# SD HR CRM - Human Resources & Case Management System

[![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.x-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-336791.svg)](https://www.postgresql.org/)

An enterprise-grade, lightweight HR and Case Management System designed for properties, staff tracking, HSE compliance, and service user (client) workflows. Built with a modern React 19 (Vite) SPA frontend, Node.js/Express (ESM) backend, and a high-performance PostgreSQL database catalog.

For detailed step-by-step breakdowns of all workflows, actors, actions, and system responses with structured tables, see the [App Flow & Feature Workflows](./docs/app_flow.md) document.

---

## 📂 Repository Directory Structure

```text
sd-hr-crm/
├── .dockerignore            # Optimized build context exclusions
├── .env.example             # Unified environment variable template
├── package.json             # Root npm workspace definitions & lifecycle scripts
├── README.md                # Project documentation & quickstart guide
│
├── Backend/                 # Express.js REST API service
│   ├── config/              # Database pool configuration & security options
│   ├── controllers/         # Request handling & business logic
│   ├── middleware/          # JWT auth, role RBAC, CORS & rate limiters
│   ├── routes/              # Modular API endpoints
│   ├── utils/               # Helper routines (logger, email, tokens)
│   ├── Dockerfile           # Standalone Backend microservice Dockerfile
│   └── server.js            # Express application entrypoint
│
├── frontend/                # React 19 + Vite single page application
│   ├── components/          # Reusable UI components & layouts
│   ├── pages/               # Route components (50+ lazy-loaded views)
│   ├── src/                 # Main app bootstrapping & global context
│   ├── Dockerfile           # Standalone Frontend Nginx Dockerfile
│   └── vite.config.js       # Vite bundler configuration & asset splitting
│
├── database/                # SQL schema migrations & seed scripts
│   ├── database_init.sql    # Core database initialization script
│   └── docker-init-db.sql   # Docker postgres auto-init entrypoint
│
├── deployment/              # Production & Docker deployment suite
│   ├── docker/              # Docker multi-stage builds & compose files
│   │   ├── Dockerfile       # Combined multi-stage production Dockerfile
│   │   ├── docker-compose.yml     # Production multi-container compose configuration
│   │   └── docker-compose.dev.yml # Development compose configuration with HMR
│   ├── nginx/               # Nginx reverse proxy & static serving config
│   └── amplify.yml          # AWS Amplify build spec
│
├── docs/                    # System documentation & workflows
│   ├── app_flow.md          # End-to-end feature workflow matrix
│   └── DEPLOYMENT.md        # Comprehensive cloud deployment instructions
│
├── scripts/                 # Maintenance & migration utilities
└── qa/                      # Automated test scripts & QA test reports
```

---

## 🚀 System Architecture & Technology Stack

The application employs a decoupled, multi-stage architecture optimized for minimal latency, high security, and container portability:

*   **Frontend**: React 19 (Vite SPA), structured with dynamic code-splitting (`React.lazy`) across 50+ routes. Styled with Tailwind CSS, Lucide icons, and Recharts analytics.
*   **Backend**: Node.js & Express (ESM), featuring JWT session security, HTTP-only cookie authentication, CORS middleware, and input sanitization.
*   **Database**: PostgreSQL 16, utilizing custom migration scripts, connection pooling (PGPool), and JSON query streams for high-throughput reporting.
*   **Containerization**: Multi-stage, ultra-lightweight Docker builds (`node:22-alpine` and `nginx:alpine`) using `tini` signal handling, non-root user execution, security headers, and gzipped static assets.

---

## ⚡ Quickstart (Local & Docker)

### Option A: Docker Deployment (Recommended)

Run the full stack (Frontend, Backend API, and Database) with a single command:

```bash
# 1. Copy environment configuration template
cp .env.example .env

# 2. Build lightweight multi-stage container images
npm run docker:build

# 3. Launch services in background
npm run docker:up

# 4. View container logs
npm run docker:logs
```

*   **Frontend Web App**: `http://localhost:3002/`
*   **Backend REST API**: `http://localhost:4000/api`
*   **PostgreSQL Database**: `localhost:5432`

To stop the containers:
```bash
npm run docker:down
```

---

### Option B: Local Node.js Development

```bash
# 1. Install root and workspace dependencies
npm run install-all

# 2. Setup Backend environment variables
cp .env.example Backend/.env

# 3. Apply schema migrations
node Backend/run-migration.js

# 4. Start concurrent development servers
npm run dev
```

*   **Frontend Dev Server**: `http://localhost:3002/`
*   **Backend API Server**: `http://localhost:4000/`

---

## 🔑 Environment Variables Configuration

Refer to [.env.example](./.env.example) for a complete template:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Backend HTTP server port | `4000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `production` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your-secret-key` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@host:5432/dbname` |
| `VITE_API_URL` | Frontend API endpoint URL | `http://localhost:4000/api` |
| `SMTP_HOST` | Email server host for shift handovers & alerts | `smtp.gmail.com` |

---

## 🛠️ Testing & Quality Assurance

Run the automated test suite and generate HTML QA reports:

```bash
npm run qa
```

Test reports are output to `qa/qa-test-report.html`.

---

## 📄 License & Maintainers

Maintained by **SD Commercial Operations**. All rights reserved.
