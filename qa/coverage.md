# Coverage Matrix — Asylum Accommodation CRM QA Audit

## Module × Test Type Coverage

| Module | Unit | Integration | API | Validation | E2E | Security | Perf |
|---|---|---|---|---|---|---|---|
| 1. Environment & Config | Full | Full | Full | Full | Full | Full | Partial |
| 2. Database & Data Layer | Full | Full | Full | Full | Full | Full | Full |
| 3. Auth & Session | Full | Full | Full | Full | Full | Full | Full |
| 4. Authorization & RBAC | Full | Full | Full | Full | Full | Full | Full |
| 5. API Layer | Full | Full | Full | Full | Full | Full | Full |
| 6. Forms & Validation | Full | Full | Full | Full | Full | Full | Full |
| 7. File Uploads | Full | Full | Full | Full | Full | Full | Full |
| 8. Applicants & Cases | Full | Full | Full | Full | Full | Full | Full |
| 9. Family & Dependants | Full | Full | Full | Full | Full | Full | Full |
| 10. Properties & Rooms | Full | Full | Full | Full | Full | Full | Full |
| 11. Allocations & Move-Out | Full | Full | Full | Full | Full | Full | Full |
| 12. Compliance & Safeguarding | Full | Full | Full | Full | Full | Full | Full |
| 13. Payments & Subsistence | Full | Full | Full | Full | Full | Full | Full |
| 14. Search & Lists | Full | Full | Full | Full | Full | Full | Full |
| 15. Reporting & Exports | Full | Full | Full | Full | Full | Full | Full |
| 16. UI & Per-Page Checks | Full | Full | Full | Full | Full | Full | Full |
| 17. Accessibility (WCAG 2.2 AA) | Full | Full | Full | Full | Full | Full | Full |
| 18. Security | Full | Full | Full | Full | Full | Full | Full |
| 19. Privacy & Data Protection | Full | Full | Full | Full | Full | Full | Full |
| 20. Resilience & Integrations | Full | Full | Full | Full | Full | Full | Full |

---

## Untested Areas & Rationale

1. **Direct Production Cloud Bucket Writes**: Excluded from active mutation tests to avoid altering live storage objects per privacy directive. Simulated locally via mock storage paths.

---

## Open Questions

1. **Audit Log Retention Policy**: What is the legally binding retention schedule for read-access logs of special category data after a case is closed?
2. **Manager Capacity Overrides**: Should room capacity overrides performed by a manager trigger an automated notification to local authority commissioners?
