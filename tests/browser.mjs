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
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let filename;
    if (url.pathname === '/') filename = path.join(root, 'tests/preview.html');
    else if (url.pathname.startsWith('/luci-static/bootstrap/'))
      filename = path.join(upstream, 'themes/luci-theme-bootstrap/htdocs', url.pathname);
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
      system: child('system', 'System', { package: child('package', 'Software') }),
      logout: child('logout', 'Logout')
    });
    const ui = { menu: { load: () => Promise.resolve({ children: { admin } }), getChildren: node => Object.values(node.children || {}) } };
    window.theme = new Function('baseclass', 'ui', 'network', 'poll', 'rpc', source)({ extend: obj => obj }, ui, network, poll, rpc);
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
      await page.screenshot({ path: path.join(os.tmpdir(), `unifi-v021-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: actual LuCI DOM factory, SVG icons, live graph samples, native NIC metadata, chart controls, click/hover/keyboard menus, RPC recovery, desktop/mobile light/dark.');
  console.log(JSON.stringify(graphics, null, 2));
} finally {
  await browser.close();
  server.close();
}
