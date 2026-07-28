# Deitemeyer Brothers — Design System

The brand and UI system for **Deitemeyer Brothers Roofing & Construction** (Van Wert, OH), a family-owned design-build contractor. It was **rebuilt from the three live internal tools** — the Sales & Operations Dashboard, DB Cam, and the Team Portal — so the system now matches what the company actually ships rather than an idealized brand deck.

> **Namespace:** components are exposed at `window.DeitemeyerBrothersDesignSystem_d0550d`.
> **Entry stylesheet:** consumers link only `styles.css` (it `@import`s all tokens + fonts).

## What this system is
It is primarily an **internal-tooling system**: data-dense, fast to scan, honest about where numbers come from. Navy carries the chrome, electric green marks what is live or on-goal, near-black bands carry the headline numbers, and a wide-tracked uppercase mono label sits above almost everything. The marketing surface (public site) shares the same palette and type — it simply uses the warm-cream neutrals instead of the cool slate ones.

Two neutral families, one rule: **warm cream for anything a customer sees, cool slate for anything the team works in.** Never mix them on one surface.

## Sources
- Screens: Sales & Operations Dashboard (Sales KPI report), DB Cam (Photo Report Generator), Team Portal ("Done Better" launcher). Colors, type roles, label grammar, and component inventory were taken from these.
- `assets/db-logo-wordmark.png` — primary horizontal wordmark (DEITEMEYER heavy condensed italic + "Brothers" script + ROOFING & CONSTRUCTION lockup).
- `assets/db-badge.png` — circular "GET IT DONE BY DB" seal.
- `assets/dbcam-logo.jpg` — DB Cam sub-brand (roofline + camera, "DB" navy / "Cam" green).

## ⚠️ Font substitution (needs your input)
The wordmark uses a **proprietary heavy-condensed italic face plus a script** ("Brothers", "Better."). Those are **artwork only** — never set as type. The system uses the closest **Google Fonts** matches, loaded in `tokens/fonts.css`:
- **Archivo** — bold neo-grotesque headings, uppercase (`SALES KPI`, `MONDAY, JULY 27`).
- **Barlow** — body / UI copy, the only lowercase face.
- **IBM Plex Mono** — every label, table header, tag, nav number and timestamp.

Send the real files if you have them and we'll self-host them.

---

## CONTENT FUNDAMENTALS — how we write
- **Voice:** plain, factual, unhurried. These are working documents. Confidence comes from specificity, never from adjectives.
- **Tools state what a number is and where it came from.** If a figure is derived, say how (`Callout`). If data is stale, say when it loaded. Never present a number without its qualifier.
- **Casing:** headings UPPERCASE (Archivo). Body sentence case (Barlow). Labels UPPERCASE mono, wide tracking. Tool buttons are **sentence case** ("Refresh data", "Clear dates") — only marketing CTAs uppercase.
- **Label grammar:** clauses separated by a middot, never a dash — `TOTAL COLLECTED · WEEK 29 · THU–WED`. Accent **exactly one word** per label (`ON THE JOB *TODAY*`); two accents and the device stops working.
- **Roadmap is visible, not faked.** In-build and planned tools stay on screen, dimmed and badged, with no link.
- **Emoji:** none in the system. (The live portal uses reaction emoji as user-generated content — that is data, not UI.)
- **Marketing voice examples:** *"Built to last, not to sell."* / *"Free, no-pressure estimate. We'll inspect, explain your options, and put it in writing."*

## VISUAL FOUNDATIONS
- **Color:** **navy `#1A4789`** is the primary — every button, link, header, and the side rail (`--navy-800`) and data bands (`--navy-900`). **Electric green `#3CC84A`** is the accent and means exactly three things: *live*, *positive/on-goal*, or *the emphasized word in a label*. It never carries a primary action. Green shifts by surface: `700` as text on light, `400` on navy, `300` for a figure on near-black.
- **Backgrounds:** `--surface-app` (cool slate) for tools, `--surface-page` (warm paper) for marketing, `--surface-band` (near-black) for metric strips, `--surface-nav` (navy) for the rail. At most two background colors per layout plus one dark band.
- **Gradients:** only two exist, both navy-based and both structural: `--surface-hero` (navy → near-black) and `--surface-kpi` (navy → deep green, the report headline). Never decorative.
- **Type:** Archivo 700–800 UPPERCASE headings; tracking tightens as size grows (`-0.02em` display) and opens at h4 (`+0.09em`). Metrics use Archivo with **tabular figures** (`.db-figures`) so columns align. Body Barlow 400/600 at 18/16/14/13px.
- **The label device:** UPPERCASE IBM Plex Mono 600, `.14em` tracking for eyebrows, `.09em` for tags and nav, `.02em` for timestamps. Warm gray on light (`--text-label`), `--navy-200` on dark. This is the loudest signal in the system — see `guidelines/brand-eyebrow.html`.
- **Numbers:** always pre-formatted and always qualified. Money short-forms as `$4.3M` / `$86K` in strips, full precision in tables.
- **Logo:** the wordmark is navy and **disappears on dark** — on any dark surface it sits on a small white plaque (`--radius-sm`). `SideNav` handles this automatically. Never redraw or recolor the marks.
- **Corners:** controls and plaques `--radius-sm 3px`; cards, tables, buttons `--radius-md 5px`; banners and large cards `--radius-lg 8px`. Pills only for delta chips.
- **Borders:** 1px hairline — `--border-hairline` on warm surfaces, `--border-hairline-app` on slate, `--border-on-dark` on navy. Green 3px left bar marks the active nav item; navy 2px underline marks the active tab; `--ring-selected` marks a selected tile.
- **Shadows:** minimal. Tool surfaces are mostly flat and separated by hairlines; shadow appears only on hover and on raised cards. Never colored glows. Focus ring is a soft navy halo.
- **Motion:** 120–320ms, `--ease-standard`. Fades, hairline/background shifts, small lifts. Nothing bounces.

