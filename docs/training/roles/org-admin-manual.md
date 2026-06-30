# Org Admin Manual

**Wayfinder Pro · Organization administration**

For **admin** role users who configure offices, services, team members, and assignments. Does **not** cover super-admin-only tools (error log, demo clients, payroll period setup).

---

## 1. What org admins do

| Task | Where |
|------|--------|
| Add offices & hide unused ones | Admin portal → Organization |
| Manage services / milestones | Admin portal → Organization |
| Invite team members & assign roles | Admin portal → Team |
| Assign ES ↔ supervisor ↔ office | Admin portal → Assignments |
| Link counselors to clients | Counselor records + client records |

---

## 2. Accessing the admin portal

**Path:** Sidebar → **Admin portal** (`/dashboard/admin`)

Requires **admin** role (@thejoshuatree.org).

> **Screenshot placeholder — Admin portal home**  
> File: `assets/screenshots/admin-portal-home.png`

---

## 3. Organization setup

### Offices

- Add office name, city, state (GA/TN).
- **Hide** unused VR offices so they don’t appear in pickers (super-admin may assist first time).

> **Screenshot placeholder — Offices list**  
> File: `assets/screenshots/admin-offices.png`

### Services & success path

- Services define the client **success path** milestones in the Wayfinder client app.
- Coordinate changes with program leadership before editing production services.

---

## 4. Team members

**Path:** Admin portal → **Team**

| Role in app | Typical user |
|-------------|--------------|
| **es** | Employment Specialist |
| **supervisor** | Supervisor |
| **admin** | Org administrator |
| **counselor** | Vocational counselor (limited portal) |
| **accountant** | Payroll (future) |

**Adding a user:**

1. Enter @thejoshuatree.org email.
2. Assign role.
3. User receives invite / signs in via magic link on first day.
4. Share [Getting signed in](../shared/getting-signed-in.md).

> **Screenshot placeholder — Team member invite**  
> File: `assets/screenshots/admin-team-invite.png`

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

Counselors are **vocational rehabilitation agency staff** (GVRA in Georgia, Tennessee DHS VR in Tennessee) — **not** Joshua Tree employees. They sign in with their **agency work email**, not `@thejoshuatree.org`.

Counselors need:

1. Auth account created with their **agency email** and **counselor** role on profile.
2. Row in **counselors** table (linked to auth user) — usually created via admin workflow.
3. **Client ↔ counselor** link on each participant they should see.

If counselor sees “account not set up,” verify the email matches what they type at login and complete counselor record and assignments.

---

## 7. Clients (admin visibility)

Admins can import or review clients depending on portal tabs enabled. ESs create most day-to-day records; admins fix **wrong office**, **wrong counselor**, or **duplicate** issues.

---

## 8. What admins don’t manage here

| Item | Who |
|------|-----|
| Joshua Tree Reports templates & Drive folders | Reports admin (Bryan / reports admin UI) |
| System error log (WF codes) | Super admin |
| Demo/training clients | Super admin |
| Pay period settings | Super admin |

---

## 9. GA training conference note

Admins attend the **same GA conference** as ESs and supervisors for context, then stay for the **admin breakout** (see [GA facilitator guide](../conference/ga-facilitator-guide.md)).

---

## 10. Support

**Bryan Evans** · bryan.evans@thejoshuatree.org · include WF- codes for errors.

---

*Wayfinder Pro · Joshua Tree Service Group · v0.11.0*
