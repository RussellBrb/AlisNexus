# Changelog

All notable changes to Nexus. Dates are YYYY-MM-DD.

## [v8] — 2026-05-29

A UI/UX overhaul plus a full repair of the login and project-loading flows.

### Added
- **Design system overhaul** (`nexus.css`). Refined dark-violet palette with a layered ambient background mesh, a proper elevation/radius/easing token set, Inter + JetBrains Mono typography, glass materials on the header / panels / modals, and spring-eased micro-interactions throughout. Structure and every class name preserved, so no JS changes were required.
- `README.md`, this `CHANGELOG.md`, and a `.gitignore` (ignores `.env`, `node_modules/`, the PHI-bearing `runs/` folder, the nested `alis-automation-hub/` repo, and local preview/scratch files).
- `nexus_preview.html` — a static, sample-data preview of the UI for eyeballing styling without Supabase (git-ignored).
- Console logging under `[nexus auth]` and `[nexus data]` for easier diagnosis.

### Fixed
- **Login workflow.** Sign-in returned a valid session but the app never entered, because all "you're in" logic hung on the `onAuthStateChange` `SIGNED_IN` event, which does not reliably fire for the password grant. Boot logic was hoisted into a single idempotent `enterApp(user)`, now called directly from the returned session. `bootAuth()` was reordered so the auth listener and `getSession()` wire up *before* any optimistic `localStorage` render (which is now wrapped in try/catch so a stale profile can't break auth).
- **Project grid hung on "Loading projects…".** Root cause: `index.html` had been truncated after the `markdown.js` tag, dropping the last 7 script tags (`detail`, `modal`, `pulse`, `health`, `skills`, `profile`, `app`). That left `computeHealth`, `selTeam`, and `openAddProject` undefined, so `renderCard` threw. Restored all 14 script tags and the closing markup.
- **Card left-edge accent** showed two competing colors (team stripe + JS-set health border). Collapsed to a single clean team-colored bar; health stays in its chip.
- Magic-link `emailRedirectTo` is now computed from `window.location` instead of being hardcoded, so it returns correctly whether running locally or on GitHub Pages.

### Hardened
- `loadAndRender()` now wraps the query in try/catch with a 15s timeout and surfaces failures as an in-grid error state instead of an endless spinner.
- `applyProfile()` guards against a missing profile name.
- Supabase client config made explicit (`detectSessionInUrl`, `persistSession`, `autoRefreshToken`).

### Notes
- Cache version bumped to `?v=8` across all scripts and `nexus.css`.
- Identified schema drift: `nexus-schema.sql` no longer matches the live `projects` table (see README). Flagged for a future regeneration from the live schema.
