# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2026 Alexander J. Lynn

include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-theme-unifi
LUCI_TITLE:=UniFi-inspired Network theme
LUCI_DESCRIPTION:=A polished, responsive network-controller interface for LuCI
LUCI_DEPENDS:=+luci-base +luci-theme-bootstrap
LUCI_MAINTAINER:=Alexander J. Lynn
LUCI_URL:=https://github.com/alexanderjlynn/openwrt-luci-theme-unifi
# The SDK's legacy csstidy pass removes modern @supports rules and custom
# properties. Preserve the authored CSS; HTTP compression handles transfer size.
LUCI_MINIFY_CSS:=0

PKG_LICENSE:=Apache-2.0
PKG_VERSION:=0.2.1
PKG_RELEASE:=1

define Package/luci-theme-unifi/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	[ "$${PKG_UPGRADE}" = 1 ] || {
		[ "$$(uci -q get luci.main.mediaurlbase)" != '/luci-static/unifi' ] || \
			uci set luci.main.mediaurlbase='/luci-static/bootstrap'
		uci -q delete luci.themes.Unifi
		uci commit luci
	}
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
