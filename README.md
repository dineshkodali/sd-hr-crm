# SD HR CRM - Human Resources & Case Management System

A enterprise-grade, comprehensive HR and Case Management System designed for properties, staff tracking, HSE compliance, and service user (client) workflows. Built with a modern React (Vite) frontend, Node.js/Express (ESM) backend, and a secure PostgreSQL database catalog.

For a detailed step-by-step breakdown of all workflows, actors, actions, and system responses with structured tables, see the [App Flow & Feature Workflows](./app_flow.md) document.

---

## 🚀 System Architecture & Technology Stack

The application employs a decoupled architecture optimized for low-latency delivery and developer experience:

*   **Frontend**: React 19 (Vite-powered SPA), structured with dynamic code-splitting and dynamic `React.lazy` loading for all 50+ routes to achieve near-instant initial page loads. Tailwind CSS v4 styling, Lucide icons, and Recharts visualization.
*   **Backend**: Node.js & Express (ESM modules), utilizing token-based session management, cookies, and CORS filters.
*   **Database**: PostgreSQL 12+, managed via custom schema migrations with connection tuning and connection pool caching (PGPool).
*   **Security**: Encrypted environment files, salted hashing (bcryptjs), secure Cookie/Header authentication, and role-based route guards (Admin, Manager, Staff).

---

## 🗺️ App Features and Workflows

### 1. Authentication & Multi-Factor Security (MFA)
```mermaid
graph TD
    A[Login Request] --> B{Check Credentials}
    B -- Invalid --> C[Access Denied]
    B -- Valid --> D{MFA Enabled?}
    D -- Yes --> E[Request TOTP / Email OTP]
    E --> F{Verify Code}
    F -- Success --> G[Issue JWT Session Cookie]
    D -- No --> G
    G --> H[Redirect to Dashboard by Role]
```
*   **Login Flow**: Post credentials verification, the system inspects MFA parameters. If TOTP (Google Authenticator/Authy) or Email OTP is configured, the user must submit a verified token.
*   **Session Management**: Express issues a secure JWT cookie with automatic expiry and inactivity tracking.
*   **Inactivity Timeout**: The frontend automatically initiates an active session check and performs a secure logout redirect after 5 minutes of inactivity.

### 2. Service User Placement & Accommodation Lifecycle
```mermaid
graph TD
    A[Referral/Intake] --> B[Assess Vulnerability & Risk]
    B --> C[Assign Property & Room]
    C --> D[Move-In Process & Checklist]
    D --> E[Daily Support: Meals, Handovers, Incidents]
    E --> F[Move-Out Process]
```
*   **Intake & Profiling**: Staff creates a service user record. Vulnerability markers, Home Office reference checks, and support profiles are initialized.
*   **Placement Search**: Room lists query properties based on room status (`available`/`occupied`), bathroom type, and kitchen availability.
*   **Move-In Workflow**: The user is assigned to a room, generating a Move-In record. Property managers track occupied bed metrics in real-time.
*   **Move-Out Workflow**: On discharge, a Move-Out checklist is logged, liberating the room status back to `available`.

### 3. Compliance, Inspections & Audits
*   **HSE Audits**: HSE modules track risk management strategies, training completions, audit logs, and workplace incidents.
*   **Property Inspections**: Managers schedule recurring room/property inspections. Failures generate task entries assigned to staff.
*   **Certificates Registry**: Tracks safety and operation certificates (e.g. Gas Safety, Fire Safety) with automatic expiration alerts.

---

## 📁 App Functions

### 🔑 Authentication & Access Control
*   `Backend/routes/auth.js`: Handles registry, login, logout, 2FA credentials activation, backup codes, and session verification.
*   `Backend/routes/access.js`: Manages custom roles and granular permission sets mapped to user roles.
*   `Backend/routes/groups-roles.js`: Groups staff and managers into teams with customized CRUD permissions.

### 🏢 Properties & Rooms Management
*   `Backend/routes/properties.js`: CRUD endpoints for properties, branches, and facilities.
*   `Backend/routes/rooms.js` & `rooms-list.js`: Handles room creation, occupancy mapping, and status tracking.
*   `Backend/routes/property-documents.js` & `tenant-documents.js`: Attachment managers for property agreements and tenant compliance documents.

