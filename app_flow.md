# SD HR CRM - App Flow & Feature Workflows

This document outlines the step-by-step app workflows, user roles, action sequences, and system outcomes using structured tables.

---

## 🔑 1. Authentication & Security Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Submit login credentials | User | Validates user email & password against hashed records in database. | Credentials verified successfully |
| **1.2** | Inspect MFA Status | System | Queries `authenticator_enabled` column for the user ID. | Redirects to either Step 1.3 or Step 1.5 |
| **1.3** | Verify OTP token | User | Prompts user for TOTP (Authenticator App) or Email OTP code. | Valid token submitted |
| **1.4** | Validate token | System | Checks speakeasy TOTP hash or cached email OTP code expiration. | Token validated, redirects to Step 1.5 |
| **1.5** | Establish Session | System | Generates secure JWT token, sets cookie, updates `last_login`, and returns user role. | Session cookie set in browser |
| **1.6** | Route Navigation | System | Directs the client-side router to `/admin`, `/manager`, or `/` based on role. | User lands on respective dashboard |

---

## 🏢 2. Property & Room Allocation Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **2.1** | Create Property | Admin / Manager | Saves property details to database and sets up code identifier. | Property entry created in database |
| **2.2** | Register Rooms | Admin / Manager | Creates room items mapped to property ID. Sets status to `available`. | Rooms listed on property profile |
| **2.3** | Check Availability | Staff / Manager | Filters rooms list by property, status (`available`), and type. | Displays matching rooms |
| **2.4** | Room Assignment | Staff / Manager | Assigns Service User ID to selected Room ID and logs Move-In date. | Database updates room to `occupied` |
| **2.5** | Track Occupancy | System | Recalculates property `occupied_beds` / `total_beds` metrics. | Property dashboard shows updated stats |

---

## 👥 3. Service User Lifecycle Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **3.1** | Service User Intake | Staff | Saves first name, last name, DOB, Home Office ref, and immigration status. | Profile created successfully |
| **3.2** | Vulnerability Check | Staff | Logs medical conditions, support needs, and generates a risk score. | Profile updated with vulnerable markers |
| **3.3** | Placement Execution | Staff / Manager | Links user to room (see Property Flow) and generates move-in documents. | Placement status set to `Active` |
| **3.4** | Daily Support Logging | Staff | Records case notes, dietary selections (Meals), and daily check logs. | Case logs appended to database |
| **3.5** | Discharge / Move-Out | Staff / Manager | Registers checkout checklist, signs off files, and deletes active room link. | Room reverts to `available` |

---

## 🛠️ 4. Daily Operations & Handovers Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **4.1** | Create Shift Tasks | Manager | Assigns operational tasks, checks, or client-related alerts. | Tasks visible on staff checklists |
| **4.2** | Record Incidents | Staff | Submits incident reports (client injury, behavior, site issues) with severity level. | Incident logged & manager notified |
| **4.3** | Submit Shift Handover | Outgoing Staff | Summarizes shift activities, pending tasks, and safety status. | Handover report saved and sent |
| **4.4** | Accept Shift Handover | Incoming Staff | Acknowledges outgoing handover notes and takes ownership of shift tasks. | Shift ownership changed successfully |

---

## 🩺 5. Compliance & Inspections Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **5.1** | Schedule Inspection | Manager | Generates inspection checklist for properties or rooms. | Inspection task added to calendar |
| **5.2** | Perform Audit / Check | Staff | Marks checklist items (e.g. fire alarms, cleanliness) as pass or fail. | Inspection reports submitted |
| **5.3** | Log Inspection Failure | Staff | Triggers maintenance creation if checklist item fails. | Maintenance ticket generated |
| **5.4** | Track Certificates | System | Scans certificate records (e.g. Gas safety) and alerts on upcoming expiry. | Alerts visible on compliance dashboard |

---

## 📋 6. Dynamic Form Building Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **6.1** | Design Form Layout | Admin | Builds custom forms with drag-and-drop elements (text, checkbox, select). | Form schema saved as JSON template |
| **6.2** | Publish Form | Admin | Makes template active for specific properties, roles, or users. | Form visible to target audience |
| **6.3** | Submit Form Response | Staff / Client | Fills out fields and uploads required signatures/files. | Response payload stored in DB |
| **6.4** | Analyze Submissions | Manager / Admin | Displays submissions, aggregates results, and exports as CSV/PDF. | Data generated successfully |
