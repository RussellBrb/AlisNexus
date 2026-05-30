# Changelog

All notable changes to Nexus. Dates are YYYY-MM-DD.

## [v19] — 2026-05-30

### Refactored — clean layered architecture (S1–S7, micro-slices, zero behavior change)
The flat `js/` folder was reorganized into `core → io → view → app` (20 modules; dependencies point downward, `core` is pure):
- **S1** pure helpers → `core/format.js`
- **S2** `NX` store → `core/state.js`; `config.js` becomes pure constants
- **S3** Supabase client → `io/supabase.js`, GitHub API → `io/github.js`
- **S4** `health`/`skills` split into pure `core/` + `view/` rendering
- **S5** `data.js` → pure `loadProjects()` returning `{error}`; orchestration → `app/controller.js`
- **S6** `subscribe()/emit()` pub/sub added to the store; controller emits, views repaint
- **S7** remaining files folderized; final load order locked

Verified post-refactor: 20/20 modules parse, no duplicate globals, behavior unchanged in-browser.

### Fixed (v9–v12)
- Card left edge collapsed to a single team-colored bar (was stacking team + health colors).
- LIVE badge no longer overlaps the health chip / status dot on owned live cards.
- Onboarding screen gained a "Not you? Sign out" escape hatch (no more being trapped pre-onboarding).
- Filter pills (team / status / people) now toggle — their `onclick` handlers are HTML-escaped so the markup is valid.
- Health reframed honestly as **commit activity**; "Stalled" → "Quiet". Scoring unchanged.

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