### 👥 Service Users & Case Management
*   `Backend/routes/su.js`: Main endpoint for service user data, logs, and progress charts.
*   `Backend/routes/case-management.js`: Tracks clinical case notes, files, progress levels, and key case indicators.
*   `Backend/routes/vulnerable-users.js`: Vulnerability assessment forms and specialized support plans.
*   `Backend/routes/multi-agency.js`: Directory and logs of external support services (Social Services, GP, Police, Legal Aid).

### 🩺 Health, Safety & Compliance (HSE)
*   `Backend/routes/hse-audits.js`: Evaluates site safety compliance scores.
*   `Backend/routes/hse-incidents.js`: Incident logs and regulatory reporting triggers.
*   `Backend/routes/hse-risk-management.js`: Risk mitigation plans.
*   `Backend/routes/hse-training.js`: Staff safety training requirements.
*   `Backend/routes/inspections.js`: Property safety checklists and failures.
*   `Backend/routes/litigation.js`: Legal claim logs, lawyer info, and court calendar items.

### 🛠️ Daily Operations & Shift Management
*   `Backend/routes/shiftHandovers.js`: Shift log handovers between staff members to ensure continuity of care.
*   `Backend/routes/maintenance.js`: Real-time tracking of repairs, tasks, and maintenance worker actions.
*   `Backend/routes/meals.js`: Weekly food schedules and special dietary log management.
*   `Backend/routes/aire-tasks.js`: Administrative task planning and verification flow.

### 📋 Dynamic Forms Builder
*   `Backend/routes/forms-builder.js`: Drag-and-drop custom form creator, allowing administrators to design checklists, compliance forms, and feedback sheets.
*   `Backend/routes/forms.js`: Submits, evaluates, and stores dynamic form responses.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
*   Node.js 18+ (LTS recommended)
*   PostgreSQL 12+ database

### 2. Clone & Bootstrap Dependencies
```bash
git clone https://github.com/your-username/sd-hr-crm.git
cd sd-hr-crm
npm run install-all
```

### 3. Environment Variables (.env)
Create an `.env` file in the **`Backend`** directory:
```env
# Database Configuration
# NOTE: Special characters in the password (@, #, etc.) MUST be URL-encoded (e.g. @ = %40, # = %23)
DATABASE_URL=postgresql://sdcommercial:Dinesh%408008%23@18.130.77.174:5432/new_CRM

PGHOST=18.130.77.174
PGPORT=5432
PGDATABASE=new_CRM
PGUSER=sdcommercial
PGPASSWORD="Dinesh@8008#"

# Security
JWT_SECRET=your-secure-jwt-key

# Server
PORT=4000
NODE_ENV=development
```

### 4. Run Migrations & Seed Admin
You can run the schema migration and add the default Super Admin accounts:
```bash
# Apply schema patches
node Backend/run-migration.js

# Setup Admin account dinesh@gmail.com / dinesh123
node Backend/scripts/createDineshAdmin.js
```

### 5. Running the Apps
Start both backend (Express) and frontend (Vite React) dev servers concurrently:
```bash
npm run dev
```
*   **Frontend**: `http://localhost:3002/` (Vite dev server)
*   **Backend**: `http://localhost:4000/` (Express API)

---

## 🌐 Production Build & Deployment

### Build Optimization
The build target utilizes Rollup code splitting:
```bash
npm run build
```
This produces optimized chunks in `frontend/dist` separated into:
*   `vendor`: Core runtime libraries (`react`, `react-dom`, `react-router-dom`)
*   `charts`: Visualization graphs (`recharts`)
*   `utils`: Utilities and API requests (`axios`, `dayjs`)
*   `pages`: Dynamically imported views

Deploy the static bundle from `frontend/dist` to AWS Amplify, Vercel, or Netlify, and host the `Backend` directory on AWS Elastic Beanstalk, Heroku, or a virtual server.
