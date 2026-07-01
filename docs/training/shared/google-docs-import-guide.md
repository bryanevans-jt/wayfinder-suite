# Importing Training Docs into Google Docs

Use this workflow to create **branded, editable PDFs** for printing and sharing.

---

## Recommended Setup

1. Create a Google Drive folder: **Wayfinder Training (GA 2026)**.
2. Subfolders: `Conference`, `ES`, `Supervisor`, `Admin`, `Client & Counselor`, `Reports`, `Scripts`.
3. One Google Doc per markdown file in this repo (same filename).

---

## Step-by-Step Import

1. Open the `.md` file from `docs/training/` in Cursor or any text editor.
2. Copy all content **except** raw HTML comments (lines starting with `<!-- SCREENSHOT`).
3. In Google Docs: **File → New → Document** → paste.
4. Apply styles:
   - Document title → **Title**
   - Major sections (`#`) → **Heading 1**
   - Subsections (`##`) → **Heading 2**
   - Steps / bullets → **Normal text** with bullet or numbered list
5. **Cover page:** Insert → Image → upload `wayfinder-logo.png` from any app’s `public/` folder. Center it. Add subtitle (e.g. “Employment Specialist Manual · Georgia”).
6. **Footer:** Insert → Headers & footers → “© 2026 Joshua Tree Service Group · Wayfinder Pro v1.0.1”.
7. For **Joshua Tree logo** (company at large): use on back cover or “About” slide only — optional `logo.png` from `public/`.

---

## Screenshot Placeholders

Each manual uses blocks like:

```
> **Screenshot placeholder**
> File: assets/screenshots/es-clients-list.png
> Navigation: Sidebar → Clients
```

Replace each block with the image from `docs/training/assets/screenshots/` after you capture it (or use screenshots already captured for login pages).

**Tip:** In Google Docs, delete the placeholder text and Insert → Image → upload PNG.

---

## Export to PDF

**File → Download → PDF (.pdf)**

Use naming:

- `Wayfinder-Pro-ES-Manual-GA.pdf`
- `Wayfinder-Pro-Supervisor-Manual-GA.pdf`
- `Wayfinder-Pro-Admin-Manual.pdf`
- `Wayfinder-Client-Quick-Start.pdf`
- `Wayfinder-Pro-Counselor-Quick-Start.pdf`
- `Joshua-Tree-Reports-Guide-GA.pdf`

---

## Keeping Docs in Sync

- **Source of truth:** this repo (`docs/training/`).
- When the app changes, update markdown here first, then refresh Google Docs.
- In-app **Help** in Wayfinder Pro mirrors the short version; manuals are the full reference.

---

## Colors (Optional Formatting in Google Docs)

| Use | Hex | Name |
|-----|-----|------|
| Headings / buttons | `#6B8E23` | Brand green |
| Body text | `#1a1a1a` | Brand black |
| Accents / highlights | `#D4A843` | Brand gold |


