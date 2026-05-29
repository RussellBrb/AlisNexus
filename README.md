# Nexus — ALIS Project Hub

A private team project hub for ALIS. Team members register their GitHub repos, see what everyone is building, and track project health — all in one place. Nexus surfaces GitHub activity automatically, derives a team skill matrix from real project data, and scores momentum so you can tell at a glance which projects are hot and which are stalling.

**Live:** https://russellbrb.github.io/AlisNexus

---

## Highlights

- **Single source of truth** for team project visibility across Engineering, Onboarding, Customer Success, and Sales.
- **GitHub enrichment** — commits, languages, README previews, and contributors are pulled in automatically per registered repo.
- **Health & momentum scores** — each project gets a computed health label (Healthy / Steady / Quiet) from its activity signals.
- **Skill matrix** — team capability and expertise are derived from actual project tech stacks, not self-reported.
- **Live activity feed** — a network pulse of recent commits, new projects, and deploys, updated in real time via Supabase Realtime.

---

## Architecture

Nexus is a **static site** — no server, no build step. It's plain HTML, one CSS file, and a set of vanilla-JS modules loaded in dependency order. All data and auth live in **Supabase** (Postgres + Auth + Realtime). It deploys as-is to GitHub Pages.

```
index.html        Markup only, no logic. Loads the 14 JS modules in order.
nexus.css         All styles + design tokens (single source of truth for theming).
js/               The application, split into single-responsibility modules.
nexus-schema.sql  Reference SQL (see "Schema drift" note below).
```

### JS module map (load order matters)

Scripts load at the end of `<body>` in this exact order; the order matches the call graph, so don't reshuffle it:

| # | Module | Lines | Responsibility |
|---|--------|------:|----------------|
| 1 | `config.js` | ~107 | Constants, the `NX` shared-state object, Supabase client, and DOM/security utilities (`el`, `escHtml`, `safeUrl`). |
| 2 | `auth.js` | ~242 | Login (magic link + password), onboarding, profile application, avatar menu, and the boot sequence (`enterApp` / `bootAuth`). |
| 3 | `github.js` | ~149 | GitHub API enrichment and the personal-access-token dialog. |
| 4 | `similarity.js` | ~58 | Jaccard similarity engine — pure functions, no side effects. |
| 5 | `data.js` | ~72 | Supabase CRUD, the Realtime subscription, and `loadAndRender()`. |
| 6 | `render.js` | ~207 | Project cards, filter pills, contributor chips, and hero metrics. |
| 7 | `markdown.js` | ~144 | Lightweight Markdown renderer for README previews. |
| 8 | `detail.js` | ~276 | The slide-over project detail panel. |
| 9 | `modal.js` | ~274 | Add-project modal, GitHub preview, language selector, team/status selectors. |
| 10 | `pulse.js` | ~141 | The live network-activity feed. |
| 11 | `health.js` | ~161 | `computeHealth()` and the health chips / distribution bar. |
| 12 | `skills.js` | ~238 | `computePersonSkills()` and the team skill matrix. |
| 13 | `profile.js` | ~274 | The profile panel and people roster. |
| 14 | `app.js` | ~17 | Search debounce, input wiring, and the call to `bootAuth()`. |

### `NX` — shared state

`NX` (defined in `config.js`) is the single mutable state object the whole app reads and writes. Notable members: `allProjects` / `filtered` (project data), `activeTeam` / `activeStatus` / `activeOwner` / `activeHealth` (filters), `supabaseUser`, `ghToken`, and `_booted` (guards against double-boot). `userProfile` and `ghToken` are getter/setter-backed by `localStorage` so they survive a refresh.

### Two main computed functions

- `computeHealth(project)` — turns activity signals into a health score and label.
- `computePersonSkills(name)` — derives a person's skills from the tech stacks of the projects they own.

### Panel openers (all close via `closeOverlay()`)

`openDetail(id)`, `openProfile(name)`, and `openPeopleRoster()` open the three main panels; the shared `#overlay` dismisses them through `closeOverlay()`, which dispatches to the correct close handler.

