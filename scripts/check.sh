#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

required='Makefile
root/etc/uci-defaults/30_luci-theme-unifi
ucode/template/themes/unifi/header.ut
ucode/template/themes/unifi/footer.ut
ucode/template/themes/unifi/sysauth.ut
htdocs/luci-static/unifi/cascade.css
htdocs/luci-static/unifi/widgets.css
htdocs/luci-static/unifi/mobile.css
htdocs/luci-static/unifi/mark.svg
htdocs/luci-static/unifi/icons.svg
htdocs/luci-static/resources/menu-unifi.js
htdocs/luci-static/resources/view/unifi/sysauth.js'

printf '%s\n' "$required" | while IFS= read -r path; do
	[ -f "$path" ] || { printf 'missing: %s\n' "$path" >&2; exit 1; }
done

node -e 'const fs=require("fs"); for (const f of process.argv.slice(1)) new Function(fs.readFileSync(f,"utf8"));' \
	htdocs/luci-static/resources/menu-unifi.js \
	htdocs/luci-static/resources/view/unifi/sysauth.js

for css in htdocs/luci-static/unifi/cascade.css htdocs/luci-static/unifi/widgets.css htdocs/luci-static/unifi/mobile.css; do
	open=$(tr -cd '{' < "$css" | wc -c | tr -d ' ')
	close=$(tr -cd '}' < "$css" | wc -c | tr -d ' ')
	[ "$open" = "$close" ] || { printf 'unbalanced braces: %s\n' "$css" >&2; exit 1; }
done

if grep -n '@import' htdocs/luci-static/unifi/*.css; then
	printf 'Stylesheets must load directly with versioned URLs, not imports.\n' >&2
	exit 1
fi

grep -Fq 'widgets.css?v={# PKG_VERSION #}' ucode/template/themes/unifi/header.ut

grep -q "luci-theme-bootstrap" Makefile
grep -q '^LUCI_NAME:=luci-theme-unifi$' Makefile
grep -q '^LUCI_MINIFY_CSS:=0$' Makefile
grep -q '^LUCI_URL:=https://github.com/alexanderjlynn/openwrt-luci-theme-unifi$' Makefile
grep -q "menu-unifi" ucode/template/themes/unifi/footer.ut
grep -q "view/unifi/sysauth.js\|unifi.sysauth" ucode/template/themes/unifi/sysauth.ut

printf 'Theme source checks passed.\n'
