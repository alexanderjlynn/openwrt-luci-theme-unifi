'use strict';
'require baseclass';
'require ui';
'require network';
'require poll';
'require rpc';

const callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info',
	expect: { '': {} }
});

const ICON_ALIASES = {
	status: 'dashboard', network: 'topology', services: 'apps', vpn: 'shield',
	system: 'settings', logout: 'power', overview: 'overview', wireless: 'wifi',
	interfaces: 'ports', interface: 'ports', devices: 'device', device: 'device',
	dhcp: 'server', dns: 'server', hosts: 'clients', host: 'clients', clients: 'clients',
	routes: 'route', route: 'route', firewall: 'firewall', diagnostics: 'pulse',
	processes: 'cpu', process: 'cpu', logs: 'document', log: 'document',
	realtime: 'chart', graphs: 'chart', statistics: 'chart', administration: 'user-settings',
	bandwidth: 'chart', load: 'cpu', connections: 'clients', channelanalysis: 'wifi',
	admin: 'user-settings', startup: 'power', init: 'power', backup: 'backup', flash: 'backup',
	reboot: 'restart', software: 'package', packages: 'package', package: 'package',
	storage: 'storage', samba: 'storage', minidlna: 'storage', printer: 'printer',
	qos: 'sliders', sqm: 'sliders', mwan: 'route', wireguard: 'lock', openvpn: 'lock',
	banip: 'shield', adblock: 'shield', rules: 'filter', zones: 'firewall', switch: 'ports',
	terminal: 'document', commands: 'document', scheduledtasks: 'document', chevrondown: 'chevron-down',
	ports: 'ports', globe: 'globe', clock: 'clock', activity: 'activity', ethernet: 'ethernet',
	download: 'download', upload: 'upload', sun: 'sun', moon: 'moon', monitor: 'monitor'
};

const ICON_SPRITE = L.media('icons.svg') + '?v=' + encodeURIComponent(L.env.resource_version || '0.2.2') + '#unifi-';

// LuCI E()/dom.create() uses document.createElement(), which creates HTML,
// not SVG. Every dynamically created SVG descendant needs this namespace.
function svgElement(tag, attributes) {
	const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
	Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
	return node;
}

function resolveIcon(name) {
	const key = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	if (ICON_ALIASES[key]) return ICON_ALIASES[key];
	if (key.includes('wifi') || key.includes('wireless')) return 'wifi';
	if (key.includes('interface') || key.includes('ethernet') || key.includes('port')) return 'ports';
	if (key.includes('device') || key.includes('switch')) return 'device';
	if (key.includes('dhcp') || key.includes('dns') || key.includes('host')) return 'server';
	if (key.includes('route') || key.includes('mwan')) return 'route';
	if (key.includes('firewall') || key.includes('zone')) return 'firewall';
	if (key.includes('diagnostic') || key.includes('ping')) return 'pulse';
	if (key.includes('process') || key.includes('cpu')) return 'cpu';
	if (key.includes('log')) return 'document';
	if (key.includes('realtime') || key.includes('graph') || key.includes('statistic')) return 'chart';
	if (key.includes('admin') || key.includes('password') || key.includes('user')) return 'user-settings';
	if (key.includes('startup') || key.includes('init')) return 'power';
	if (key.includes('backup') || key.includes('flash')) return 'backup';
	if (key.includes('reboot') || key.includes('restart')) return 'restart';
	if (key.includes('package') || key.includes('software')) return 'package';
	if (key.includes('vpn') || key.includes('tunnel')) return 'lock';
	return 'default';
}

function icon(name, className) {
	const svg = svgElement('svg', {
		'class': className || 'unifi-nav-icon',
		'viewBox': '0 0 24 24',
		'aria-hidden': 'true',
		'focusable': 'false'
	});
	const use = svgElement('use');
	use.setAttribute('href', ICON_SPRITE + resolveIcon(name));
	use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', ICON_SPRITE + resolveIcon(name));
	svg.appendChild(use);
	return svg;
}

