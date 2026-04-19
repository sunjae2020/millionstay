# MillionStay — Notifiable Data Breaches (NDB) Incident Response Runbook

**Owner:** Privacy Officer (`millionstay.com@gmail.com`)
**Effective:** 19 April 2026
**Statutory basis:** Part IIIC, *Privacy Act 1988* (Cth) — Notifiable Data Breaches scheme
**Regulator:** Office of the Australian Information Commissioner (OAIC) — `enquiries@oaic.gov.au` / 1300 363 992

> An "eligible data breach" exists when (a) there has been unauthorised access to, unauthorised disclosure of, or loss of personal information, **and** (b) a reasonable person would conclude that the breach is likely to result in **serious harm** to any individual the information relates to, **and** (c) the entity has not been able to prevent that likely risk through remedial action.
>
> **Statutory deadline:** complete assessment within **30 calendar days** of becoming aware (s 26WH). Notify OAIC and affected individuals **as soon as practicable** once an eligible breach is confirmed (s 26WK / s 26WL).

---

## 0. Roles

| Role | Person | Contact |
|---|---|---|
| Incident Commander (IC) | Privacy Officer | `millionstay.com@gmail.com` |
| Engineering lead | On-call engineer | (rotating) |
| Communications lead | Privacy Officer (initial) | `millionstay.com@gmail.com` |
| Executive sponsor | Director | (internal) |

The Privacy Officer is the single decision-maker for OAIC notification. All external communication about the incident must be approved by the Privacy Officer before being sent.

---

## 1. Detection & Triage (Hour 0 → Hour 4)

### 1.1 Trigger sources
- Automated alert (application error, auth-failure spike, login lockouts, 5xx spike, audit-log anomaly).
- Staff report of suspicious activity, lost device, leaked credentials, or misdirected email.
- External report (customer, security researcher, third-party service provider, regulator, or media).
- Notification from a sub-processor (Replit, Cloudinary, Resend, Stripe, Neon/PostgreSQL provider).

### 1.2 First responder actions (within 1 hour)
1. **Acknowledge** the report and assign an incident ID `INC-YYYYMMDD-NN`.
2. **Email the Privacy Officer immediately** at `millionstay.com@gmail.com` with subject:
   `[NDB-TRIAGE] INC-YYYYMMDD-NN — <one-line summary>`
   Include: what was observed, when, who reported it, evidence/log location, and current containment status. Use TLS-secured email; do not include the leaked data itself in the email body — reference its location instead.
3. **Preserve evidence** — copy relevant logs, audit-log rows, and database snapshots to a quarantined location. Do not let normal log rotation overwrite them.
4. **Do not contact the affected individuals or external parties** until the Privacy Officer has assessed.

### 1.3 Privacy Officer initial assessment (within 4 hours)
The Privacy Officer logs the incident in the Incident Register (`docs/INCIDENT_REGISTER.md` — append a new row) with:
- Incident ID, date/time of awareness, source.
- One-paragraph factual summary.
- **Initial severity:** S1 (likely eligible) / S2 (possible) / S3 (unlikely).
- Containment owner.

If S1 or S2, escalate to **Section 2 — Containment** immediately.

---

## 2. Containment (Hour 4 → Hour 24)

Goal: stop ongoing exposure and prevent further loss.

| Vector | Immediate action |
|---|---|
| Compromised guest or staff account | Force-logout (revoke `refresh_tokens` rows for the user), reset password, invalidate API tokens. |
| Compromised admin account | Revoke admin session, rotate JWT signing key (`JWT_SECRET`) — note this logs out all users; coordinate with engineering. |
| Leaked secret / API key | Rotate the secret in the secrets manager and in every environment; redeploy. Rotate Cloudinary, Resend, Stripe, and database credentials as applicable. |
| Public exposure of media (Cloudinary) | Rotate the Cloudinary signing secret and invalidate any leaked signed URLs. Consider deleting the asset if no longer required. |
| Misdirected email (Resend) | Recall is not possible. Contact unintended recipient and request deletion in writing; document the request and response. |
| Database exposure | Disconnect the offending IP / revoke role; take a forensic snapshot before any destructive remediation. |
| Lost / stolen device with cached credentials | Revoke that user's sessions and rotate their password; remote-wipe if managed. |
| Third-party sub-processor breach | Demand written confirmation of scope, contained-by date, and affected fields from the sub-processor; preserve their notice. |

Document every containment action in the incident timeline (Section 6).

---

## 3. Assessment of "Serious Harm" (Day 1 → Day 30)

The Privacy Officer leads a documented assessment using the OAIC's "Identifying Eligible Data Breaches" guidance. Capture answers to:

1. **What information was involved?**
   - Identifiers: name, email, phone, DOB, nationality.
   - Government IDs: passport, visa, student ID, driver licence.
   - Financial: BSB + account number, card data (note: card data is processed by Stripe and is not stored in our database).
   - Authentication: hashed passwords, refresh tokens, session IDs.
   - Sensitive information (s 6): health, racial/ethnic origin, etc.
