# Client site template (Atelier Penh)

One-page site for a small business (restaurant, bar, spa, salon), with an optional phone editor at `/admin`.

| File | Who edits it | Role |
|---|---|---|
| `content/site.json` | the client (via `/admin`) or Atelier Penh | all texts, prices, menu, hours, contact, photos |
| `content/schema.json` | Atelier Penh | which fields exist, their limits; the editor form is built from it |
| `site.config.json` | Atelier Penh | client id, domain, colours, business type, **editor on/off** |
| `render.js`, `assets/` | Atelier Penh | the design (same code for the real site and the editor preview) |
| `admin/` | — | the editor (only published when `editor.enabled` is true) |

Build: `node build.js` → `_site/` (done automatically by `.github/workflows/deploy.yml`).
Setup guide: `SETUP-NOUVEAU-CLIENT.md` at the root of the atelierpenh repository.
