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

### Month hours ledger (primary)

- Opening a service month shows the **month hours ledger**: every IJP-attributed time entry for that month (service-on-date rule), grouped by client (sorted by last name), with date, hours, activity, **Billed / Not billed yet**, and invoice number/id.
- **Unattributed** hours appear separately under each client and are never billed on IJP invoices.
- The ledger paginates by client; nothing is hidden. Empty draft invoices (0 hours) may still appear in the older list but are de-emphasized and do **not** hide hours or completeness.
- **Completeness** for the new flow = unbilled IJP entry count is **0** (not merely “Generate finished”).
- Live **attestation** status per client-month comes from `ijp_monthly_attestations` (capture date + Drive link). Invoice “missing attestation” is recomputed from live Drive file presence.
- **Bill selected** / **Bill all unbilled** (client or month) reuses open drafts, skips 0-hour invoices, uses the same attribution rules, and reports billed / skipped / failed counts.
- **Uncheck** moves hours back to **Not billed yet** (clears the stamp and removes the line). If those hours were on a **compiled** invoice, you are warned and must confirm; the invoice is flagged **Needs rebuild** until you recompile. Uncheck actions are audited (who / when / entry / invoice before→after).

### Month list and Generate Invoices

- The month client list still shows every client with Individual Job Placement activity (including **Not invoiced yet**) without running Generate first.
- One row per client (sorted by last name, then first). Multiple invoices for the same client (including supplementals) are grouped under that client.
- Run **Generate Invoices** for the selected service month. **Weekly runs are fine** — GVRA accepts **multiple invoices per client per month**.
- While a month invoice is still an unlocked draft, weekly Generate **reuses that draft** and **appends only unbilled** Individual Job Placement hours.
- If the month invoice is already locked and unbilled IJP hours remain, Generate creates a **supplemental draft** (it does **not** rewrite locked invoices).
- Generate never creates or compiles an invoice with **0 billable hours**.
- Generate drains every client with remaining unbilled IJP hours, then compiles PDFs. Compiling clears a **Needs rebuild** flag.

### Who gets an invoice

- **Every client with unbilled Individual Job Placement hours** in the period is invoiced.
- That includes **archived or closed** clients and hours logged by **any staff role**.
- Demo clients are excluded.
- An hour counts as Individual Job Placement only when the client’s service **on that entry’s date** was IJP. Linked episode wins; otherwise the episode covering the date (any service) decides. Current service is used only when no episode covers the date and no non-IJP episode overlaps that month. Date gaps with a non-IJP episode in the month stay **unattributed**.

### Attestation capture month

- Signatures collected during the **grace window** for a prior month **default to that prior month**.
- Accounts Specialists and Admins can **pick the service month** when more than one capture window is open.
- Empty invoice/attestation PDF header fields render as seven spaces for manual fill-in.

### What is never billed here

- **Non–Individual Job Placement hours never appear** on IJP invoices.
- Hours already stamped on an invoice are **never billed twice**. Late entries with no stamp are picked up on the next Generate or ledger bill action.

### Line rules (current product)

- Line hours round to the nearest half hour; invoice totals round up to whole hours.
- Draft lines auto-refresh from billable time when you open the month.
- Editors can add invoice-only manual lines that do not create contact logs.
- Each invoice includes the **2-hour GVRA Reports allowance** on the last day of the month (skipped on a supplemental invoice if already billed for that month).

---

## 3. Pre-ETS (Accounts)

**Path:** Accounts → **Pre-ETS** (when the module is enabled for your role)

### Spreadsheet upload

- **Admin, Accounts Specialist, and Super Admin upload** the Pre-ETS spreadsheet/worksheet. Regional Supervisors do **not** upload.
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