2. **Whose information was involved?** Count of affected individuals; note any vulnerable groups (minors, visa holders).
3. **What is the circumstance of the breach?** Malicious vs accidental, internal vs external actor, encrypted vs plaintext.
4. **What harm could result?** Identity theft, financial fraud, immigration impact, reputational harm, physical safety, family-violence risk, employment impact, psychological harm.
5. **What remedial action has been taken?** Could it prevent the likely risk of serious harm? (If yes, the breach may **not** be notifiable — document the reasoning.)

Record the conclusion: **eligible / not eligible / inconclusive** and the reasoning. This must be completed within **30 days** of awareness (s 26WH).

If inconclusive at day 28, the Privacy Officer should err on the side of notification.

---

## 4. Notification — Eligible Breach Confirmed

### 4.1 Notify the OAIC
Submit the **OAIC Notifiable Data Breach form** at <https://www.oaic.gov.au/privacy/notifiable-data-breaches/notifiable-data-breach-form> as soon as practicable after the assessment concludes the breach is eligible.

The form requires:
- Entity name and ABN (Million Homestay Australia Pty Ltd).
- Contact person — the Privacy Officer (`millionstay.com@gmail.com`).
- Description of the breach, when it occurred, when it was discovered.
- Kinds of information involved.
- Number of individuals affected (or estimate).
- Recommendations for affected individuals.
- Steps taken or planned in response.

Keep a PDF copy of the submitted form in the incident folder.

### 4.2 Notify affected individuals
Notification must be made by the **method ordinarily used to contact** the individual (typically email).

The notice must include all of the following (s 26WL(3)):
- Identity and contact details of MillionStay.
- A description of the eligible data breach.
- The kinds of information involved.
- Recommendations about the steps the individual should take in response (e.g., change password, monitor accounts, contact bank, IDCARE on 1800 595 160).

If contacting each individual is not practicable, publish a statement on the website privacy page and take reasonable steps to publicise it (s 26WL(2)(c)).

A **plain-English notification email template** is in `docs/templates/ndb_notification_email.md` (to be drafted on first incident if not already present).

### 4.3 Internal notifications
- Director / executive sponsor — within 24 h of "eligible" determination.
- All staff — guidance on how to handle customer questions; do not speculate.
- Sub-processors — if their service is involved or required to remediate.

---

## 5. Remediation & Closure

1. **Root-cause analysis** — within 14 days of containment. Capture the technical and process root causes; produce a corrective-action list with owners and due dates.
2. **Implement corrective actions** — track to closure in the incident folder.
3. **Update controls** — patch the application, tighten configuration, refresh staff training, update this runbook if a gap was found.
4. **Post-incident review** — within 30 days of closure; written summary appended to the Incident Register.
5. **Retain incident records for 7 years.**

---

## 6. Incident Timeline Template

For each incident, maintain `docs/incidents/INC-YYYYMMDD-NN.md` with this structure:

```
# INC-YYYYMMDD-NN — <title>

## Summary
- One-paragraph factual summary.

## Severity
- Initial: S?
- Final: eligible / not eligible

## Timeline (UTC)
- 2026-MM-DD HH:MM  — detected by …
- 2026-MM-DD HH:MM  — Privacy Officer notified
- 2026-MM-DD HH:MM  — containment action: …
- 2026-MM-DD HH:MM  — assessment complete
- 2026-MM-DD HH:MM  — OAIC form submitted (ref: …)
- 2026-MM-DD HH:MM  — affected individuals notified (count: …)
- 2026-MM-DD HH:MM  — incident closed

## Information involved
| Field | Count |
|---|---|

## Containment actions taken
…

## Assessment of serious harm
…

## Notifications
- OAIC: yes/no, date, reference
- Individuals: yes/no, date, count, channel (email)

## Root cause
…

## Corrective actions
| Action | Owner | Due | Status |
|---|---|---|---|

## Lessons learned
…
```

---

## 7. Sub-processor breach contacts

| Service | Notification address | Contractual SLA |
|---|---|---|
| Replit (hosting) | <https://replit.com/legal> / `support@replit.com` | per Replit DPA |
| Cloudinary (media) | `privacy@cloudinary.com` | per Cloudinary DPA |
| Resend (email) | `privacy@resend.com` | per Resend DPA |
| Stripe (payments) | `dpo@stripe.com` | per Stripe DPA |
| Database provider | (per provider DPA) | per DPA |

If any of the above notifies us of an incident affecting our data, treat it as a Section 1 trigger and begin this runbook.

---

## 8. Drill schedule

A tabletop exercise must be run at least **once every 12 months** by the Privacy Officer, simulating one of: stolen laptop, leaked Cloudinary URL, compromised admin account, sub-processor breach. Record outcomes in the Incident Register.

---

## 9. References

- Privacy Act 1988 (Cth), Part IIIC — Notifiable Data Breaches.
- OAIC, *Data Breach Preparation and Response — A guide to managing data breaches in accordance with the Privacy Act 1988 (Cth)*.
- OAIC, *Identifying eligible data breaches*.
- IDCARE — Australia and New Zealand identity and cyber support service: 1800 595 160 / <https://www.idcare.org>.
