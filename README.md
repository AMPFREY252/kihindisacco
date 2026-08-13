# KIHINDI SACCO – GitHub Prototype

Standalone browser demo of the SACCO management system. **No PHP, no MySQL, no WAMP** — all data lives in **IndexedDB** in the user's browser.

This folder mirrors the production app (`../`) with the same UI and workflows.

## Quick start (local)

1. Open `index.html` in a browser, **or**
2. Serve the folder with any static server:
   ```bash
   npx serve prototype
   ```
3. Sign in with demo accounts:

| Role | Username | Password |
|------|----------|----------|
| Chairman | `admin` | `password` |
| Loan Officer | `loans` | `password` |
| Cashier | `cashier` | `password` |

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set source to your branch and folder **`/prototype`** (or root if you only publish this folder).
4. Open `https://<username>.github.io/<repo>/prototype/`

## How it works

| Production (WAMP) | Prototype |
|-------------------|-----------|
| `api/index.php` + MySQL | `js/api.js` + IndexedDB |
| PHP session | `sessionStorage` |
| `js/store.js` → fetch API | `js/store.js` → local `Api.handle()` |

Files:

- `js/db.js` — IndexedDB storage + demo seed data
- `js/api.js` — All business logic (login, loans, savings, members, etc.)
- `js/store.js` — Same interface as production (app.js unchanged)

## Reset demo data

In the browser console:

```javascript
Store.resetDemoData().then(() => location.reload());
```

Or clear site data for this origin in DevTools → Application → IndexedDB → delete `kihindisacco_prototype`.

## Notes

- Data is **per browser / per device** — not shared between users.
- Passwords are stored in plain text (demo only — not for production).
- PDF form preview works when served over HTTP; opening `file://` directly may limit embedded PDF preview (use the **Blank Form (PDF)** link).

## Folder structure

```
prototype/
├── index.html
├── css/style.css
├── js/
│   ├── db.js       ← IndexedDB
│   ├── api.js      ← Local API
│   ├── store.js    ← Client adapter
│   ├── app.js
│   ├── roles.js
│   └── utils.js
└── assets/
```
