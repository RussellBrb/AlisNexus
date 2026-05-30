# Nexus — Return Brief
*Architecture snapshot + task list. Current as of v19 (2026-05-30).*

> For the full project overview, module map, schema, and deploy workflow, see `README.md`. This brief is the working state + what's next.

---

## Current state

The app is **live and running cleanly** at https://russellbrb.github.io/AlisNexus. Login (magic link + password) works, the project grid renders, the activity pulse populates, and Add Project works. Cache version is `?v=19`.

### Module inventory — four layers, 20 modules (all single-responsibility)

As of v19 the JS is organized into `core → io → view → app`. Dependencies only point downward; `core` has no DOM and no network.

**core/** — pure logic, no DOM/IO
- `format.js` — relTime, escHtml, safeUrl, team class/color/label, ownerInitials
- `state.js` — the `NX` store + `subscribe()/emit()` pub/sub
- `config.js` — constants (Supabase keys, team/lang maps) + DOM utils (el/qs/qsa)
- `similarity.js` — Jaccard similarity engine
- `health.js` — `computeHealth()` + tiers
- `skills.js` — `computePersonSkills()`

**io/** — the only code that talks to the outside
- `supabase.js` — the Supabase client (`_sb`)
- `github.js` — GitHub API enrichment + token dialog
- `data.js` — `loadProjects()` + project CRUD/realtime

**view/** — DOM rendering only
- `render.js`, `detail.js`, `modal.js`, `pulse.js`, `profile.js`, `markdown.js`, `health-view.js`, `skills-view.js`

**app/** — boot + orchestration
- `auth.js` — login, onboarding, `enterApp` / `bootAuth`
- `controller.js` — `loadAndRender()`; subscribes `paintViews()` to the store
- `app.js` — search debounce, input wiring, boot entry

Load order (preserve — matches the call graph):
`core/format → core/state → core/config → io/supabase → io/github → io/data → core/similarity → view/markdown → view/render → view/detail → view/modal → view/pulse → core/health → view/health-view → core/skills → view/skills-view → view/profile → app/auth → app/controller → app/app`

Plus `index.html` (~322 lines, markup only) and `nexus.css` (~1020 lines, all styles + design tokens).

### Design system (v8 overhaul)

`nexus.css` was reworked into a refined dark-violet system: layered ambient background mesh, an explicit elevation/radius/easing token set, Inter + JetBrains Mono typography, glass materials (blur + saturate) on the header / panels / modals, team-tinted card hover glows, and spring-eased micro-interactions. All original class names were preserved, so no JS changes were needed. The card left edge is a single team-colored bar; health lives in its chip.

### Auth (v8 rebuild)

Boot logic lives in one idempotent `enterApp(user)`, called **directly** from a successful `signInWithPassword` (the `SIGNED_IN` event does not reliably fire for password grants), and also from `getSession()` and the `onAuthStateChange` backup listener. `bootAuth()` wires up auth **before** the optimistic `localStorage` render, which is wrapped in try/catch so a stale profile can't break sign-in. `emailRedirectTo` is computed from `window.location`. Errors surface in the login UI and log under `[nexus auth]`.

---

## Known issues / watch-outs

1. **Schema drift.** `nexus-schema.sql` no longer matches the live `projects` table. The live columns (per `data.js`) are: `id, created_by, created_at, name, github_url, deploy_url, one_liner, description, tags, domain, tech_stack, team, status, owner, client, last_updated, latest_update, update_log`. The SQL file uses an older shape (`github_repo`, `github_data`, `owner_name`, `visibility`). **Action:** regenerate `nexus-schema.sql` from the live schema so the repo is self-documenting.

2. **Don't `sed -i` synced files.** A shell `sed` write against the OneDrive-synced folder once raced with sync and truncated `index.html`'s script list, silently breaking the page. Edit these files with a real editor / file tool, not in-place shell stream edits.

3. **Realtime subscription is table-wide.** `data.js` subscribes to all changes on `projects`. Fine for current scale; consider scoping later.

4. **`publishProject()` deploy_url** has only browser-level (`<input type="url">`) validation, no JS re-check before save. Low risk; one-line guard when convenient.

5. **No CSP meta tag.** GitHub Pages can't set headers and a meta CSP would conflict with the Supabase CDN / GitHub API. Accepted tradeoff for a static internal tool.

---

## Security housekeeping

- **Rotate any PAT ever pasted into chat.** A GitHub personal access token was pasted into a conversation transcript in an earlier session and should be considered compromised: revoke it at `github.com/settings/tokens`, generate a new one (repo + read:org scopes), then save it via the in-app GitHub Token dialog (it syncs to your account). Never paste a token into chat again — enter it directly into the dialog.
- `.gitignore` now protects `.env`, `node_modules/`, the PHI-bearing `runs/`, the nested `alis-automation-hub/` repo, and local previews. Verify nothing sensitive is already tracked with `git ls-files`.
- Supabase **Auth → URL Configuration** must list the GitHub Pages URL under both *Site URL* and *Redirect URLs*, or magic links bounce back to login.

---

## Roadmap / pipeline

### 1. AI weekly digest
A digest of the week's shipping activity (commits, new projects, newly live tools). **Needs:** a Claude API key stored in the Supabase vault + an Edge Function to hold the key server-side (never client-side). Can post to Slack on a schedule once the webhook below exists.

### 2. Dependency graph
Visualize relationships between projects. **Needs:** one new DB column for declared dependencies + an SVG node renderer panel.

### 3. Slack webhook digest
Blocked only on the incoming webhook URL. Get it at `api.slack.com/apps` → your workspace app → Incoming Webhooks → Add New Webhook → copy the `https://hooks.slack.com/services/...` URL. Once provided, the scheduled Monday-morning digest can be wired in one session.

### 4. Email branding (polish)
Magic links currently send from Supabase's default domain. To send from `go-alis.com`: set up Resend (free tier), add it as the SMTP provider in Supabase → Auth → SMTP Settings, and verify the domain (needs DNS access). Not critical.

### 5. Regenerate `nexus-schema.sql`
Pull the live table definitions from Supabase and commit an accurate schema file so the repo documents itself (see Known issue #1).

---

## Done / working

- 14-module architecture, all single-responsibility.
- Supabase auth: magic link + password, implicit flow for static hosting; resilient `enterApp` boot path (v8).
- v8 design-system overhaul of `nexus.css`.
- GitHub token persisted to Supabase user metadata (survives across devices/refreshes).
- Multi-user: team badges, contributor chips, "you" tag, owner filtering.
- Live activity pulse derived from existing data (no extra table).
- Access paths: LIVE badge, "Try it →" button, deploy URL field, detail-panel access button.
- Jaccard "Similar Projects" in the slide-over.
- Health scoring + team skill matrix.
- Realtime subscription: new projects appear without refresh.
- Consistent XSS protection (`escHtml`) and URL sanitization (`safeUrl`).
- `loadAndRender()` hardened with timeout + error surfacing (v8).
- Repo docs: `README.md`, `CHANGELOG.md`, `.gitignore` (v8).
