// Runtime regression tests. Uses the SDK's actual LuCI dom.create() method;
// the old static preview could not detect HTML-namespace SVG regressions.
// LUCI_SOURCE=/path/to/SDK/feeds/luci node tests/browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const upstream = process.env.LUCI_SOURCE;
assert(upstream, 'Set LUCI_SOURCE to the SDK feeds/luci directory');
const luci = await fs.readFile(path.join(upstream, 'modules/luci-base/htdocs/luci-static/resources/luci.js'), 'utf8');
const start = luci.indexOf('\n\t\tcreate() {');
const end = luci.indexOf('\n\t\tregistry:', start);
assert(start > 0 && end > start, 'Find the upstream DOM factory');
const factory = luci.slice(start, end).trim().replace(/,$/, '');
const source = await fs.readFile(path.join(root, 'htdocs/luci-static/resources/menu-unifi.js'), 'utf8');
const uiSource = await fs.readFile(path.join(upstream, 'modules/luci-base/htdocs/luci-static/resources/ui.js'), 'utf8');
const switchStart = uiSource.indexOf('\n\t\tswitchTab(ev) {');
const switchEnd = uiSource.indexOf('\n\t}),', switchStart);
assert(switchStart > 0 && switchEnd > switchStart, 'Find upstream tab switching');
const switchFactory = uiSource.slice(switchStart, switchEnd).trim();
const upstreamStyles = [];
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let filename;
    if (url.pathname === '/') filename = path.join(root, 'tests/preview.html');
    else if (url.pathname.startsWith('/luci-static/bootstrap/')) {
      upstreamStyles.push(url.pathname);
      res.writeHead(410); res.end(); return;
    }
    else filename = path.join(root, 'htdocs', url.pathname);
    const mime = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.html': 'text/html' };
    const body = await fs.readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.evaluate(({ factory, source }) => {
    // Use actual LuCI DOM creation, with its attribute/append dependencies.
    const dom = new Function(`return ({${factory}})`)();
    dom.elem = node => node instanceof Node;
    dom.parse = markup => { const t = document.createElement('template'); t.innerHTML = markup; return t.content.firstChild; };
    dom.attr = (node, attrs) => Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (typeof value === 'function') node.addEventListener(key, value);
      else node.setAttribute(key, value);
    });
    dom.append = (node, children) => {
      if (children == null) return;
      if (Array.isArray(children)) children.forEach(child => dom.append(node, child));
      else node.append(children instanceof Node ? children : document.createTextNode(String(children)));
    };
    window.E = dom.create.bind(dom);
    window._ = text => text;
    window.N_ = (n, one, many) => n === 1 ? one : many;
    String.prototype.format = function(...args) { let i = 0; return this.replace(/%[sd]|%\.2f/g, match => match === '%.2f' ? Number(args[i++]).toFixed(2) : args[i++]); };
    window.L = {
      env: { requestpath: ['admin', 'status', 'overview'], dispatchpath: ['admin', 'status', 'overview'] },
      url: (...parts) => '/cgi-bin/luci/' + parts.join('/'),
      media: part => '/luci-static/unifi/' + part,
      resolveDefault: (promise, fallback) => Promise.resolve(promise).catch(() => fallback)
    };
    document.querySelector('#mainmenu').replaceChildren();
    document.querySelector('#unifi-dashboard').replaceChildren();
    document.querySelector('#tabmenu').replaceChildren();
    document.querySelector('#tabmenu').style.display = 'none';
    document.querySelector('#view').innerHTML = `<h2>Overview</h2><div class="cbi-map-descr">Original page description remains available.</div><div class="includes"><section class="cbi-section"><div class="cbi-title"><h3>Ethernet ports</h3></div><div><div class="ifacebox"><div class="ifacebox-head">lan1</div><div class="ifacebox-body"><img alt="LAN link" title="Port state" src="/luci-static/resources/icons/port_pse_up.svg"><br>1 Gbps, full duplex</div><div class="zonebadge">LAN VLAN 10</div><span class="cbi-tooltip">PoE 3W · RX 1234 · TX 5678</span></div></div></section></div><section class="cbi-section" id="stock-chart-section"><div style="width:100%;height:300px;border:1px solid #000;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><polyline id="rx" points="0,90 50,10 100,40"/></svg></div><table><tr><td>Native legend, counters, controls</td></tr></table></section>`;
    window.fixture = { rx: 100000, tx: 200000, fail: false, callbacks: [] };
    const device = (name, up, speed) => ({
      getName: () => name, getType: () => 'ethernet', isBridgePort: () => false,
      getSpeed: () => speed, getDuplex: () => 'full', getCarrier: () => up,
      getRXBytes: () => fixture.rx, getTXBytes: () => fixture.tx
    });
    const network = {
      flushCache: () => fixture.fail ? Promise.reject(Error('RPC unavailable')) : Promise.resolve(),
      getDevices: () => Promise.resolve([device('wan', true, 2500), device('lan1', true, 1000), device('lan2', false, -1)])
    };
    const poll = { add: callback => fixture.callbacks.push(callback) };
    const rpc = { declare: () => () => Promise.resolve({ uptime: 90061, load: [12000] }) };
    const child = (name, title, children = {}) => ({ name, title, children });
    const admin = child('admin', 'Admin', {
      status: child('status', 'Status', { overview: child('overview', 'Overview'), bandwidth: child('bandwidth', 'Realtime Graphs') }),
      network: child('network', 'Network', { network: child('network', 'Interfaces'), wireless: child('wireless', 'Wireless') }),
      services: child('services', 'Services', { custom: child('custom', 'Third-party application') }),
      system: child('system', 'System', { system: child('system', 'System'), package: child('package', 'Software') }),
      logout: child('logout', 'Logout')
    });
    const ui = { menu: { load: () => Promise.resolve({ children: { admin } }), getChildren: node => Object.values(node.children || {}) } };
    window.theme = new Function('baseclass', 'ui', 'network', 'poll', 'rpc', source)({ extend: obj => obj }, ui, network, poll, rpc);
    fixture.menu = admin;
    theme.__init__();
  }, { factory, source });
  await page.waitForFunction(() => document.querySelector('.unifi-port-tile'));
  await page.evaluate(async () => {
    fixture.rx += 2500000; fixture.tx += 500000;
    theme.telemetry.lastAt = Date.now() - 3000;
    await fixture.callbacks[0]();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.unifi-nav-icon use')].every(node => node.getBBox().width > 0));
  const graphics = await page.evaluate(() => ({
    badNamespaces: [...document.querySelectorAll('#mainmenu svg, #mainmenu use, #unifi-dashboard svg, #unifi-dashboard line, #unifi-dashboard polyline')].filter(node => node.namespaceURI !== 'http://www.w3.org/2000/svg').length,
    lines: [...document.querySelectorAll('.unifi-throughput-line')].map(node => ({ points: node.points.numberOfItems, height: node.getBBox().height })),
    rates: [...document.querySelectorAll('.unifi-throughput-values strong')].map(node => node.textContent),
    portCount: document.querySelectorAll('.unifi-port-tile').length,
    preserved: document.querySelector('.zonebadge').textContent + document.querySelector('.cbi-tooltip').textContent,
    oldIcons: document.querySelectorAll('#view img[src*="/icons/"]').length,
    replacement: document.querySelector('.unifi-device-icon-svg').getBBox().width,
    chartSectionHeight: document.querySelector('#stock-chart-section').getBoundingClientRect().height,
    chartSectionOverflow: getComputedStyle(document.querySelector('#stock-chart-section')).overflow,
    description: getComputedStyle(document.querySelector('.cbi-map-descr')).display
  }));
  assert.equal(graphics.badNamespaces, 0);
  assert(graphics.lines.every(line => line.points === 48 && line.height > 0));
  assert(graphics.rates.every(rate => !rate.startsWith('0 ')));
  assert.equal(graphics.portCount, 3);
  assert.match(graphics.preserved, /VLAN 10PoE 3W/);
  assert.equal(graphics.oldIcons, 0);
  assert(graphics.replacement > 0);
  assert(graphics.chartSectionHeight > 300 && graphics.chartSectionOverflow !== 'hidden');
  assert.notEqual(graphics.description, 'none');
  // Category expansion cannot navigate; leaf links still point to stock LuCI.
  const category = page.locator('[data-menu="network"] .unifi-nav-root');
  const url = page.url();
  await category.click();
  assert.equal(await category.getAttribute('aria-expanded'), 'true'); // hover must not undo the first click
  await category.click();
  assert.equal(await category.getAttribute('aria-expanded'), 'true'); // category labels always expand
  await page.locator('[data-menu="network"] .unifi-nav-expander').click();
  assert.equal(await category.getAttribute('aria-expanded'), 'false');
  await category.click();
  assert.equal(await category.getAttribute('aria-expanded'), 'true');
  assert.equal(page.url(), url);
  assert.match(await page.locator('#unifi-menu-network a').first().getAttribute('href'), /admin\/network\/network$/);
  await page.locator('[data-menu="services"]').hover();
  assert.equal(await page.locator('[data-menu="services"] .unifi-nav-root').getAttribute('aria-expanded'), 'true');
  await category.focus(); await page.keyboard.press('ArrowLeft');
  assert.equal(await category.getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowRight');
  assert.equal(await category.getAttribute('aria-expanded'), 'true');
  await page.evaluate(async () => { fixture.fail = true; await fixture.callbacks[0](); });
  assert.equal(await page.locator('.is-connectivity .unifi-kpi-value').textContent(), 'Unavailable');
  await page.evaluate(async () => { fixture.fail = false; await fixture.callbacks[0](); });
  assert.equal(await page.locator('.is-connectivity .unifi-kpi-value').textContent(), 'Connected');
  await page.evaluate(async () => {
    fixture.rx += 2500000; fixture.tx += 500000;
    theme.telemetry.lastAt = Date.now() - 3000;
    await fixture.callbacks[0]();
  });
  for (const dark of [false, true]) {
    await page.evaluate(dark => { if (dark) document.documentElement.setAttribute('data-darkmode', 'true'); else document.documentElement.removeAttribute('data-darkmode'); }, dark);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(300); // finish the responsive drawer transition
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}, dark=${dark}`);
      if (width === 390) assert(await page.locator('#unifi-sidebar').evaluate(node => node.getBoundingClientRect().right <= 0), 'Closed mobile drawer is fully offscreen');
      assert.equal(await page.locator('.unifi-port-panel > header').evaluate(node => getComputedStyle(node).backgroundImage), 'none', 'No inherited Bootstrap header gradient');
      await page.screenshot({ path: path.join(os.tmpdir(), `unifi-v030-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);

  // Exercise the actual upstream switchTab(), preserving its sibling contract,
  // input identity, validation badges, hidden tabs, and native mobile fallback.
  await page.evaluate(({ switchFactory }) => {
    L.env.requestpath = L.env.dispatchpath = ['admin', 'system', 'system'];
    document.body.classList.remove('unifi-overview-page');
    document.querySelector('#unifi-dashboard').hidden = true;
    document.querySelector('#mainmenu').replaceChildren();
    theme.renderMainMenu(fixture.menu, 'admin');
    const view = document.querySelector('#view');
    view.innerHTML = `<h2>System settings</h2><div class="cbi-map-descr">Manage your gateway, logging and time synchronization.</div><div class="cbi-map"><ul class="cbi-tabmenu"><li data-tab="general" class="cbi-tab"><a href="#">General Settings</a></li><li data-tab="logging" class="cbi-tab-disabled"><a href="#">Logging</a></li><li data-tab="time" class="cbi-tab-disabled"><a href="#">Time Synchronization</a></li><li data-tab="hidden" style="display:none"><a href="#">Conditional Settings</a></li></ul><div id="native-panes"><section class="cbi-section" data-tab="general" data-tab-title="General Settings" data-tab-active="true"><h3>Gateway identity</h3><div class="cbi-value"><label class="cbi-value-title" for="hostname">Router hostname and a deliberately long translated configuration label</label><div class="cbi-value-field"><input id="hostname" value="gateway"><div class="cbi-value-description">This hostname identifies your gateway on the network.</div></div></div></section><section class="cbi-section" data-tab="logging" data-tab-title="Logging" data-tab-active="false"><h3>Logging</h3><div class="cbi-value"><label class="cbi-value-title" for="logserver">Remote logging server</label><div class="cbi-value-field"><input id="logserver" value="192.0.2.20"></div></div></section><section class="cbi-section" data-tab="time" data-tab-title="Time Synchronization" data-tab-active="false"><h3>Time Synchronization</h3><div class="cbi-value"><label class="cbi-value-title" for="ntp">Network time servers</label><div class="cbi-value-field"><input id="ntp" value="pool.ntp.org"><div class="cbi-value-description">Keep the gateway clock synchronized.</div></div></div></section></div></div>`;
    const tabs = new Function('dom', 'UI', `return ({${switchFactory}})`)(
      { matches: (node, selector) => node.nodeType === 1 && node.matches(selector) },
      { prototype: { tabs: { setActiveTabId: (pane, index) => { fixture.lastTab = index; } } } }
    );
    view.querySelectorAll('.cbi-tabmenu a').forEach(link => link.addEventListener('click', event => tabs.switchTab(event)));
    fixture.hostname = document.querySelector('#hostname');
    fixture.hostname.value = 'unsaved-router-name';
    theme.syncPageTabs();
  }, { switchFactory });
  await page.setViewportSize({ width: 1440, height: 1100 });
  const settingsRail = page.locator('[data-menu="system"] .unifi-page-submenu');
  await settingsRail.getByRole('button', { name: 'Logging', exact: true }).click();
  assert.equal(await page.locator('#native-panes > [data-tab="logging"]').getAttribute('data-tab-active'), 'true');
  assert.equal(await page.evaluate(() => document.querySelector('#hostname') === fixture.hostname && fixture.hostname.value === 'unsaved-router-name'), true);
  assert.equal(await page.evaluate(() => document.querySelector('.unifi-tab-source').nextElementSibling.id), 'native-panes');
  await page.evaluate(() => {
    document.querySelector('.unifi-tab-source > [data-tab="logging"]').setAttribute('data-errors', '2');
  });
  await page.waitForFunction(() => document.querySelector('.unifi-page-submenu .unifi-tab-errors')?.textContent === '2');
  assert.equal(await settingsRail.getByRole('button', { name: 'Conditional Settings', exact: true }).isVisible(), false);
  await settingsRail.getByRole('button', { name: 'Time Synchronization', exact: true }).click();
  assert.equal(await page.locator('#native-panes > [data-tab="time"]').getAttribute('data-tab-active'), 'true');
  assert.equal(await page.locator('.unifi-tab-source').isVisible(), false);
  for (const dark of [false, true]) {
    await page.evaluate(dark => { if (dark) document.documentElement.setAttribute('data-darkmode', 'true'); else document.documentElement.removeAttribute('data-darkmode'); }, dark);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(300);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Settings do not overflow at ${width}`);
      if (width <= 900) {
        assert.equal(await page.locator('.unifi-tab-source').isVisible(), true);
        await page.locator('.unifi-tab-source a').filter({ hasText: 'Time Synchronization' }).click();
        const bounds = await page.locator('.unifi-tab-source > li').first().boundingBox();
        assert(bounds.height >= 42, 'Native tabs have room for their text');
      }
      assert(await page.locator('[data-menu="system"] .unifi-nav-root').evaluate(node => node.scrollHeight <= node.clientHeight), 'Main category text is not clipped');
      await page.screenshot({ path: path.join(os.tmpdir(), `unifi-v030-settings-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  // Load the SDK's real class system, DOM implementation and UI widgets, not
  // hand-built widget lookalikes. Only remote service dependencies are stubbed.
  await page.addScriptTag({ content: luci });
  await page.evaluate(({ uiSource }) => {
    const previousL = L;
    window.L = Object.assign(Object.create(LuCI.prototype), previousL);
    const baseclass = Object.assign(function() {}, LuCI);
    baseclass.prototype = LuCI.prototype.__base__;
    const dom = LuCI.prototype.dom;
    window.E = dom.create.bind(dom);
    const rpc = { declare: () => () => Promise.resolve({}) };
    // Same DOM aliases supplied by LuCI's cbi.js compatibility helpers.
    const UI = new Function('baseclass', 'validation', 'request', 'session', 'poll', 'dom', 'rpc', 'uci', 'fs', 'findParent', 'matchesElem', uiSource)(baseclass, {}, {}, {}, {}, dom, rpc, {}, {}, dom.parent.bind(dom), dom.matches.bind(dom));
    fixture.ui = new UI();
    document.querySelector('#view').innerHTML = `<h2>Firewall</h2><div class="cbi-map-descr">Control traffic between your networks. All policies and actions remain LuCI-native.</div><section class="cbi-section" id="firewall-card"><h3>General settings</h3><div class="cbi-section-descr">Configure gateway protection and default traffic policies.</div><div class="cbi-value"><label class="cbi-value-title">Input policy</label><div class="cbi-value-field" id="policy-field"></div></div><div class="cbi-value"><label class="cbi-value-title">Covered networks</label><div class="cbi-value-field" id="networks-field"></div></div><div class="cbi-value"><label class="cbi-value-title">Source addresses</label><div class="cbi-value-field" id="addresses-field"></div></div></section><section class="cbi-section" id="zone-card"><h3>Zones</h3><div class="table cbi-section-table"><div class="tr table-titles"><div class="th">Zone ⇒ Forwardings</div><div class="th">Input</div><div class="th">Output</div><div class="th cbi-section-actions">Actions</div></div><div class="tr"><div class="td" data-title="Zone ⇒ Forwardings"><div class="zone-forwards"><div class="zone-src"><span class="zonebadge" style="background:rgba(0,128,0,.12);--zone-color-rgb:0,128,0">lan</span></div><span>⇒</span><div class="zone-dest"><span class="zonebadge" style="background:rgba(255,0,0,.12);--zone-color-rgb:255,0,0">wan</span></div></div></div><div class="td" data-title="Input">accept</div><div class="td" data-title="Output">accept</div><div class="td cbi-section-actions"><div><button class="cbi-button cbi-button-edit">Edit</button><button class="cbi-button cbi-button-remove">Delete</button></div></div></div></div></section><div class="cbi-page-actions" id="fixture-actions"></div>`;
    fixture.policy = new fixture.ui.Dropdown('reject', { accept: 'Accept', reject: 'Reject', drop: 'Drop' }, { id: 'policy', optional: true, select_placeholder: 'Unspecified' });
    fixture.networks = new fixture.ui.Dropdown(['lan'], { lan: 'LAN · Trusted clients', guest: 'Guest · Isolated devices', wan: 'WAN · Internet uplink' }, { id: 'networks', multiple: true });
    fixture.addresses = new fixture.ui.DynamicList(['192.0.2.10'], null, { id: 'addresses', placeholder: 'Add an address' });
    document.querySelector('#policy-field').append(fixture.policy.render());
    document.querySelector('#networks-field').append(fixture.networks.render());
    document.querySelector('#addresses-field').append(fixture.addresses.render());
    const save = new fixture.ui.ComboButton('0', { '0': 'Save & Apply', '1': 'Apply unchecked' }, { id: 'save-apply', classes: { '0': 'btn cbi-button cbi-button-apply important', '1': 'btn cbi-button cbi-button-negative important' } });
    document.querySelector('#fixture-actions').append(save.render(), E('button', { class: 'cbi-button cbi-button-save' }, 'Save'), E('button', { class: 'cbi-button cbi-button-reset' }, 'Reset'));
  }, { uiSource });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#policy').click();
  await page.waitForFunction(() => document.querySelector('#policy[open] ul.dropdown')?.getBoundingClientRect().height > 100);
  await page.locator('#policy ul.dropdown [data-value="accept"]').click();
  assert.equal(await page.evaluate(() => fixture.policy.getValue()), 'accept');
  // Optional dropdown must retain the native clearing choice.
  await page.locator('#policy').click();
  await page.locator('#policy ul.dropdown [placeholder]').click();
  assert.equal(await page.evaluate(() => fixture.policy.getValue()), undefined);
  await page.locator('#policy').focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.activeElement?.matches('#policy ul.dropdown > li'));
  await page.keyboard.press('Escape');
  await page.locator('#networks').click();
  await page.locator('#networks ul.dropdown [data-value="guest"]').click();
  await page.locator('#networks').press('Escape');
  assert.deepEqual(await page.evaluate(() => fixture.networks.getValue().sort()), ['guest', 'lan']);
  await page.evaluate(() => fixture.networks.setValue([]));
  assert.equal(await page.locator('#networks > .more').isVisible(), true);
  assert(await page.locator('#networks > ul').evaluate(node => node.getBoundingClientRect().width < 1), 'Empty multi-select does not expose all choices in its summary');
  await page.evaluate(() => fixture.networks.setValue(['lan', 'guest']));
  await page.locator('#addresses .add-item input').fill('198.51.100.20');
  await page.locator('#addresses .add-item .cbi-button-add').click();
  assert.deepEqual(await page.evaluate(() => fixture.addresses.getValue()), ['192.0.2.10', '198.51.100.20']);
  const firstAddress = page.locator('#addresses > .item').first();
  await firstAddress.click({ position: { x: (await firstAddress.boundingBox()).width - 15, y: 20 } });
  assert.deepEqual(await page.evaluate(() => fixture.addresses.getValue()), ['198.51.100.20']);
  for (const dark of [false, true]) {
    await page.evaluate(dark => { if (dark) document.documentElement.setAttribute('data-darkmode', 'true'); else document.documentElement.removeAttribute('data-darkmode'); }, dark);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.mouse.move(width - 10, 100);
      await page.waitForTimeout(300); // settle color-mode and drawer transitions
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Firewall widgets do not overflow at ${width}`);
      const spacing = await page.evaluate(() => {
        const style = selector => getComputedStyle(document.querySelector(selector));
        const buttons = [...document.querySelectorAll('#view button, #view .cbi-button')].map(node => ({ height: node.getBoundingClientRect().height, fits: node.scrollHeight <= node.clientHeight, padding: parseFloat(getComputedStyle(node).paddingLeft) }));
        return { card: parseFloat(style('#firewall-card').paddingLeft), cell: parseFloat(style('#zone-card .td').paddingLeft), buttons };
      });
      assert(spacing.card >= 20 && spacing.cell >= 8, 'Card and cell text has interior gutters');
      assert(spacing.buttons.every(button => button.height >= 40 && button.fits), 'Native action buttons have comfortable height and unclipped text');
      assert(await page.locator('#addresses .add-item').evaluate(node => {
        const [input, button] = [...node.children].map(child => child.getBoundingClientRect());
        return Math.abs(input.y + input.height / 2 - button.y - button.height / 2) < 1;
      }), 'Dynamic-list add input and action stay center-aligned on one row');
      await page.screenshot({ path: path.join(os.tmpdir(), `unifi-v030-firewall-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => fixture.ui.showModal('Apply configuration', [E('p', {}, 'Native LuCI confirmation dialog.'), E('div', { class: 'button-row' }, E('button', { class: 'btn', click: () => fixture.ui.hideModal() }, 'Cancel'))]));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#modal_overlay')).opacity === '1');
  assert(await page.locator('#modal_overlay').isVisible());
  await page.locator('#modal_overlay').press('Escape');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#modal_overlay')).visibility === 'hidden');
  await page.evaluate(() => {
    document.querySelector('#view').innerHTML = `<h2>System Log</h2><div id="content_syslog"><div class="cbi-section-descr">Inspect gateway events. Native filtering and log data remain intact.</div><div><label>Facility</label><select><option>All facilities</option></select><label>Severity</label><select><option>All severities</option></select></div><div><label>Text filter</label><input id="logTextFilter" placeholder="Search log messages"><label>Maximum rows</label><input id="logMaxRows" value="1000"></div><div><button class="cbi-button">Scroll to bottom</button></div><textarea id="syslog" readonly wrap="off" style="font-size:12px">${Array.from({length: 24}, (_, i) => `Oct 14 12:00:${String(i).padStart(2, '0')} gateway daemon.info netifd: Interface 'lan' is now up`).join('\n')}</textarea><div><button class="cbi-button">Scroll to top</button></div></div>`;
  });
  for (const dark of [false, true]) {
    await page.evaluate(dark => { if (dark) document.documentElement.setAttribute('data-darkmode', 'true'); else document.documentElement.removeAttribute('data-darkmode'); }, dark);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.waitForTimeout(300);
      const log = await page.locator('#syslog').evaluate(node => ({ padding: parseFloat(getComputedStyle(node).paddingLeft), line: parseFloat(getComputedStyle(node).lineHeight), size: parseFloat(getComputedStyle(node).fontSize), rows: node.value.split('\n').length }));
      assert(log.padding >= 18 && log.line >= log.size * 1.8 && log.rows === 24, 'Log text retains data and generous inner spacing');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `System log does not overflow at ${width}`);
      await page.screenshot({ path: path.join(os.tmpdir(), `unifi-v030-log-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(upstreamStyles, [], 'No upstream stylesheet request: original theme CSS only');
  console.log('PASS: real LuCI Dropdown, multi-select, DynamicList add/remove, ComboButton, modal open/Escape, optional clearing; padded firewall/log surfaces and action buttons; no Bootstrap requests.');
  console.log('PASS: vertical settings navigation delegates to real LuCI switchTab(); unsaved inputs, native pane adjacency, hidden tabs and validation badges preserved; 1440/1024/768/390/320 light/dark layouts.');
  console.log('PASS: actual LuCI DOM factory, SVG icons, live graph samples, native NIC metadata, chart controls, click/hover/keyboard menus, RPC recovery, desktop/mobile light/dark.');
  console.log(JSON.stringify(graphics, null, 2));
} finally {
  await browser.close();
  server.close();
}