---

## Authentication flow

Sign-in supports two paths, both restricted to `@go-alis.com` and `@medtelligent.com` (enforced client-side via `ALLOWED_DOMAINS` and server-side via Row-Level Security):

1. **Magic link** — `signInWithOtp` emails a link that returns to wherever the app is running (`emailRedirectTo` is computed from `window.location`, so it works both locally and on GitHub Pages).
2. **Password** — `signInWithPassword`.

The app enters via a single idempotent `enterApp(user)` function. It's called **directly** from a successful password sign-in (and from `getSession()` on load and the `onAuthStateChange` listener as a backup) rather than depending solely on the `SIGNED_IN` event, which does not reliably fire for the password grant. `NX._booted` ensures it only runs once.

> **Supabase dashboard requirements:** the GitHub Pages URL must be present in **Auth → URL Configuration** under both *Site URL* and *Redirect URLs*, and any dashboard-created user must be confirmed, or sign-in will fail.

---

## Data model

The live `projects` table is the source of truth for the grid. `data.js` maps these columns (this reflects the **actual** table the app reads):

`id`, `created_by`, `created_at`, `name`, `github_url`, `deploy_url`, `one_liner`, `description`, `tags`, `domain`, `tech_stack`, `team`, `status`, `owner`, `client`, `last_updated`, `latest_update`, `update_log`.

> **Schema drift note:** `nexus-schema.sql` in this repo is an **earlier draft** and does not match the live table (it uses `github_repo`, `github_data`, `owner_name`, `visibility`, etc.). Treat the column list above (from `data.js`) as authoritative until the SQL file is regenerated from the live schema.

---

## Local development

There's no build step. Open `index.html` in a browser, or serve the folder:

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000
```

`nexus_preview.html` is a static, sample-data mock of the UI (no Supabase needed) for quickly eyeballing styling changes. It's git-ignored.

---

## Deploy workflow

The repo folder **is** the deploy source. Edit files, commit, and push — GitHub Pages serves the result in ~60 seconds.

```bash
git add <files>
git commit -m "describe the change"
git push origin main
```

### Cache-busting (important)

Browsers and the GitHub Pages CDN cache aggressively. Every script and the stylesheet carry a `?v=N` query param (currently **`v=8`**). When you add or change a JS file, three things must happen **in the same commit**:

1. Add/edit the file itself.
2. Add its `<script src="js/newfile.js?v=N">` tag to `index.html`.
3. Bump **all** existing `?v=N` tags (scripts and `nexus.css`) to `?v=N+1`.

If those get out of sync, the browser serves stale files and your change appears not to work. Confirm new code actually loaded with `typeof someNewFunction` in the console.

> Edit `index.html` with a real editor — not a shell `sed -i` against a cloud-synced folder. A `sed` write racing with sync once truncated the script list and silently broke the page.

If `git push` fails with an `index.lock` / `HEAD.lock` error:

```powershell
Remove-Item ".git\index.lock" -Force   # or HEAD.lock
```

---

## Security

- `SUPA_KEY` in `config.js` is the **anon/public** key — safe to expose in client code. The **service_role** key must never appear in any client-side file.
- The GitHub PAT is stored in Supabase user metadata + `localStorage`. Never log or expose it.
- All user-supplied strings pass through `escHtml()` before any `innerHTML` assignment; all URLs pass through `safeUrl()`, which rejects anything that isn't `http(s)://`.
- Access is gated to `go-alis.com` and `medtelligent.com` — client-side via `ALLOWED_DOMAINS` and server-side via Row-Level Security policies keyed on the JWT email.
- The `runs/` folder may contain PHI. It is git-ignored and must never be committed or backed up to the cloud.

---

## Roadmap

- **AI weekly digest** — Claude API key in the Supabase vault + an Edge Function.
- **Dependency graph** — one new DB column + an SVG node renderer.
- **Slack webhook digest** — pending a webhook URL.
