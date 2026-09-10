# Staff login (`/login`) — JAWS accessibility audit

This document lists recommended changes for the **real** Wayfinder Pro sign-in page before visual or structural updates are implemented. The counselor demo login at `/walkthrough/counselor/login` now mirrors the production form (via `LoginFormShell`) for training purposes.

## Current structure

- Route: `apps/staff/src/app/login/page.tsx`
- Form: `packages/auth-ui/src/login-form.tsx` (via `LoginFormShell`)
- Legal links: `/terms`, `/privacy`

## What works today

- Error and status messages use `role="alert"` and `aria-live="assertive"`.
- Form controls have visible text labels (email field).
- Terms and Privacy links are plain text with descriptive link text.
- Legal pages now include skip links, `main` landmarks, and titled `article` regions.

## Recommended changes (not yet applied to `/login`)

### 1. Page-level landmark and skip navigation

- Add a **skip link** as the first focusable element: “Skip to sign in”.
- Wrap the login card in `<main id="sign-in-main">` with a single primary landmark per page.
- If client-account warning banners appear above the form, wrap them in `role="status"` or `aria-live="polite"` regions so JAWS announces them without stealing focus from the form.

### 2. Heading hierarchy

- Ensure one **h1** on the page (“Sign in”). Product name (`Wayfinder Pro`) should remain styled text or a **paragraph**, not a second h1.
- Add `id="sign-in-heading"` on the h1 and reference it with `aria-labelledby` on the form container if the form is semantically separate from the header block.

### 3. Form semantics

- Associate the email field with `id` / `htmlFor` explicitly (label already wraps input; split for clearer JAWS “Edit” announcement: `<label htmlFor="staff-login-email">`).
- Add `aria-describedby` on the email input pointing to the subtitle paragraph when Google sign-in is shown (counselor vs staff guidance).
- Mark required fields with `aria-required="true"` (email is required for magic link).

### 4. Google and passkey buttons

- Google button text is good; add **`aria-busy="true"`** while `busy === "google"` (and similarly for magic link / passkey).
- Passkey button: add short **`aria-describedby`** helper text explaining it may require a prior magic-link sign-in on this browser (text already exists in the notice region after failure — surface a static hint for screen reader users).

### 5. Terms agreement paragraph

- The “By signing in, you agree…” line should use **`aria-label`** or be linked to the form with `aria-describedby` so JAWS reads it in context before the first action button, or immediately after the h1 (current order is acceptable if tested).

### 6. Focus management

- On magic-link success, move focus to the alert region (`role="alert"`) so JAWS reads the “Check your email…” message.
- On OAuth redirect, avoid double-submission by disabling buttons (already done) and announce “Redirecting to Google sign-in” via `aria-live`.

### 7. Color and contrast

- Verify `#brand-green` on white and gold warning borders meet WCAG AA for small text (Terms links, helper text at `text-xs`).

### 8. Counselor-specific copy

- Production login shows Google for `@thejoshuatree.org` and counselor guidance under Google. No “Counselor” variant label — counselors use the same page. Demo walkthrough should remain the only place with the dashed “Demo purposes only” box.

## Testing checklist (JAWS + Chrome/Edge)

1. Tab order: skip link → error banners (if any) → Google → email → magic link → passkey → Terms/Privacy links.
2. Virtual cursor: h1 announced once; product name not mistaken for a second title.
3. Submit empty email: alert read automatically.
4. Submit unknown email: “account not set up” message read.
5. Legal links: open Terms/Privacy; skip link on those pages reaches main content.

## Out of scope for `/login` (already handled elsewhere)

- Counselor demo page alignment — done on `/walkthrough/counselor/login`.
- Terms/Privacy content accuracy — reviewed in `packages/branding/src/legal/`.
- Silent counselor provisioning — portal API, not login UI.