function formatRate(bytesPerSecond) {
	let bits = Math.max(0, Number(bytesPerSecond) || 0) * 8;
	const units = [ 'bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps' ];
	let unit = 0;
	while (bits >= 1000 && unit < units.length - 1) { bits /= 1000; unit++; }
	return `${bits >= 100 || unit === 0 ? bits.toFixed(0) : bits >= 10 ? bits.toFixed(1) : bits.toFixed(2)} ${units[unit]}`;
}

function formatSpeed(speed) {
	if (speed == null || speed < 0) return _('No link');
	if (speed >= 1000) return `${Number((speed / 1000).toFixed(speed % 1000 ? 1 : 0))} Gbps`;
	return `${speed} Mbps`;
}

function formatUptime(seconds) {
	seconds = Math.max(0, Number(seconds) || 0);
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

return baseclass.extend({
	__init__() {
		this.searchEntries = [];
		this.searchSelection = 0;
		this.telemetry = {
			lastAt: 0,
			counters: {},
			rxHistory: Array(48).fill(0),
			txHistory: Array(48).fill(0)
		};
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
		this.enhanceLuCIViews();
		this.initTelemetry();
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
		let expanded = {};
		try { expanded = JSON.parse(sessionStorage.getItem('luci-unifi-navigation') || '{}'); } catch (e) {}
		const preferred = { status: 10, network: 20, services: 30, vpn: 40, system: 50, logout: 90 };
		const accents = { status: 'cyan', network: 'blue', services: 'violet', vpn: 'green', system: 'slate', logout: 'red' };
		const groups = ui.menu.getChildren(mode).map((node, index) => ({ node, index }));
		groups.sort((a, b) => (preferred[a.node.name] || 60) - (preferred[b.node.name] || 60) || a.index - b.index);

		container.appendChild(E('div', { class: 'unifi-nav-heading' }, [
			E('span', {}, _('Network Control')),
			E('small', {}, _('LuCI'))
		]));
		groups.forEach(({ node }) => {
			const children = ui.menu.getChildren(node);
			const active = L.env.requestpath[1] === node.name;
			const section = E('section', {
				'class': 'unifi-nav-section' + (active ? ' active' : '') + (active || expanded[node.name] ? ' open' : ''),
				'data-menu': node.name,
				'data-accent': accents[node.name] || 'slate'
			});
			const head = E('div', { class: 'unifi-nav-head' });
			const href = L.url(baseUrl, node.name);
			const link = E(children.length ? 'button' : 'a', children.length ? {
				type: 'button', class: 'unifi-nav-root', 'aria-controls': `unifi-menu-${node.name}`,
				'aria-expanded': section.classList.contains('open') ? 'true' : 'false'
			} : { href, class: 'unifi-nav-root' }, [
				E('span', { class: 'unifi-nav-icon-frame' }, icon(node.name)),
				E('span', { class: 'unifi-nav-copy' }, [
					E('strong', {}, _(node.title)),
					E('small', {}, this.groupSubtitle(node.name))
				])
			]);
			head.appendChild(link);

			this.addSearchEntry(_(node.title), href, '', node.name);

			if (children.length) {
				const setExpanded = (open) => {
					section.classList.toggle('open', open);
					link.setAttribute('aria-expanded', String(open));
					section.querySelector('.unifi-nav-expander')?.setAttribute('aria-expanded', String(open));
					expanded[node.name] = open;
					try { sessionStorage.setItem('luci-unifi-navigation', JSON.stringify(expanded)); } catch (e) {}
				};
				// The whole category always opens its options. Only the separate
				// chevron collapses them, so hover can never reverse a click.
				link.addEventListener('click', () => setExpanded(true));
				link.addEventListener('keydown', (event) => {
					if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
						event.preventDefault();
						setExpanded(event.key === 'ArrowRight');
					}
				});
				section.addEventListener('pointerenter', (event) => {
					if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover)').matches) {
						setExpanded(true);
					}
				});
				const toggle = E('button', {
					type: 'button',
					class: 'unifi-nav-expander',
					'aria-label': _('Expand menu'),
					'aria-controls': `unifi-menu-${node.name}`,
					'aria-expanded': section.classList.contains('open') ? 'true' : 'false'
				}, icon('chevron-down', 'unifi-expander-icon'));
				toggle.addEventListener('click', () => setExpanded(!section.classList.contains('open')));
				head.appendChild(toggle);
			}
			section.appendChild(head);

			if (children.length) {
				const list = E('ul', { id: `unifi-menu-${node.name}`, class: 'unifi-nav-children' });
				children.forEach((child) => {
					const selected = active && L.env.requestpath[2] === child.name;
					const childUrl = L.url(baseUrl, node.name, child.name);
					const childIcon = node.name === 'network' && child.name === 'network' ? 'interfaces' : child.name;
					list.appendChild(E('li', { class: selected ? 'selected' : '' }, [
						E('a', { href: childUrl, 'aria-current': selected ? 'page' : null }, [
							E('span', { class: 'unifi-child-icon-frame' }, icon(childIcon, 'unifi-nav-child-icon')),
							E('span', {}, _(child.title))
						])
					]));
					this.addSearchEntry(_(child.title), childUrl, _(node.title), childIcon);
					this.collectSearchChildren(child, childUrl, [_(node.title), _(child.title)]);
				});
				section.appendChild(list);
			}
			container.appendChild(section);
		});
	},

	groupSubtitle(name) {
		const subtitles = {
			status: _('Health & telemetry'),
			network: _('Ports & networks'),
			services: _('Applications'),
			vpn: _('Secure access'),
			system: _('Console settings'),
			logout: _('End session')
		};
		return subtitles[name] || _('Configuration');
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
		const sidebar = document.querySelector('#unifi-sidebar');
		try { if (sidebar) sidebar.scrollTop = Number(sessionStorage.getItem('luci-unifi-sidebar-scroll')) || 0; } catch (e) {}
		sidebar?.addEventListener('scroll', () => {
			try { sessionStorage.setItem('luci-unifi-sidebar-scroll', String(sidebar.scrollTop)); } catch (e) {}
		}, { passive: true });
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
			if (colorButton) {
				colorButton.dataset.mode = mode;
				const themeIcon = colorButton.querySelector('use');
				if (themeIcon) {
					const href = ICON_SPRITE + (mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'monitor');
					themeIcon.setAttribute('href', href);
					themeIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
				}
				const modeLabel = mode === 'dark' ? _('Dark') : mode === 'light' ? _('Light') : _('Auto');
				colorButton.setAttribute('title', _('Color mode: %s').format(modeLabel));
				colorButton.setAttribute('aria-label', _('Color mode: %s').format(modeLabel));
			}
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

	initTelemetry() {
		const target = document.querySelector('#unifi-dashboard');
		if (!target) return;

		const route = L.env.requestpath.join('/').toLowerCase();
		const isOverview = /(^|\/)status\/(overview|index)$/.test(route);
		const isNetwork = /(^|\/)network\/(network|interfaces|devices)$/.test(route);
		if (!isOverview && !isNetwork) return;

		target.hidden = false;
		target.classList.toggle('is-compact', !isOverview);
		document.body.classList.toggle('unifi-overview-page', isOverview);
		target.replaceChildren(this.buildTelemetryShell(isOverview));

		const update = () => network.flushCache()
			.then(() => Promise.all([
				network.getDevices(),
				L.resolveDefault(callSystemInfo(), {})
			]))
			.then((data) => this.updateTelemetry(data[0], data[1]))
			.catch(() => {
				const nodes = this.telemetryNodes;
				nodes.onlineValue.textContent = _('Unavailable');
				nodes.onlineDetail.textContent = _('Waiting for device data');
				nodes.onlineValue.closest('.unifi-kpi-card').classList.add('has-warning');
				nodes.rxValue.textContent = nodes.txValue.textContent = '—';
				nodes.portSummary.textContent = _('Retrying on next refresh');
				this.telemetry.lastAt = 0;
				this.telemetry.counters = {};
			});

		update();
		poll.add(update, 3);
	},

	buildTelemetryShell(full) {
		const liveGraph = svgElement('svg', {
			class: 'unifi-throughput-graph',
			viewBox: '0 0 320 72',
			preserveAspectRatio: 'none',
			role: 'img',
			'aria-label': _('Live receive and transmit throughput')
		});
		for (let y = 18; y < 72; y += 18)
			liveGraph.appendChild(svgElement('line', { x1: 0, y1: y, x2: 320, y2: y, class: 'unifi-throughput-gridline' }));
		const rxLine = svgElement('polyline', { class: 'unifi-throughput-line is-rx', points: '0,66 320,66' });
		const txLine = svgElement('polyline', { class: 'unifi-throughput-line is-tx', points: '0,66 320,66' });
		liveGraph.append(rxLine, txLine);

		const onlineValue = E('strong', { class: 'unifi-kpi-value' }, _('Checking…'));
		const onlineDetail = E('small', {}, _('Reading interface state'));
		const portsValue = E('strong', { class: 'unifi-kpi-value' }, '—');
		const portsDetail = E('small', {}, _('Ethernet links'));
		const uptimeValue = E('strong', { class: 'unifi-kpi-value' }, '—');
		const uptimeDetail = E('small', {}, _('Gateway uptime'));
		const rxValue = E('strong', {}, '—');
		const txValue = E('strong', {}, '—');
		const portGrid = E('div', { class: 'unifi-port-grid' });
		const portSummary = E('span', { class: 'unifi-panel-summary' }, _('Discovering ports…'));

		this.telemetryNodes = {
			onlineValue, onlineDetail, portsValue, portsDetail, uptimeValue, uptimeDetail,
			rxValue, txValue, rxLine, txLine, portGrid, portSummary
		};

		const kpiGrid = E('div', { class: 'unifi-kpi-grid' }, [
			this.telemetryCard('globe', _('Ethernet links'), onlineValue, onlineDetail, 'connectivity'),
			this.telemetryCard('ports', _('Active ports'), portsValue, portsDetail, 'ports'),
			this.telemetryCard('clock', _('System uptime'), uptimeValue, uptimeDetail, 'system'),
			E('article', { class: 'unifi-kpi-card unifi-throughput-card' }, [
				E('div', { class: 'unifi-kpi-card-head' }, [
					E('span', { class: 'unifi-kpi-icon is-activity' }, icon('realtime', 'unifi-kpi-svg')),
					E('span', {}, [E('small', {}, _('Live throughput')), E('b', { class: 'unifi-live-label' }, _('LIVE'))])
				]),
				E('div', { class: 'unifi-throughput-values' }, [
					E('span', { class: 'is-rx' }, [icon('download', 'unifi-rate-icon'), E('small', {}, _('Receive')), rxValue]),
					E('span', { class: 'is-tx' }, [icon('upload', 'unifi-rate-icon'), E('small', {}, _('Transmit')), txValue])
				]),
				liveGraph,
				E('small', { class: 'unifi-throughput-caption' }, _('All physical ports · 3s samples'))
			])
		]);

		return E('section', { class: 'unifi-telemetry', 'aria-label': _('Network telemetry') }, [
			E('div', { class: 'unifi-telemetry-heading' }, [
				E('div', {}, [
					E('span', { class: 'unifi-eyebrow' }, full ? _('Gateway console') : _('Interface telemetry')),
					E('h1', {}, full ? _('Network health') : _('Ports & throughput'))
				]),
				E('span', { class: 'unifi-health-pill' }, [E('i'), _('Live')])
			]),
			kpiGrid,
			E('section', { class: 'unifi-port-panel' }, [
				E('header', {}, [
					E('span', { class: 'unifi-panel-icon' }, icon('interfaces', 'unifi-panel-svg')),
					E('span', {}, [E('strong', {}, _('Ethernet ports')), E('small', {}, _('Negotiated link state and speed'))]),
					portSummary
				]),
				portGrid
			])
		]);
	},

	telemetryCard(iconName, label, valueNode, detailNode, kind) {
		return E('article', { class: `unifi-kpi-card is-${kind}` }, [
			E('span', { class: `unifi-kpi-icon is-${kind}` }, icon(iconName, 'unifi-kpi-svg')),
			E('span', { class: 'unifi-kpi-copy' }, [E('small', {}, label), valueNode, detailNode])
		]);
	},

	updateTelemetry(devices, systemInfo) {
		const nodes = this.telemetryNodes;
		if (!nodes) return;

		let ports = devices.filter((dev) => {
			const name = dev.getName();
			const type = dev.getType();
			return name && name !== 'lo' && !name.includes('.') && (type === 'ethernet' || type === 'switch') &&
				(dev.getSpeed() != null || dev.isBridgePort() || /^(eth|lan|wan|en|sfp|swp)/i.test(name));
		});
		ports.sort((a, b) => a.getName().localeCompare(b.getName(), undefined, { numeric: true }));

		const now = Date.now();
		const elapsed = this.telemetry.lastAt ? Math.max(.25, (now - this.telemetry.lastAt) / 1000) : 0;
		let rxRate = 0;
		let txRate = 0;
		for (const dev of ports) {
			const name = dev.getName();
			const rx = dev.getRXBytes();
			const tx = dev.getTXBytes();
			const previous = this.telemetry.counters[name];
			if (elapsed && previous) {
				rxRate += Math.max(0, rx - previous.rx) / elapsed;
				txRate += Math.max(0, tx - previous.tx) / elapsed;
			}
			this.telemetry.counters[name] = { rx, tx };
		}
		this.telemetry.lastAt = now;
		this.telemetry.rxHistory.push(rxRate);
		this.telemetry.txHistory.push(txRate);
		this.telemetry.rxHistory = this.telemetry.rxHistory.slice(-48);
		this.telemetry.txHistory = this.telemetry.txHistory.slice(-48);

		const active = ports.filter((dev) => dev.getCarrier() || dev.getSpeed() > 0);
		const wanPorts = ports.filter((dev) => /(^|[-_.])wan([0-9]|$)/i.test(dev.getName()));
		const connectivityUp = wanPorts.length ? wanPorts.some((dev) => dev.getCarrier() || dev.getSpeed() > 0) : active.length > 0;
		nodes.onlineValue.textContent = !ports.length ? _('No ports') : connectivityUp ? _('Connected') : _('No link');
		nodes.onlineValue.closest('.unifi-kpi-card').classList.toggle('has-warning', !connectivityUp);
		nodes.onlineDetail.textContent = wanPorts.length
			? N_(wanPorts.length, '%d WAN link', '%d WAN links').format(wanPorts.length)
			: _('Gateway link state');
		nodes.portsValue.textContent = `${active.length} / ${ports.length}`;
		nodes.portsDetail.textContent = _('connected');
		nodes.uptimeValue.textContent = systemInfo.uptime == null ? '—' : formatUptime(systemInfo.uptime);
		const load = Array.isArray(systemInfo.load) ? systemInfo.load[0] / 65535 : null;
		nodes.uptimeDetail.textContent = load == null ? _('Gateway uptime') : _('Load %.2f').format(load);
		nodes.rxValue.textContent = elapsed ? formatRate(rxRate) : '—';
		nodes.txValue.textContent = elapsed ? formatRate(txRate) : '—';
		nodes.portSummary.textContent = N_(ports.length, '%d detected port', '%d detected ports').format(ports.length);

		this.updateSparkline(nodes.rxLine, this.telemetry.rxHistory);
		this.updateSparkline(nodes.txLine, this.telemetry.txHistory);
		this.renderPorts(nodes.portGrid, ports);
	},

	updateSparkline(line, values) {
		const width = 320;
		const height = 66;
		const max = Math.max(1, ...this.telemetry.rxHistory, ...this.telemetry.txHistory);
		const step = width / Math.max(1, values.length - 1);
		line.setAttribute('points', values.map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * (height - 8)).toFixed(1)}`).join(' '));
	},

	renderPorts(container, ports) {
		container.replaceChildren();
		if (!ports.length) {
			container.appendChild(E('p', { class: 'unifi-empty-state' }, _('No physical Ethernet ports were reported by this device.')));
			return;
		}

		ports.forEach((dev) => {
			const name = dev.getName();
			const speed = dev.getSpeed();
			const carrier = dev.getCarrier() || speed > 0;
			const role = /wan/i.test(name) ? 'wan' : 'lan';
			const duplex = dev.getDuplex();
			container.appendChild(E('article', {
				class: `unifi-port-tile is-${carrier ? 'online' : 'offline'} is-${role}`,
				title: carrier
					? _('Port %s: %s, %s duplex').format(name, formatSpeed(speed), duplex || _('unknown'))
					: _('Port %s: no link').format(name)
			}, [
				E('span', { class: 'unifi-port-glyph' }, [icon('ethernet', 'unifi-port-svg'), E('i')]),
				E('span', { class: 'unifi-port-copy' }, [
					E('strong', {}, name),
					E('small', {}, carrier ? formatSpeed(speed) : _('Disconnected'))
				]),
				E('span', { class: 'unifi-port-role' }, role.toUpperCase())
			]));
		});
	},

	enhanceLuCIViews() {
		const main = document.querySelector('#maincontent');
		if (!main) return;
		const route = L.env.requestpath.join('/').toLowerCase();
		if (/(bandwidth|load|wireless|connections)$/.test(route))
			document.body.classList.add('unifi-realtime-page');

		let scheduled = false;
		const apply = () => {
			scheduled = false;
			main.querySelectorAll('.table').forEach((table) => table.classList.add('unifi-data-table'));
			main.querySelectorAll('.includes > .cbi-section').forEach((section) => {
				section.classList.add('unifi-overview-section');
				if (section.querySelector('.ifacebox img[src*="port_"]')) section.classList.add('unifi-port-status-section');
				if (section.querySelector('.network-status-table')) section.classList.add('unifi-network-status-section');
				if (section.querySelector('.cbi-progressbar')) section.classList.add('unifi-metric-section');
			});
			main.querySelectorAll('.ifacebox img[src*="port_"]').forEach((image) => image.closest('.ifacebox')?.classList.add('unifi-luci-port'));
			// Replace only known LuCI device artwork, leaving its data, tooltips,
			// zone badges and surrounding controls owned by the stock view.
			main.querySelectorAll('img[src*="/icons/"]').forEach((image) => {
				const filename = image.getAttribute('src').split('/').pop().split('?')[0];
				if (!/^(?:port_|ethernet|bridge|vlan|wifi|wireless|tunnel|switch|alias)/.test(filename)) return;
				const kind = /wifi|wireless/.test(filename) ? 'wireless' : /bridge|switch/.test(filename) ? 'network' : /tunnel/.test(filename) ? 'vpn' : 'ethernet';
				const graphic = icon(kind, 'unifi-device-icon-svg');
				const down = /disabled|down/.test(filename);
				graphic.classList.add(down ? 'is-offline' : 'is-online');
				if (/pse_/.test(filename)) graphic.classList.add('is-poe');
				if (image.title) graphic.setAttribute('title', image.title);
				if (image.alt) {
					graphic.removeAttribute('aria-hidden');
					graphic.setAttribute('role', 'img');
					graphic.setAttribute('aria-label', image.alt);
				}
				image.replaceWith(graphic);
			});
			main.querySelectorAll('.network-status-table .ifacebox').forEach((box) => box.classList.add('unifi-uplink-card'));
			main.querySelectorAll('#view svg').forEach((svg) => {
				// Style the graphic itself; sizing/clipping its parent can hide
				// LuCI's legends, controls and additional graphs in that section.
				if (svg.querySelector('polyline, polygon')) {
					svg.classList.add('unifi-stock-chart');
					if (svg.parentElement?.style.height === '300px' && !svg.parentElement.classList.contains('cbi-section'))
						svg.parentElement.classList.add('unifi-stock-chart-frame');
				}
			});
			this.syncPageTabs();
		};
		const schedule = () => {
			if (scheduled) return;
			scheduled = true;
			window.requestAnimationFrame(apply);
		};
		apply();
		new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
	},

	syncPageTabs() {
		const parent = document.querySelector('#mainmenu .unifi-nav-section.active .unifi-nav-children > li.selected');
		if (!parent) return; // Unknown/custom routes keep the native vertical menus.
		const sources = Array.from(document.querySelectorAll('#tabmenu > .tabs, #view .cbi-tabmenu'))
			.filter(menu => !menu.closest('.modal, [role="dialog"], .cbi-section-table-row') && !menu.hidden);
		this.pageTabObservers ??= new Map();
		for (const [menu, observer] of this.pageTabObservers) {
			if (!sources.includes(menu)) { observer.disconnect(); this.pageTabObservers.delete(menu); }
		}
		for (const menu of sources) {
			if (this.pageTabObservers.has(menu)) continue;
			// Never move native menus: ui.tabs uses nextElementSibling to locate
			// panes, validation and conditional-field state. Forward clicks instead.
			menu.classList.add('unifi-tab-source');
			const observer = new MutationObserver(() => this.syncPageTabs());
			observer.observe(menu, { subtree: true, childList: true, characterData: true,
				attributes: true, attributeFilter: ['class', 'style', 'data-errors', 'hidden'] });
			this.pageTabObservers.set(menu, observer);
		}
		const tabs = sources.flatMap(menu => {
			if (menu.closest('[data-tab-active="false"]') || menu.style.display === 'none') return [];
			return Array.from(menu.children).filter(item => item.matches('li') && item.querySelector('a'))
				.map(item => ({ item, link: item.querySelector('a'),
					active: item.classList.contains('active') || item.classList.contains('cbi-tab'),
					hidden: item.hidden || item.style.display === 'none',
					errors: item.getAttribute('data-errors') || '', label: item.querySelector('a').textContent.trim() }));
		});
		let rail = parent.querySelector(':scope > .unifi-page-submenu');
		if (!tabs.length) { rail?.remove(); this.pageTabSignature = null; return; }
		const signature = JSON.stringify(tabs.map(tab => [tab.label, tab.active, tab.hidden, tab.errors]));
		if (rail && this.pageTabSignature === signature && tabs.every((tab, i) => rail.querySelectorAll('button')[i]?._unifiSource === tab.link)) return;
		if (!rail) { rail = E('ul', { class: 'unifi-page-submenu', 'aria-label': _('Page settings') }); parent.appendChild(rail); }
		const focused = document.activeElement?._unifiSource;
		rail.replaceChildren(...tabs.map(tab => {
			const button = E('button', { type: 'button', class: tab.active ? 'is-active' : '',
				'aria-current': tab.active ? 'true' : null, title: tab.errors ? _('%s invalid field(s)').format(tab.errors) : tab.label }, [
				E('span', {}, tab.label), ...(tab.errors ? [E('small', { class: 'unifi-tab-errors' }, tab.errors)] : [])
			]);
			button._unifiSource = tab.link;
			button.addEventListener('click', () => { tab.link.click(); this.syncPageTabs(); });
			return E('li', { hidden: tab.hidden ? true : null }, button);
		}));
		if (focused) Array.from(rail.querySelectorAll('button')).find(button => button._unifiSource === focused)?.focus({ preventScroll: true });
		this.pageTabSignature = signature;
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