## ICONOGRAPHY
- **Line icons only** — **[Lucide](https://lucide.dev)** via CDN (`https://unpkg.com/lucide@0.454.0`). Usage: `<i data-lucide="home"></i>` then `lucide.createIcons()`. Common glyphs: `home`, `hard-hat`, `shield-check`, `camera`, `trending-up`, `table`, `clock`, `map-pin`, `arrow-up-right`, `check`, `star`, `phone`.
- Tool logos (DB Cam etc.) act as icons inside `AppTile`.
- This is a **substitution** — no house icon set was provided.

---

## Components (`window.DeitemeyerBrothersDesignSystem_d0550d`)
React primitives. Each lives in `components/<group>/<Name>.jsx` with a `.d.ts` and `.prompt.md`.

**data/** — the reporting language
- **MonoLabel** — the signature uppercase mono label; `number` prefix, `<em>` for the one accented word.
- **MetricStrip** — full-bleed near-black band of headline numbers. Takes `<Stat tone="dark">` children.
- **KpiBanner** — the single hero figure at the top of a report, on the navy→green gradient, with supporting columns.
- **DataTable** — mono headers, tabular figures, green TOTAL row. Mark money/percent columns `numeric`.
- **Callout** — how a figure was derived, or the caveat attached to it.

**layout/**
- **SideNav** — navy tool rail: white logo plaque, mono group headings, numbered items, footer status slot.
- **TabBar** — numbered top-level tabs, navy underline on active (green on dark).
- **PanelHeader** — numbered in-tool section header with right-hand mono meta.
- **AppTile** — launcher tile for one tool, with `live` / `in-build` / `planned` states.
- **SectionHeader** — marketing-page opener: eyebrow + uppercase title + green rule.

**content/**
- **Card** — base surface; elevation + optional navy `accentTop`.
- **Badge** — mono status tag; `green`/`navy`/`neutral`/`warm`/`warning`/`danger`, `variant="on-dark"` for dark bands, `shape="pill"` for delta chips.
- **Stat** — one metric: tabular figure + mono caption + optional delta chip; `tone="dark"` inside a strip.
- **ServiceCard**, **Testimonial** — marketing-site tiles.

**forms/**
- **Button** — `primary` (navy, the default), `accent` (green, go/positive), `outline`, `ghost`, `on-dark`, `mono` (outlined in-app toggle). Sentence case unless `uppercase`.
- **IconButton**, **Input**, **Select**, **Checkbox** — navy focus and fill.

## Templates
- **`templates/tool-report/`** — the internal tool page: navy rail, numbered tabs, KPI banner, numbered panel with derivation callout and report table, dark metric band. Copy this folder to start a new tool. `ds-base.js` is the one file to repoint at the bound design system.

## UI kits
- **`ui_kits/website/`** — contractor marketing homepage (header, hero, services, process, reviews, CTA, footer, estimate modal).
- **`ui_kits/intranet/`** — the Team Portal landing page that masks Google Apps Script URLs behind tiles. Its CSS is deliberately **inlined** so it can be hosted on Google Sites with no dependencies; it does not track this system's tokens automatically.
- **`apps_script/`** — `Code.gs` + `Index.html`, the deployable Apps Script form of the portal.

## Foundations (Design System tab)
`guidelines/` — colors (navy, green, neutrals, semantic roles), type (display, body, label, scale), spacing (scale, radius & shadow), brand (wordmark plaque rule, badge, the label device).

## Index / manifest (root)
- `styles.css` — entry stylesheet (@import list only).
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `base.css`.
- `components/` — `data/`, `layout/`, `content/`, `forms/`.
- `templates/` — copyable starting folders.
- `ui_kits/`, `apps_script/`, `guidelines/`, `assets/`.
- `thumbnail.html` — project homepage tile.
- `SKILL.md` — Agent-Skills manifest.
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` — **generated**, do not edit.

## Helper classes (from `tokens/base.css`)
`.db-label` (+ `.db-label--on-dark`, and `em` inside it for the accent) · `.db-figures` (tabular numerals) · `.db-rule` (green accent rule) · `.db-grid-navy` (faint grid for navy hero bands).

## Changelog
- **2026-07-27 — redefined from the live tools.** Navy became primary (was green); green narrowed to live/positive/emphasis only. Display face Oswald → Archivo (the tools' headings are not condensed). Added the cool-slate app-chrome neutrals, the `data/` component group, `SideNav`/`TabBar`/`PanelHeader`/`AppTile`, and the `tool-report` template. `--blue-*` tokens renamed `--navy-*`; buttons went sentence case by default.
