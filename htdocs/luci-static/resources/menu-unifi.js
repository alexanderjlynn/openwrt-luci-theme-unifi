'use strict';
'require baseclass';
'require ui';

const ICONS = {
	status: '<path d="M4 13a8 8 0 1 1 16 0"/><path d="m12 13 4-4"/><path d="M5 17h14"/>',
	network: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"/>',
	services: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
	vpn: '<path d="M12 3 4.5 6v5c0 4.8 3 8.2 7.5 10 4.5-1.8 7.5-5.2 7.5-10V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
	system: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',
	logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9"/>',
	overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
	wireless: '<path d="M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 17a3 3 0 0 1 4 0"/><circle cx="12" cy="20" r=".7" fill="currentColor" stroke="none"/>',
	interfaces: '<path d="M5 8h14v8H5z"/><path d="M8 12h.01M11 12h.01M15 11v2M18 11v2M9 16v3m6-3v3M7 19h10"/>',
	devices: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
	dhcp: '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 12h4m0 0 4-5m-4 5 4 5"/>',
	routes: '<path d="M5 19V8a3 3 0 0 1 3-3h8"/><path d="m13 2 3 3-3 3M8 19l-3 3-3-3"/>',
	firewall: '<path d="M4 4h16v16H4zM4 9h5V4m6 0v5h5M9 9v6H4m5 5v-5h6v5m0-11v6h5"/>',
	diagnostics: '<path d="M4 19h16M6 16l3-5 3 3 4-8 2 4"/>',
	processes: '<path d="M4 8h16M4 16h16"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="2" fill="currentColor" stroke="none"/>',
	logs: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6M9 15h6"/>',
	realtime: '<path d="M3 13h4l2-6 4 11 2-7 2 2h4"/>',
	administration: '<circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0 1 14 0M18 3v4m-2-2h4"/>',
	startup: '<path d="M12 3v9"/><path d="M7 6.5a8 8 0 1 0 10 0"/>',
	backup: '<path d="M4 5h12l4 4v10H4z"/><path d="M8 5v5h8V5M8 19v-5h8v5"/>',
	reboot: '<path d="M20 11a8 8 0 1 1-2.3-5.7"/><path d="M20 4v7h-7"/>',
	software: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/>',
	default: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>'
};

function icon(name, className) {
	const key = String(name || '').toLowerCase();
	const markup = ICONS[key] ||
		(key.includes('wifi') || key.includes('wireless') ? ICONS.wireless : null) ||
		(key.includes('interface') ? ICONS.interfaces : null) ||
		(key.includes('device') || key.includes('switch') ? ICONS.devices : null) ||
		(key.includes('dhcp') || key.includes('dns') || key.includes('host') ? ICONS.dhcp : null) ||
		(key.includes('route') ? ICONS.routes : null) ||
		(key.includes('firewall') ? ICONS.firewall : null) ||
		(key.includes('diagnostic') ? ICONS.diagnostics : null) ||
		(key.includes('process') ? ICONS.processes : null) ||
		(key.includes('log') ? ICONS.logs : null) ||
		(key.includes('realtime') || key.includes('graph') ? ICONS.realtime : null) ||
		(key.includes('admin') || key.includes('password') ? ICONS.administration : null) ||
		(key.includes('startup') || key.includes('init') ? ICONS.startup : null) ||
		(key.includes('backup') || key.includes('flash') ? ICONS.backup : null) ||
		(key.includes('reboot') ? ICONS.reboot : null) ||
		(key.includes('package') || key.includes('software') ? ICONS.software : null) ||
		ICONS.default;
	const svg = E('svg', {
		'class': className || 'unifi-nav-icon',
		'viewBox': '0 0 24 24',
		'aria-hidden': 'true',
		'focusable': 'false'
	});
	svg.innerHTML = markup;
	return svg;
}

