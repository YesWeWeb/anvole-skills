/**
 * Collecte HP OfficeConnect — Lua Server Pages via Playwright
 *
 * Usage : node collect_hp.js <IP> <PASSWORD> [BASE_DIR] [USERNAME]
 *
 * Produit dans BASE_DIR/<HOSTNAME>/ :
 *   metadata.json   — hostname, ip, vendor, model, firmware, mac, collectedAt
 *   system.json     — hostname, firmware, serial, MAC, uptime
 *   ports.json      — statut, vitesse, link state par port
 *   poe.json        — puissance PoE, detection status par port
 *   vlans.json      — liste des VLANs avec noms
 *   vlan_ports.json — PVID, tagged/untagged par port
 *   lldp.json       — voisins LLDP : chassis ID, system name, capabilities, mgmt IP
 *   mac_table.json  — table MAC : MAC → port + VLAN
 *   trunks.json     — link aggregation groups
 */

const { chromium } = require('playwright');
const fs = require('fs');

const IP       = process.argv[2];
const PASSWORD = process.argv[3];
const BASE_DIR = process.argv[4] || 'C:/tmp/switch-data';
const USERNAME = process.argv[5] || 'admin';

if (!IP || !PASSWORD) {
  console.error('Usage: node collect_hp.js <IP> <PASSWORD> [BASE_DIR] [USERNAME]');
  process.exit(1);
}

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Pages LSP à collecter (clé → chemin relatif)
const LSP_PAGES = {
  ports:      '/htdocs/pages/base/port_summary.lsp',
  poe:        '/htdocs/pages/base/poe_port_cfg.lsp',
  vlans:      '/htdocs/pages/switching/vlan_status.lsp',
  vlan_ports: '/htdocs/pages/switching/vlan_port.lsp',
  lldp:       '/htdocs/pages/switching/lldp_remote.lsp',
  mac_table:  '/htdocs/pages/base/mac_address_table.lsp',
  trunks:     '/htdocs/pages/switching/port_channel_summary.lsp',
};

/**
 * Extrait var aDataSet = [...] depuis le HTML d'une page LSP.
 * Retourne un tableau de tableaux, ou [] si non trouvé.
 */
function parseDataSet(html) {
  // HP 1920S uses: aDataSet = [ ['val1','val2'], ... ] (no "var", single quotes, HTML in values)
  // Find the balanced array using bracket matching
  const start = html.indexOf('aDataSet');
  if (start === -1) return [];
  const eqPos = html.indexOf('=', start);
  const arrStart = html.indexOf('[', eqPos);
  if (arrStart === -1) return [];

  let depth = 0;
  let arrEnd = -1;
  for (let i = arrStart; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  if (arrEnd === -1) return [];

  let raw = html.substring(arrStart, arrEnd + 1);

  // Convert JS array literal (single quotes) to valid JSON (double quotes)
  // Strategy: use Function() to safely evaluate the JS array literal
  try {
    const fn = new Function('return ' + raw);
    return fn();
  } catch (e) {
    return [];
  }
}

/**
 * Extrait les infos système depuis dashboard.lsp (pas de aDataSet).
 * Parse les champs de formulaire et labels.
 */
function parseDashboard(html) {
  const get = (id) => {
    const m = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`, 'i'));
    return m ? m[1].trim() : '';
  };
  const getLabel = (label) => {
    const m = html.match(new RegExp(`>${label}<\\/td>\\s*<td[^>]*>([^<]+)<`, 'i'));
    return m ? m[1].trim() : '';
  };

  return {
    hostname:    get('sys_name') || getLabel('System Name'),
    description: getLabel('System Description'),
    location:    get('sys_location'),
    contact:     get('sys_contact'),
    oid:         getLabel('System Object ID'),
    uptime:      getLabel('System Up Time'),
    firmware:    getLabel('Software Version'),
    os:          getLabel('Operating System'),
    serial:      getLabel('Serial Number'),
    mac:         getLabel('MAC Address') || getLabel('Base MAC Address'),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();

  // Étape 1 : Accéder au switch
  console.log(`Connexion à http://${IP}/...`);
  await page.goto(`http://${IP}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });

  // Étape 2 : Login via formulaire jQuery
  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('#login_button');

  // Attendre la redirection vers main.lsp ou dashboard
  await page.waitForURL(/main\.lsp|dashboard/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const currentUrl = page.url();
  if (!currentUrl.includes('.lsp') && !currentUrl.includes('main')) {
    console.error(`Login échoué. URL actuelle : ${currentUrl}`);
    console.error('Vérifier le mot de passe.');
    await browser.close();
    process.exit(1);
  }
  console.log('Login OK');

  // Étape 3 : Collecter dashboard.lsp (infos système)
  const baseUrl = `http://${IP}`;
  const dashHtml = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: 'include' });
    return r.text();
  }, `${baseUrl}/htdocs/pages/base/dashboard.lsp`);

  const system = parseDashboard(dashHtml);
  const hostname = system.hostname || `hp-${IP.replace(/\./g, '-')}`;
  console.log(`Hostname : ${hostname}`);

  // Étape 4 : Collecter toutes les pages LSP
  // Fetch all pages from browser context and return raw HTML
  const rawPages = await page.evaluate(async (pages) => {
    const results = {};
    for (const [key, path] of Object.entries(pages)) {
      try {
        const r = await fetch(path, { credentials: 'include' });
        results[key] = await r.text();
      } catch (e) {
        results[key] = `ERROR: ${e.message}`;
      }
    }
    return results;
  }, LSP_PAGES);

  const results = {};
  for (const [key, html] of Object.entries(rawPages)) {
    results[key] = parseDataSet(html);

    // Cas spécial PoE : extraire consPower
    if (key === 'poe') {
      const cpMatch = html.match(/var\s+consPower\s*=\s*"(\d+)"/);
      if (cpMatch) system.poeConsumedPower = parseInt(cpMatch[1], 10);
    }

    const ok = results[key].length > 0;
    console.log(`${ok ? 'OK' : 'WARN'} ${key} (${results[key].length} entrées)`);
  }

  // Étape 5 : Créer le répertoire de sortie
  const OUT_DIR = `${BASE_DIR}/${hostname}`;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Répertoire de sortie : ${OUT_DIR}`);

  // Étape 6 : Sauvegarder les fichiers JSON
  fs.writeFileSync(`${OUT_DIR}/system.json`, JSON.stringify(system, null, 2));
  console.log('OK system.json');

  let allOk = true;
  for (const [key, data] of Object.entries(results)) {
    const path = `${OUT_DIR}/${key}.json`;
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    if (data.length === 0) allOk = false;
  }

  // Étape 7 : Sauvegarder metadata.json (format commun multi-vendor)
  const metadata = {
    hostname,
    ip:          IP,
    vendor:      'hp-officeconnect',
    model:       system.description || 'HP OfficeConnect',
    firmware:    system.firmware,
    mac:         system.mac,
    serial:      system.serial,
    collectedAt: new Date().toISOString(),
  };
  fs.writeFileSync(`${OUT_DIR}/metadata.json`, JSON.stringify(metadata, null, 2));
  console.log('OK metadata.json');

  console.log(`\nCollecte terminée → ${OUT_DIR}/`);
  if (!allOk) {
    console.warn('Certains fichiers sont vides — vérifier la connectivité ou les permissions.');
  }

  await browser.close();
})().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
