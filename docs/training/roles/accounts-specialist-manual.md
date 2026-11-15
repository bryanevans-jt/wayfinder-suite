# Accounts Specialist Manual

**Wayfinder Pro · Accounts**

Reference for intake billing, Individual Job Placement (IJP) billing, Pre-ETS authorizations and invoices, billable hours, PTO, and billing exports.

In the product, the role key is `accountant` and the display name is **Accounts Specialist**. Individual Job Placement is always shown as **Individual Job Placement** (never “GA IJP”).

**In-app Help:** Sidebar → **Help** (Accounts Specialist sections).

---

## 1. Your Toolkit

| Tool | Purpose |
|------|---------|
| **Intake Billing** | Mark intake billed / paid (home screen after login) |
| **IJP Billing** | Monthly Individual Job Placement invoices and attestation packets |
| **Pre-ETS** | Spreadsheet upload, authorization numbers (A&I), rosters, invoice packets |
| **Weekly Timesheet** | View billable time |
| **PTO** | Leave requests (view-only for approvals) |
| **Download Exports** | Billable-by-client files |

Client names on timesheets and intake billing open a **view-only** profile.

---

## 2. Individual Job Placement billing

**Path:** Accounts → **IJP Billing**

### Generate Invoices

- Run **Generate Invoices** for the selected service month. **Weekly runs are fine** — GVRA accepts **multiple invoices per client per month**.
- While a month invoice is still an unlocked draft, weekly Generate **appends only unbilled** Individual Job Placement hours into that draft.
- If the month invoice is already locked (ready / compiled / archived) and unbilled IJP hours remain, Generate creates a **supplemental draft** for the same service month.

### Who gets an invoice

- **Every client with unbilled Individual Job Placement hours** in the period is invoiced.
- That includes **archived or closed** clients and hours logged by **any staff role**.
- Demo clients are excluded.
- Clients with no IJP-attributed billable hours are not invoiced.

### What is never billed here

- **Non–Individual Job Placement hours never appear** on IJP invoices.
- Hours already stamped on an invoice are **never billed twice**. Late entries with no stamp are picked up on the next Generate.

### Line rules (current product)

- Line hours round to the nearest half hour; invoice totals round up to whole hours.
- Draft lines auto-refresh from billable time when you open the month.
- Editors can add invoice-only manual lines that do not create contact logs.
- Each invoice includes the **2-hour GVRA Reports allowance** on the last day of the month (skipped on a supplemental invoice if already billed for that month).

---

## 3. Pre-ETS (Accounts)

**Path:** Accounts → **Pre-ETS** (when the module is enabled for your role)

### Spreadsheet upload

- **Accounts Specialists and Super Admins upload** the Pre-ETS spreadsheet/worksheet. Regional Supervisors and Admins do **not** upload.
- Accounts uploads use the **support / auth-match** path (any district): upload → approve or **reject** (with reason) → commit.
- Super Admins use the **planning** path (auto-commit).
- Auth-request notifications fire when Accounts commits an upload (same as planning auto-commit), unless worksheet testing override is on.
- Review the read-only **Change log** under Rosters & auths for authorization number and roster student edits.

### Authorizations and rosters

- Enter or correct GVRA authorization numbers (A&I).
- Add or remove students on a roster — **including after the roster is finalized**.
- Change the authorization number after finalization when needed.
- Changes are audited (who changed auth # or students).

### Invoice packets

- Build and manage Pre-ETS invoice packets from billable attendance.
- **Ready, submitted, or paid packets are not reset** when a roster or auth number changes.
- Draft packet unit/amount totals may refresh from attendance; saved invoice numbers on drafts are kept.
- Do not use Generate draft packet to overwrite a non-draft packet — edit that packet instead.

---

## 4. Intake Billing

**Path:** Accounts → **Intake Billing**

- Mark intake billed and payment received.
- HR can view intake billing but does not mark billed/paid.

---

## 5. Billable exports

| Export | Source |
|--------|--------|
| **Billable by client** | Client billable service time (state billing); pay is based on billable hours |

Pay-period settings are configured by Super Admin under Portal → Settings → Payroll Settings.

---

## 6. PTO

- You can **view** all PTO requests for payroll awareness.
- You **cannot approve or deny** — that stays with HR and admins.
- Submit your own PTO from sidebar → **PTO**.

---

## 7. Support

**Bryan Evans** · bryan.evans@thejoshuatree.org · include **WF-** codes for errors.

---

*Wayfinder Pro · Joshua Tree Service Group*
