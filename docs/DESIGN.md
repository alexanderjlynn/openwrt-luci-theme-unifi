# LuCI Network Theme — Design Document

Status: v0.3.1 original standalone CSS and native-widget regression coverage

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
   independent timer, historical database, or large image background. Live
   values use LuCI's shared polling scheduler and existing cached models.
6. **Familiar, not counterfeit.** Match the interaction quality and visual
   language while using original branding and open assets.

## Architecture

```text
LuCI route + view
       │
       └── luci-theme-unifi
             ├── header.ut / footer.ut       application frame
             ├── menu-unifi.js               menu, search, preferences, live telemetry
             ├── widgets.css                 original native-widget state/presentation rules
             ├── cascade.css                 tokens, console shell, telemetry and content surfaces
             ├── mobile.css                  responsive console shell
             ├── sysauth.ut / sysauth.js     sign-in presentation
             └── local font + original SVGs  offline assets
```

No upstream theme stylesheet is imported or requested. The Bootstrap package
dependency is retained solely as the installed recovery theme when this package
is removed. Original CSS implements the DOM classes and state attributes of
native LuCI widgets, not a fork of their JavaScript. This increases CSS ownership;
maintainers must test the state contracts below when updating the target LuCI
version. The header and menu renderer follow the current ucode theme API and
`ui.menu.load()`.

### Native widget state contracts

- Dropdowns: closed summary, `[display]`, open option list, multi-selection,
  preview clone, optional clearing and custom input. LuCI positions the list
  inline and uses the max-height transition's end event to focus an option.
- Dynamic lists: native item/add-input DOM, removable item hit area, drag/drop
  states and hidden-value serialization.
- Tabs: the menu stays adjacent to its panes. Inactive panes collapse by height,
  not `display:none`; native validation and active-pane events remain intact.
- Dialogs: `body.modal-overlay-active` controls the native overlay. Escape and
  buttons remain handled by LuCI, including confirmation/rollback dialogs.
- Tooltips: static child tooltips and LuCI's detached, inline-positioned tooltip
  are both supported. Progress-bar title text remains visible above its track.
- Tables: HTML tables and div-based `.table/.tr/.td` render normally; action
  groups wrap without shrinking controls. Div tables become labeled rows on
  narrow screens; wide HTML tables scroll without deleting columns.

The Chromium suite loads actual SDK widget code for these interactions (service
dependencies are stubbed), verifies log/firewall layout fixtures, and fails if
any upstream theme CSS is requested. It does not certify every third-party app.

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
click, and their children can be collapsed with the chevron without navigation.
Page-level options appear as a third vertical level beneath the current page.
On phones, native menus appear as full-width vertical lists above the form.
If multiple dispatcher modes exist, they appear
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

### Live telemetry

Status → Overview and the core interface view receive a progressive telemetry
deck. It reads `network.Device` carrier, negotiated speed, duplex, and byte
counters plus `system.info` uptime and load. Rates are calculated from counter
deltas on LuCI's shared three-second polling scheduler. If an RPC or device
model is unavailable, the stock view remains usable and the enhancement simply
shows an unavailable or empty state.

The stock 25.12 port include remains below the deck and continues to own PoE,
VLAN, zone, counter, and tooltip data. The stock realtime graph views retain
their own data collection; the theme changes their presentation only.

## Visual system

- Font: Inter Variable, served locally, with native UI font fallbacks.
- Accent: `#006fff` light / `#4b9cff` dark.
- Surfaces: white cards on `#f6f7f9`; dark surfaces on neutral `#101316`.
- Radius: 6 px controls, 10 px panels, 12–14 px elevated dialogs.
- Borders: low-contrast structure replaces heavy shadows.
- Type: 14 px base; 11–13.5 px navigation; 26 px page headings.
- Spacing: 24 px card gutters (20 px mobile), 18 px form rows, 32 px label/control
  gaps, 40 px minimum action buttons and 42 px inputs; no fixed text heights.
- Logs: padded, scrollable monospace text with a 1.9 line height. Filtering and
  the complete native log remain available.
- Icons: original local SVG symbol set with 24 px view boxes and 1.7 px strokes.

Tokens live at the top of `cascade.css`. Components consume tokens instead of
literal colors wherever browser support permits.

## Rendering and navigation safeguards

Dynamic SVGs are created with `document.createElementNS()`, never LuCI's
HTML-only `E()` helper. The runtime browser suite uses the pinned SDK's real
DOM factory to catch namespace failures that static mockups cannot expose.
Stock NIC artwork is replaced only for recognized core device icons; adjacent
link speed, PoE, VLAN, zone, counter, and tooltip nodes remain in place.

Category buttons always expand in place on click, keyboard arrows, or mouse hover.
The separate chevron and keyboard left arrow collapse the category.
Expanded state and sidebar scroll persist per browser tab. Leaf links retain
LuCI's native full-page navigation: its view lifecycle, polling cleanup, forms,
and third-party scripts are not compatible with a generic body-swap mechanism.
Theme upgrades change the module and all three stylesheet cache keys
independently of luci-base. Stylesheets load directly, with no unversioned imports.

Page-setting links mirror native LuCI tabs beneath the selected sidebar page.
They forward activation to the original anchor without moving or cloning the
native form menu or its panes. LuCI's `nextElementSibling` contract, conditional
tab visibility, validation counts, active-pane events, and unsaved input nodes
are preserved. Native menus stay visible as vertical lists on mobile and on
custom routes where no selected sidebar page can be identified. The runtime
suite exercises the pinned SDK's actual `ui.tabs.switchTab()` implementation.

There is no Bootstrap cascade to override. Tabs and action buttons have natural
heights and wrapping labels. Form rows use a label/control grid with readable
line heights and a single-column layout at narrower widths. Inactive panes keep
LuCI's collapsed-height behavior while contributing no extra margins. Padding
belongs to the section card itself, so raw text and unknown app content get the
same interior gutters as known core forms.

Native chart styling targets the SVG and its known 300px wrapper, without
clipping the owning section or changing graph geometry. Live port rates use
device counter deltas; they are aggregate RX/TX, not an Internet speed test.
RPC failures show unavailable state and retry on the next shared poll.

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
- replacing LuCI views or storing a second copy of telemetry;
- adding cloud login, remote resources, or a proprietary controller protocol;
- hiding capabilities that do not fit the preferred navigation order;
- styling only a curated set of applications at the expense of unknown apps.

## Release gates

1. Static checks pass.
2. SDK package build succeeds.
3. Signed repository installs without `--allow-untrusted` after key bootstrap.
4. Automated native-widget regression suite passes; record remaining on-router,
   cross-browser and third-party compatibility matrix checks explicitly.
5. Light/dark screenshots at desktop and phone widths are reviewed.
6. A theme upgrade preserves the selected theme and browser preferences.
7. Removing the package deletes its theme registration and, when active,
   selects the installed Bootstrap fallback so LuCI remains reachable.