return baseclass.extend({
	__init__() {
		this.searchEntries = [];
		this.searchSelection = 0;
		ui.menu.load().then((tree) => this.render(tree));
	},

	render(tree) {
		const modes = ui.menu.getChildren(tree);
		const requestedMode = L.env.requestpath[0];
		const activeMode = modes.find((node) => node.name === requestedMode) || modes[0];
		if (!activeMode) return;

		this.renderModeMenu(modes, activeMode);
		this.renderMainMenu(activeMode, activeMode.name);
		this.renderTabs(activeMode);
		this.bindShell();
		this.buildCommandMenu();
	},

	renderModeMenu(modes, activeMode) {
		const container = document.querySelector('#modemenu');
		if (!container || modes.length < 2) return;
		const label = E('span', { class: 'unifi-mode-label' }, _('Applications'));
		const list = E('ul');
		modes.forEach((mode) => {
			list.appendChild(E('li', { class: mode === activeMode ? 'active' : '' }, [
				E('a', { href: L.url(mode.name) }, [icon(mode.name), E('span', {}, _(mode.title))])
			]));
		});
		container.append(label, list);
		container.style.display = '';
	},

	renderMainMenu(mode, baseUrl) {
		const container = document.querySelector('#mainmenu');
		const preferred = { status: 10, network: 20, services: 30, vpn: 40, system: 50, logout: 90 };
		const groups = ui.menu.getChildren(mode).map((node, index) => ({ node, index }));
		groups.sort((a, b) => (preferred[a.node.name] || 60) - (preferred[b.node.name] || 60) || a.index - b.index);

		container.appendChild(E('div', { class: 'unifi-nav-heading' }, _('Navigation')));
		groups.forEach(({ node }) => {
			const children = ui.menu.getChildren(node);
			const active = L.env.requestpath[1] === node.name;
			const section = E('section', {
				'class': 'unifi-nav-section' + (active ? ' active open' : ''),
				'data-menu': node.name
			});
			const head = E('div', { class: 'unifi-nav-head' });
			const href = L.url(baseUrl, node.name);
			const link = E('a', { href, class: 'unifi-nav-root' }, [
				icon(node.name), E('span', {}, _(node.title))
			]);
			head.appendChild(link);

			this.addSearchEntry(_(node.title), href, '', node.name);

			if (children.length) {
				const toggle = E('button', {
					type: 'button',
					class: 'unifi-nav-expander',
					'aria-label': _('Expand menu'),
					'aria-expanded': active ? 'true' : 'false'
				}, '⌄');
				toggle.addEventListener('click', () => {
					const open = section.classList.toggle('open');
					toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
				});
				head.appendChild(toggle);
			}
			section.appendChild(head);

			if (children.length) {
				const list = E('ul', { class: 'unifi-nav-children' });
				children.forEach((child) => {
					const selected = active && L.env.requestpath[2] === child.name;
					const childUrl = L.url(baseUrl, node.name, child.name);
					list.appendChild(E('li', { class: selected ? 'selected' : '' }, [
						E('a', { href: childUrl, 'aria-current': selected ? 'page' : null }, [
							icon(child.name, 'unifi-nav-child-icon'), E('span', {}, _(child.title))
						])
					]));
					this.addSearchEntry(_(child.title), childUrl, _(node.title), child.name);
					this.collectSearchChildren(child, childUrl, [_(node.title), _(child.title)]);
				});
				section.appendChild(list);
			}
			container.appendChild(section);
		});
	},

	collectSearchChildren(node, url, trail) {
		ui.menu.getChildren(node).forEach((child) => {
			const childUrl = url + '/' + child.name;
			this.addSearchEntry(_(child.title), childUrl, trail.join(' › '), child.name);
			this.collectSearchChildren(child, childUrl, trail.concat(_(child.title)));
		});
	},

	addSearchEntry(title, url, parent, iconName) {
		if (!title || this.searchEntries.some((entry) => entry.url === url && entry.title === title)) return;
		this.searchEntries.push({ title, url, parent, iconName });
	},

	renderTabs(mode) {
		let node = mode;
		let url = mode.name;
		for (let index = 1; index < 3 && node; index++) {
			node = node.children[L.env.dispatchpath[index]];
			if (node) url += '/' + L.env.dispatchpath[index];
		}
		if (node) this.renderTabLevel(node, url, 0);
	},

	renderTabLevel(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const children = ui.menu.getChildren(tree);
		if (!container || !children.length) return;
		const list = E('ul', { class: 'tabs' });
		let activeNode = null;

		children.forEach((child) => {
			const selected = L.env.dispatchpath[3 + level] === child.name;
			list.appendChild(E('li', { class: selected ? 'active' : '' }, [
				E('a', { href: L.url(url, child.name) }, _(child.title))
			]));
			if (selected) activeNode = child;
		});
		container.appendChild(list);
		container.style.display = '';
		if (activeNode) this.renderTabLevel(activeNode, url + '/' + activeNode.name, level + 1);
	},

	bindShell() {
		const body = document.body;
		const toggle = document.querySelector('#unifi-mobile-toggle');
		const scrim = document.querySelector('#unifi-scrim');
		const closeNavigation = () => {
			body.classList.remove('unifi-nav-open');
			toggle?.setAttribute('aria-expanded', 'false');
			if (scrim) scrim.hidden = true;
		};
		toggle?.addEventListener('click', () => {
			const open = body.classList.toggle('unifi-nav-open');
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
			if (scrim) scrim.hidden = !open;
		});
		scrim?.addEventListener('click', closeNavigation);

		const colorButton = document.querySelector('#unifi-theme-toggle');
		const modes = ['auto', 'light', 'dark'];
		const applyColorMode = (mode) => {
			const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
			document.documentElement.setAttribute('data-color-mode', mode);
			if (dark) document.documentElement.setAttribute('data-darkmode', 'true');
			else document.documentElement.removeAttribute('data-darkmode');
			if (colorButton) colorButton.dataset.mode = mode;
		};
		let colorMode = document.documentElement.getAttribute('data-color-mode') || 'auto';
		applyColorMode(colorMode);
		colorButton?.addEventListener('click', () => {
			colorMode = modes[(modes.indexOf(colorMode) + 1) % modes.length];
			try { localStorage.setItem('luci-unifi-color-mode', colorMode); } catch (e) {}
			applyColorMode(colorMode);
		});
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (colorMode === 'auto') applyColorMode(colorMode);
		});
	},

	buildCommandMenu() {
		const modal = document.querySelector('#unifi-command');
		const input = document.querySelector('#unifi-command-input');
		const results = document.querySelector('#unifi-command-results');
		const button = document.querySelector('#unifi-search-button');
		if (!modal || !input || !results) return;

		let previouslyFocused = null;
		const close = () => {
			modal.hidden = true;
			document.body.classList.remove('unifi-command-open');
			previouslyFocused?.focus();
		};
		const open = () => {
			previouslyFocused = document.activeElement;
			modal.hidden = false;
			document.body.classList.add('unifi-command-open');
			input.value = '';
			this.searchSelection = 0;
			this.renderCommandResults('');
			window.requestAnimationFrame(() => input.focus());
		};
		this.commandNodes = { modal, input, results };
		button?.addEventListener('click', open);
		modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
		input.addEventListener('input', () => { this.searchSelection = 0; this.renderCommandResults(input.value); });
		input.addEventListener('keydown', (event) => {
			const items = Array.from(results.querySelectorAll('a'));
			if (event.key === 'ArrowDown') this.searchSelection = Math.min(items.length - 1, this.searchSelection + 1);
			else if (event.key === 'ArrowUp') this.searchSelection = Math.max(0, this.searchSelection - 1);
			else if (event.key === 'Enter' && items[this.searchSelection]) window.location.href = items[this.searchSelection].href;
			else if (event.key === 'Escape') close();
			else return;
			event.preventDefault();
			items.forEach((item, index) => item.parentElement.classList.toggle('active', index === this.searchSelection));
			items[this.searchSelection]?.scrollIntoView({ block: 'nearest' });
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === '/' && !/input|textarea|select/i.test(event.target.tagName)) { event.preventDefault(); open(); }
			else if (event.key === 'Escape' && !modal.hidden) close();
		});
	},

	renderCommandResults(query) {
		const { results } = this.commandNodes;
		const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		const matches = this.searchEntries.filter((entry) => {
			const haystack = (entry.title + ' ' + entry.parent).toLowerCase();
			return words.every((word) => haystack.includes(word));
		}).slice(0, 12);
		results.replaceChildren();
		matches.forEach((entry, index) => {
			results.appendChild(E('li', { class: index === this.searchSelection ? 'active' : '' }, [
				E('a', { href: entry.url }, [
					icon(entry.iconName, 'unifi-command-icon'),
					E('span', {}, [E('strong', {}, entry.title), E('small', {}, entry.parent || _('Navigation'))]),
					E('span', { class: 'unifi-command-arrow', 'aria-hidden': 'true' }, '↗')
				])
			]));
		});
		if (!matches.length) results.appendChild(E('li', { class: 'unifi-command-empty' }, _('No matching pages')));
	}
});
