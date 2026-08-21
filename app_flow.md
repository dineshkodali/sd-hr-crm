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

---

## 🚀 7. Move-On & Transition Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **7.1** | Trigger Move-On | System / Staff | Asylum decision received or NTQ (Notice to Quit) issued. | Notice period and vacate date calculated |
| **7.2** | Move-on Support Tasks | Staff | Staff completes structured move-on support checklist (housing advice, etc.). | Checklist items logged and tracked |
| **7.3** | Execute Move-Out | Staff | Perform checkout, room condition check, and soft-delete active room link. | Room reverts to void state, history retained |

---

## 🛡️ 8. Safeguarding & Referral Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **8.1** | Raise Referral | Staff | Log concern with specific referral type (NRM, MARAC, age dispute). | Referral enters `raised` state |
| **8.2** | Triage & Acknowledge | Safeguarding Lead | Acknowledges referral and restricts visibility based on role/need-to-know. | Referral enters `acknowledged` state |
| **8.3** | Decision & Action | Safeguarding Lead | Records action taken, statutory notification details, and sets reporting deadline. | Referral enters `decision` state |
| **8.4** | Close Case | Safeguarding Lead | Provides mandatory closure notes and outcome. | Referral enters `closed` state |

---

## 🗣️ 9. Complaints & Feedback Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **9.1** | Intake Complaint | Staff / System | Log complaint, capturing channel, third-party reporter, and anonymity flag. | SLA clock starts, complaint `open` |
| **9.2** | Investigate & Tag | Manager | Assign investigator, tag root cause, and link to relevant staff/maintenance. | Investigation logged |
| **9.3** | Escalate (if SLA breached) | System | Triggers escalation alert if response exceeds defined SLA timeframe. | Management alerted |
| **9.4** | Resolve & Respond | Manager | Log resolution details and close ticket. | SLA clock stops, complaint `resolved` |

---

## 🔧 10. Maintenance & Repairs SLA Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **10.1** | Report Issue | Staff | Log repair request with photos, location (geotag), and priority tier. | SLA clock starts |
| **10.2** | Assign Contractor | Manager | Assigns to internal/external contractor and requests ETA. | Contractor notified |
| **10.3** | Execute & Evidence | Contractor/Staff | Complete work, upload after-photos, and log recharge tracking details. | Evidence captured |
| **10.4** | Verify & Close | Manager | Verifies work, checks SLA compliance, and closes ticket. | SLA clock stops, task `closed` |

---

## 🔥 11. Fire Safety & Emergency Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **11.1** | Generate Evacuation List | System | Compiles real-time list of occupants, PEEPs, and staff on site. | Accurate live list available |
| **11.2** | Log Drills/Alarms | Staff | Records fire drill attendance, alarm tests, and outcomes. | Log stored securely |
| **11.3** | FRA Action Items | Manager | Links Fire Risk Assessment actions to maintenance tasks. | Maintenance SLA initiated |
| **11.4** | Incident Escalation | System | Triggers escalation matrix for fire safety incidents. | Automated notifications sent |

---

## 🧩 12. Placement Matching Engine Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **12.1** | Define Attributes | System | Reads service user structured vulnerabilities, gender, dietary, medical needs. | Attributes prepared |
| **12.2** | Score Rooms | System | Scores available rooms against attributes, conflict registry, and proximity data. | Compatibility scores generated |
| **12.3** | Propose Matches | System | Presents ranked list of compatible rooms and highlights any conflicts. | Matches displayed |
| **12.4** | Assign or Override | Manager | Selects room or forces override (requires logged justification). | Assignment finalized |

---

## 🛏️ 13. Occupancy, Void & Finance Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **13.1** | Room Vacated | System | Room transitions to specific void state (cleaning, maintenance, ready). | State updated |
| **13.2** | Track Void Days/Cost | System | Accumulates void days and applies property cost model to calculate losses. | Financial impact logged |
| **13.3** | Generate Bed-Night Claims | System | Calculates billable bed-nights based on active placements. | Claim report generated |

---

## 🧑‍💼 14. Staff HR & Workforce Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **14.1** | Compliance Check | System | Verifies RTW, DBS, and mandatory training renewals (blocks rota if expired). | Clearance validated |
| **14.2** | Schedule Rota | Manager | Assigns staff to properties/shifts, enforcing minimum staffing rules. | Schedule published |
| **14.3** | Lone-Worker Check-In | Staff | Staff member checks in periodically during lone shifts. | Safety logged |
| **14.4** | Performance Tracking | Manager | Logs supervision sessions, appraisals, and incidents. | HR record updated |

---

## 🔒 15. Data Protection & Audit Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **15.1** | Audit Logging | System | Logs both read and write access to sensitive records. | Immutable audit trail created |
| **15.2** | SAR Processing | Admin | Workflow for Subject Access Request: compile, redact, release data. | SAR fulfilled within deadline |
| **15.3** | Breach Register | Admin | Logs potential breach, starts 72-hour ICO reporting clock. | Breach documented |
| **15.4** | Retention Policy | System | Enforces data retention schedules (archives/anonymizes old data). | Compliance maintained |

---

## 📊 16. Reporting & Contract KPI Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **16.1** | Define KPIs | Admin | Configures specific contractual targets (e.g., 95% repairs in 24h). | KPI engine configured |
| **16.2** | Monitor SLAs | System | Aggregates SLA clock data from complaints, maintenance, inspections. | Real-time performance tracked |
| **16.3** | Early Warning Alert | System | Flags trends indicating impending KPI failure. | Alert generated |
| **16.4** | Export Reports | Manager | Generates scheduled or ad-hoc performance reports for commissioners. | Report delivered |

---

## 📱 17. Offline-First Mobile Flow

| Step | Trigger / Action | Actor | System Action / Response | Success Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **17.1** | Disconnect | System | Detects loss of network connectivity. | Switches to IndexedDB storage |
| **17.2** | Offline Data Entry | Staff | Submits forms, photos (with EXIF), and inspection data offline. | Data queued locally |
| **17.3** | Reconnect | System | Detects network restoration and initiates sync queue. | Sync process begins |
| **17.4** | Conflict Resolution | System | Resolves data conflicts based on predefined rules. | Cloud database updated |

---

## 🛠️ System Fixes & Improvements

| Fix # | Target Area | Description | Impact |
| :--- | :--- | :--- | :--- |
| **1.5** | Session Hardening | Introduce account lockout after failed attempts, trusted devices, and session invalidation. | Enhances security against brute force. |
| **1.6** | Permission-based RBAC | Migrate from static string roles (`admin`) to granular, module-level permission groups. | Enables secure scaling and third-party access. |
| **2.4** | Matching Engine Guard | Route all room assignments through the Placement Matching Engine. | Prevents incompatible room sharing. |
| **3.2** | Structured Vulnerabilities | Convert free-text vulnerability/medical fields into structured, queryable flags. | Crucial for matching engine and reporting. |
| **3.4** | Structured Welfare Checks | Introduce dedicated `welfare_checks` table with absence alerting logic. | Ensures statutory check compliance. |
| **3.5** | Soft-delete & Discharges | Prevent NULLing of historical room links; add archive flags and departure types. | Preserves historical placement audit trails. |
| **4.2** | Incident Escalation Matrix | Add SLA timers and automated escalation tiers to incident logging. | Ensures critical incidents are addressed. |
| **5.4** | Cert Expiry Blocks | Enforce query-time blocks on property placement if critical certificates expire. | Prevents illegal occupation of non-compliant properties. |
