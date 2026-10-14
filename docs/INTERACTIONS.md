# Interaction Questionnaire

These are the product decisions that most affect the next implementation pass.
Recommended defaults are marked. Short answers are fine; for example:
`1B, 2A, 3C, 4A`.

## 1. Navigation density

- **A — Compact controller (recommended):** 240 px sidebar, 34–38 px rows,
  current section expanded.
- **B — Comfortable:** 264 px sidebar, 40–44 px rows, more whitespace.
- **C — Icon rail + flyout:** 56 px rail by default, expand/fly out on demand.

## 2. Landing experience

- **A — Native LuCI status (recommended):** preserve Status → Overview and make
  it look excellent. Lowest maintenance.
- **B — Curated dashboard:** add a theme-owned overview with WAN, clients,
  radios, CPU, memory, and alerts. More controller-like, but now the package is
  partly a LuCI application and needs RPC/ACL maintenance.
- **C — Topology first:** attempt a network topology landing page. Highest
  complexity and limited by what OpenWrt can reliably discover.

## 3. Menu naming

- **A — Keep LuCI labels (recommended):** familiar, translated, plugin-safe.
- **B — Controller vocabulary:** rename Status → Insights, Network → Settings,
  etc. Visually closer, but documentation and translations no longer match.
- **C — Hybrid:** keep LuCI labels and add small controller-style group labels.

## 4. Apply/revert interaction

- **A — Native behavior, upgraded styling (recommended):** keep LuCI's proven
  apply/rollback logic and make the pending-change indicator prominent.
- **B — Persistent bottom apply bar:** mirror pending changes into a fixed bar.
  Better visibility, but requires careful integration with LuCI UI internals.

## 5. Color mode

- **A — Automatic + manual cycle (recommended):** current implementation.
- **B — Light only:** closest to the canonical bright console appearance.
- **C — Explicit light/dark setting:** no automatic OS preference.

## 6. Icons

- **A — Minimal outline set (recommended):** small original SVG path set plus a
  safe fallback for unknown plugins.
- **B — Bundle Lucide:** broader, consistent Apache/MIT-compatible icon catalog,
  at a modest package-size cost.
- **C — App-specific custom icons:** most polished, most ongoing curation.

## 7. Branding

- **A — “Network” + original node mark (recommended):** current, clean, and
  independently publishable.
- **B — “OpenWrt Network”:** clearer product identity.
- **C — User-configurable name/logo:** read from a small UCI config and expose a
  LuCI settings page; useful for integrators but adds package code and ACLs.

## 8. Small-screen tables

- **A — Horizontal scroll (recommended):** reliable for every LuCI app.
- **B — Row cards:** more readable on phones but fragile because third-party
  columns and generated `data-title` metadata vary.
- **C — Hybrid:** cardify known core tables, scroll unknown tables.

## 9. Update channel

- **A — Stable tags only (recommended):** `latest` release feed.
- **B — Stable and beta feeds:** separate signed indexes and opt-in prereleases.
- **C — Rolling main:** every successful main build becomes available.

## 10. Device fleet behavior

- **A — Per-router only (recommended):** visual design evokes central control;
  each LuCI instance manages itself.
- **B — Router switcher:** user-configured links to other gateways, opening each
  router's LuCI. No credential sharing.
- **C — True controller:** separate service aggregates multiple routers. This is
  a new product, not a low-maintenance theme.
