# LuCI Network Theme

A modern, controller-style LuCI theme for OpenWrt 25.12 and later. It takes
interaction and visual cues from contemporary managed-network consoles while
remaining a normal LuCI theme: existing LuCI applications, ACLs, translations,
forms, indicators, apply/revert behavior, and server-side menu entries continue
to work.

This is an independent project. It is not affiliated with or endorsed by
Ubiquiti Inc. and does not ship Ubiquiti trademarks or proprietary assets.

## Status

Version 0.2 adds the controller-style telemetry and port presentation pass.
See [the design document](docs/DESIGN.md) and
[the interaction questionnaire](docs/INTERACTIONS.md) for the compatibility
decisions behind the theme.

Implemented:

- controller-style fixed top bar and application sidebar;
- original semantic SVG icon system for primary and secondary navigation;
- LuCI-native dynamic menus, including third-party `luci-app-*` packages;
- reordered high-level navigation without changing LuCI routes;
- live network-health cards using LuCI's existing system and device models;
- physical Ethernet port tiles with carrier, role, duplex, and negotiated speed;
- restyled stock port status including VLAN, PoE, counters, and tooltips;
- controller-style realtime throughput charts while retaining native polling;
- responsive status-overview card grid and semantic health colors;
- keyboard navigation search (`/`), light/dark/automatic color modes;
- responsive drawer navigation and touch-friendly controls;
- custom sign-in experience;
- locally served Inter variable font (no CDN or WAN dependency);
- reduced-motion support and keyboard-visible controls;
- inherited upstream Bootstrap compatibility for LuCI widgets;
- OpenWrt 25.12 APK build and signed repository release workflow.

## Install from the signed APK feed

The following commands are the production installation path. The pinned key
digest must match the
`openwrt-unifi-public-key.pem.sha256` value attached to that release. Do not
copy a digest from an untrusted mirror.

```sh
wget -O /tmp/openwrt-unifi-public-key.pem \
  https://github.com/alexanderjlynn/openwrt-luci-theme-unifi/releases/latest/download/openwrt-unifi-public-key.pem

# Verify the repository signing key against the digest pinned by this project.
echo '80051be6c9be1f0426d942fb90b5769b8a0ff2bbbbf9b1753e5a3b692c3d59b7  /tmp/openwrt-unifi-public-key.pem' \
  | sha256sum -c -

cp /tmp/openwrt-unifi-public-key.pem \
  /etc/apk/keys/openwrt-unifi-public-key.pem
chmod 0644 /etc/apk/keys/openwrt-unifi-public-key.pem
rm -f /tmp/openwrt-unifi-public-key.pem

echo 'https://github.com/alexanderjlynn/openwrt-luci-theme-unifi/releases/latest/download/packages.adb' \
  > /etc/apk/repositories.d/openwrt-unifi.list

# Preserve the custom feed across normal sysupgrade backups.
mkdir -p /lib/upgrade/keep.d
printf '%s\n' \
  /etc/apk/keys/openwrt-unifi-public-key.pem \
  /etc/apk/repositories.d/openwrt-unifi.list \
  > /lib/upgrade/keep.d/openwrt-unifi

apk update
apk add luci-theme-unifi
```

The package selects itself on first installation. To select it manually:

```sh
uci set luci.main.mediaurlbase='/luci-static/unifi'
uci commit luci
service uhttpd restart
```

If the browser retained an old stylesheet, perform a hard refresh once.

### Updating through LuCI

The repository file installed above is what makes automatic update discovery
work. In LuCI:

1. Open **System → Software**.
2. Select **Update lists**.
3. Filter for `luci-theme-unifi`.
4. Use **Upgrade** when a newer version is available.

From SSH, upgrade only this package:

```sh
apk update
apk upgrade luci-theme-unifi
```

If **System → Software** is not present on a minimal LuCI image, install its
official front end once with `apk add luci-app-package-manager`.

Do not use an unqualified `apk upgrade` on OpenWrt. Firmware packages are built
as a coherent set; use sysupgrade/Attended Sysupgrade for the operating system.
The theme's custom feed and key are included in backup retention above, but a
remote Attended Sysupgrade service may still require the feed to be allowed or
re-added after flashing.

## Build in an OpenWrt tree

Place this repository at `package/luci-theme-unifi` in an OpenWrt 25.12 tree or
SDK, then run:

```sh
make menuconfig
# LuCI → Themes → luci-theme-unifi
make package/luci-theme-unifi/compile V=s
```

The package is architecture-independent. Its explicit dependency on
`luci-theme-bootstrap` is intentional: the upstream theme provides the broad
and continuously maintained LuCI widget compatibility layer. This project
overrides the application shell and presentation instead of maintaining a
fragile fork of all base control styles.

## Development checks

```sh
./scripts/check.sh
```

For meaningful visual QA, install the package on a disposable OpenWrt 25.12.5
router or VM and exercise both core LuCI and any third-party applications you
use. The test matrix is in [the design document](docs/DESIGN.md#compatibility-matrix).

## License

Apache-2.0. The bundled Inter font is licensed under the SIL Open Font License
1.1; its license is included beside the font asset.
