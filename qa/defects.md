# Defect Log — Asylum Accommodation CRM QA Audit

| ID | Severity | Module | Title | Preconditions | Repro Steps | Expected vs Actual | Root Cause |
|---|---|---|---|---|---|---|---|
| **DEF-001** | **P0** | Environment | Database Plaintext Password Committed in `.env` | Access to repository | Open `Backend/.env` | **Expected**: Credentials loaded via secure secrets vault.<br>**Actual**: Hardcoded PG password `Dinesh@8008#` exposed in plain text. | `Backend/.env:11` |
| **DEF-002** | **P1** | Environment | Aikido Security API Token Committed | Access to repository | Open `Backend/.env` | **Expected**: API token injected via build environment.<br>**Actual**: Hardcoded token `AIK_RUNTIME_...` committed. | `Backend/.env:27` |
| **DEF-003** | **P2** | Database | Missing Explicit `ON DELETE` Cascade Strategies | Database init execution | Inspect `database_init.sql` FK definitions | **Expected**: Foreign keys explicitly specify cascade/restrict behavior.<br>**Actual**: Implicit default FK behavior may lead to orphan rows. | `database/database_init.sql` |
| **DEF-004** | **P1** | Security | Missing Content Security Policy (CSP) & HSTS Headers | HTTP request to API | Send GET to `/api/health` | **Expected**: `Content-Security-Policy` and `Strict-Transport-Security` headers present.<br>**Actual**: Headers absent in response. | `Backend/server.js` |
