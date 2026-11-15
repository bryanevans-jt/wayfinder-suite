# Org Admin Manual

**Wayfinder Pro · Organization administration**

For **admin** role users who configure offices, services, team members, and assignments. Does **not** cover super-admin-only tools (error log, demo clients, payroll period setup).

---

## 1. What Org Admins Do

| Task | Where |
|------|--------|
| Add offices & hide unused ones | Admin portal → Organization |
| Manage services / milestones | Admin portal → Organization |
| Invite team members & assign roles | Admin portal → Team |
| Assign ES ↔ supervisor ↔ office | Admin portal → Assignments |
| Link counselors to clients | Counselor records + client records |

---

## 2. Accessing the Admin Portal

**Path:** Sidebar → **Admin portal** (`/dashboard/admin`)

Requires **admin** role (@thejoshuatree.org).

> **Screenshot placeholder — Admin portal home**  
> File: `assets/screenshots/admin-portal-home.png`

---

## 3. Organization Setup

### Offices

- Add office name, city, and state.
- **Hide** unused VR offices so they don’t appear in pickers (super-admin may assist first time).

> **Screenshot placeholder — Offices list**  
> File: `assets/screenshots/admin-offices.png`

### Services & Success Path

- Services define the client **success path** milestones in the Wayfinder client app.
- Coordinate changes with program leadership before editing production services.

---

## 4. Team Members

**Path:** Admin portal → **Team**

| Role in app | Typical user |
|-------------|--------------|
| **es** | Employment Specialist |
| **transition_specialist** | Transition Specialist (ES shell + Pre-ETS field delivery) |
| **supervisor** | Regional Supervisor |
| **admin** | Org administrator (also owns HR work — PTO settings, HR Dashboard, PTO approvals) |
| **counselor** | Vocational counselor (limited portal) |
| **accountant** | Accounts Specialist — intake billing, Individual Job Placement (IJP) billing, Pre-ETS accounts (spreadsheet upload, authorizations, packets), exports |
| **hospitality_specialist** | Hospitality Specialist |
| **hr** | *(Retired — not assignable.)* Legacy HR Director accounts still work; Admins do HR work going forward. The DB enum value remains. |

**Adding a user:**

1. Enter @thejoshuatree.org email.
2. Assign role. **Only Super Admin** can assign **Admin** or **Super Admin**. Org Admins cannot grant Admin.
3. User receives invite / signs in via magic link on first day.
4. Share [Getting signed in](../shared/getting-signed-in.md).

---

## 5. Assignments

**Path:** Admin portal → **Assignments**

- **Supervisor ↔ ES** — who coaches whom.
- **Staff ↔ office** — reporting and analytics scope.
- **Counselor ↔ office** — counselor caseload scope.

Wrong assignments = wrong data in analytics and counselor views. Verify after every hire.

> **Screenshot placeholder — Assignments screen**  
> File: `assets/screenshots/admin-assignments.png`

---

## 6. Counselors

Counselors are **vocational rehabilitation agency staff** (for example GVRA in Georgia) — **not** Joshua Tree employees. They sign in with their **agency work email**, not `@thejoshuatree.org`.

Counselors need:

1. Auth account created with their **agency email** and **counselor** role on profile.
2. Row in **counselors** table (linked to auth user) — usually created via admin workflow.
3. **Client ↔ counselor** link on each participant they should see.

If counselor sees “account not set up,” verify the email matches what they type at login and complete counselor record and assignments.

---

## 7. Clients (Admin Visibility)

Admins can import or review clients depending on portal tabs enabled. ESs create most day-to-day records; admins fix **wrong office**, **wrong counselor**, or **duplicate** issues.

---

## 8. Accounts Specialist vs Admin

- **Accounts Specialist** owns Intake Billing marks, **IJP Billing** (Generate Invoices), and Pre-ETS accounts work (spreadsheet upload, A&I, roster edits after finalization, invoice packets). See [Accounts Specialist Manual](./accounts-specialist-manual.md).
- **Admins** may also reach IJP Billing / Pre-ETS accounts tools when Pre-ETS and Accounts access are enabled for them; day-to-day billing is still Accounts Specialist owned. Pre-ETS worksheet **upload** is allowed for Admin, Accounts Specialist, and Super Admin (Regional Supervisors do not upload).
- Individual Job Placement always displays as **Individual Job Placement** in the product (not “GA IJP”).

---

## 8b. HR work (Admins)

The **HR Director** role is retired for new assignments. **Admins** own:

- **HR Dashboard** (`/dashboard/hr`) — roster, timesheets, activity, assignments
- **PTO Settings** (Admin Portal → Settings → PTO, or on the HR Dashboard)
- **PTO approval queue** (Billable Hours / PTO page)

Legacy `hr` profiles keep access until converted; do not assign `hr` from role pickers. The DB enum value remains.

---

## 9. What Admins Don’t Manage Here

| Item | Who |
|------|-----|
| Joshua Tree Reports templates & Drive folders | Reports admin (Bryan / reports admin UI) |
| System error log (WF codes) | Super admin |
| Demo/training clients | Super admin |
| Pay period settings | Super admin |
| Pre-ETS module / role rollout settings | Super admin |

---

## 10. GA Training Conference Note

Admins attend the **same GA conference** as ESs and supervisors for context, then stay for the **admin breakout** (see [GA facilitator guide](../conference/ga-facilitator-guide.md)).

---

## 11. Support

**Bryan Evans** · bryan.evans@thejoshuatree.org · include WF- codes for errors.

---

*Wayfinder Pro · Joshua Tree Service Group · v1.1.0*


