# LuCI Network Theme — Design Document

Status: first implementation

Target: OpenWrt 25.12.5 / current LuCI

Package: `luci-theme-unifi`

## Product intent

The theme should make an OpenWrt gateway feel like part of a polished,
centrally managed network console without pretending LuCI is a different
product. The experience is calm, information-dense, fast, and device-oriented:
light neutral surfaces, a stable application frame, precise blue selection,
small status cues, restrained motion, and navigation that does not jump between
pages.

The key product constraint is compatibility. A theme must not need to know the
form model of every LuCI application. Installed packages own their routes,
labels, forms, validation, permissions, translations, and backend calls. This
theme owns only presentation and navigation rendering.

For the first release, preservation is absolute: no stock LuCI field, status
value, chart, table column, action, page, menu node, apply/revert control, or
authentication/ACL decision is removed or replaced. Visual reordering of the
top-level menu does not alter the dispatcher tree or page contents.

## Principles

1. **LuCI remains the platform.** Never fork core views or rewrite UCI actions.
2. **Progressive enhancement.** Search, motion, color preference, and the mobile
   drawer enhance the UI; they do not replace navigation links.
3. **Unknown apps are first-class.** New menu nodes get a neutral icon and are
   rendered from LuCI's live menu tree.
4. **No cloud dependency.** Fonts, icons, and scripts are local and the UI works
   when the WAN is down.
5. **Respect constrained hardware.** No framework, runtime dependency, canvas,
   polling loop, or large image background.
6. **Familiar, not counterfeit.** Match the interaction quality and visual
   language while using original branding and open assets.

## Architecture

```text
LuCI route + view
       │
       ├── upstream luci-theme-bootstrap CSS (compatibility baseline)
       │
       └── luci-theme-unifi
             ├── header.ut / footer.ut       application frame
             ├── menu-unifi.js               live menu, tabs, search, preferences
             ├── cascade.css / mobile.css    visual system and responsive layout
             ├── sysauth.ut / sysauth.js     sign-in presentation
             └── local font + original mark  offline assets
```

Depending on `luci-theme-bootstrap` is deliberate. Its CSS tracks obscure and
new LuCI widgets. Importing it first gives every application a supported base;
the smaller theme layer can then be maintained as a visual delta. The header
and menu renderer follow the current ucode theme API and `ui.menu.load()`.

## Information architecture

The sidebar uses a task-oriented visual order while preserving every route and
LuCI title:

1. Status
2. Network
3. Services
4. VPN
5. System
6. unknown third-party groups, in LuCI-provided order
7. Log out

The current section is expanded. Other sections remain available in a single
click, and their children can be toggled without navigation. Deep pages remain
LuCI tabs in the content area. If multiple dispatcher modes exist, they appear
as an **Applications** group near the bottom of the sidebar.

This is intentionally a visual reordering only. Replacing canonical LuCI menu
titles or moving individual pages between server-side parents would create
translation, ACL, plugin, and upgrade problems.

## Interaction model

### Navigation search

Press `/` or select Search to open a modal command menu. It indexes the menu
tree already authorized for the signed-in user. Search is local, immediate, and
never sends route names elsewhere. Arrow keys move, Enter opens, Escape closes.

### Color mode

The top-right control cycles Automatic → Light → Dark. The selection is stored
in browser-local storage, never router configuration, because it is a per-user,
per-browser presentation choice. Automatic tracks `prefers-color-scheme`.

### Motion

Durations are 120–300 ms. Navigation uses opacity/position changes rather than
decorative movement. `prefers-reduced-motion` reduces transitions and animation
to effectively zero.

### Responsive behavior

At 900 px the fixed sidebar becomes an off-canvas drawer. The header retains
page context and high-value actions. Form labels stack over controls and wide
tables scroll inside their own surface. At 520 px nonessential status chips are
hidden.

## Visual system

- Font: Inter Variable, served locally, with native UI font fallbacks.
- Accent: `#006fff` light / `#4b9cff` dark.
- Surfaces: white cards on `#f4f5f7`; dark surfaces use neutral blue-gray.
- Radius: 5 px controls, 8 px panels, 12–14 px elevated dialogs.
- Borders: low-contrast structure replaces heavy shadows.
- Type: 14 px base; 10–13 px chrome; 22–24 px primary headings.
- Icons: original inline outline set with 24 px view boxes and 1.7 px strokes.

Tokens live at the top of `cascade.css`. Components consume tokens instead of
literal colors wherever browser support permits.

## Accessibility

- semantic header, navigation, main, dialog, and button elements;
- skip link and visible browser focus behavior;
- `aria-current` on the active route and expanded state on drawer/sections;
- keyboard-complete command menu;
- no information represented by color alone;
- reduced-motion support;
- labels remain connected to LuCI-generated fields;
- target contrast is WCAG AA for normal text in both modes.

The first full router QA pass must include axe or an equivalent audit and
keyboard-only traversal.

## Compatibility matrix

Before a stable release, verify at minimum:

| Area | Pages / behavior |
|---|---|
| Authentication | valid login, bad credentials, password manager, auth plugin fields |
| Status | overview, realtime graphs, routes, processes, system log |
| System | admin, software/APK, startup, scheduled tasks, backup/flash, reboot |
| Network | interfaces, device tabs, wireless, DHCP/DNS, routes, firewall |
| Forms | depends visibility, dynlists, dropdowns, validation, file upload |
| State | save, apply, rollback countdown, revert indicator, modal errors |
| Plugins | unknown top-level group, deep tabs, long labels, custom view CSS |
| Layout | 320, 390, 768, 1024, 1440 px; light/dark; long translations |
| Browser | current Firefox, Chromium, Safari; mobile Safari/Chromium |
| A11y | keyboard, screen-reader landmarks, zoom 200%, reduced motion |

## Packaging and updates

Tagged releases build in the official 25.12.5 SDK. The workflow signs the APK
repository index with an ECDSA P-256 private key stored as a GitHub secret,
publishes `packages.adb`, the noarch APK, the public key, and the public-key
digest as release assets. A router trusts the key and feed once. Thereafter,
LuCI System → Software obtains new versions during **Update lists** and offers a
normal package upgrade.

The private signing key is never committed. Rotating it requires publishing and
installing the replacement public key before releases switch to the new signer.

## Non-goals

- reproducing Ubiquiti logos, names inside the product shell, or proprietary art;
- changing UCI schema or server endpoints;
- merging unrelated LuCI pages into a custom dashboard;
- adding telemetry, cloud login, or remote resources;
- hiding capabilities that do not fit the preferred navigation order;
- styling only a curated set of applications at the expense of unknown apps.

## Release gates

1. Static checks pass.
2. SDK package build succeeds.
3. Signed repository installs without `--allow-untrusted` after key bootstrap.
4. Compatibility matrix has no blocking regressions.
5. Light/dark screenshots at desktop and phone widths are reviewed.
6. A theme upgrade preserves the selected theme and browser preferences.
7. Removing the package deletes its theme registration and, when active,
   selects the installed Bootstrap fallback so LuCI remains reachable.
