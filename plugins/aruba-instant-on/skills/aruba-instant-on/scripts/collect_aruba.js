/**
 * Collecte Aruba Instant On — WCD XML via Playwright
 *
 * Usage : node collect_aruba.js <IP> <PASSWORD> [BASE_DIR]
 *
 * Produit dans BASE_DIR/<HOSTNAME>/ :
 *   metadata.json  — hostname, ip, vendor, model, firmware, mac, collectedAt
 *   system.xml     — hostname, firmware, MAC, serial
 *   ports.xml      — statut, vitesse, PoE par port
 *   poe.xml        — puissance PoE délivrée par port
 *   vlans.xml      — liste des VLANs avec noms
 *   members.xml    — tagged/untagged ports par VLAN
 *   lldp_med.xml   — voisins LLDP-MED (téléphones IP, APs) : nom, modèle, IP, VLAN voix
 *   mac.xml        — table MAC : MAC → port + VLAN
 *   arp.xml        — table ARP : IP → MAC → interface VLAN
 */

const { chromium } = require('playwright');
const fs = require('fs');

const IP       = process.argv[2];
const PASSWORD = process.argv[3];
const BASE_DIR = process.argv[4] || 'C:/tmp/switch-data';

if (!IP || !PASSWORD) {
  console.error('Usage: node collect_aruba.js <IP> <PASSWORD> [BASE_DIR]');
  process.exit(1);
}

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();

  // Étape 1 : Accéder au switch → redirige vers login.htm avec session ID dans l'URL
  console.log(`Connexion à http://${IP}/...`);
  await page.goto(`http://${IP}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#inputUsername', { timeout: 15000 });

  // Étape 2 : Remplir et soumettre via formSubmit() JavaScript
  // IMPORTANT : ne pas cliquer le bouton — cela bypasse le RSA et échoue l'auth
  await page.fill('#inputUsername', 'admin');
  await page.fill('#inputPassword', PASSWORD);
  await page.evaluate(() => {
    if (typeof formSubmit === 'function') {
      formSubmit();
    } else {
      document.querySelector('#signinForm').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }));
    }
  });

  // Attendre la redirection vers home.htm
  await page.waitForURL(/home\.htm/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Étape 3 : Extraire le session ID depuis l'URL
  const currentUrl = page.url();
  const sidMatch = currentUrl.match(/\/(cs[a-f0-9]+)\//);
  const sessionId = sidMatch ? sidMatch[1] : null;

  if (!sessionId || !currentUrl.includes('home.htm')) {
    console.error(`Login échoué. URL actuelle : ${currentUrl}`);
    console.error('Vérifier le mot de passe.');
    await browser.close();
    process.exit(1);
  }

  console.log(`Session ID : ${sessionId}`);
  const wcdBase = `http://${IP}/${sessionId}/hpe/wcd`;

  // Étape 4 : Requêter les endpoints WCD via fetch() interne
  // Les cookies de session sont automatiquement inclus dans le contexte du navigateur
  const data = await page.evaluate(async ({ base }) => {
    const get = async (ep) => {
      try {
        const r = await fetch(`${base}?${ep}`, { credentials: 'include' });
        return r.text();
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    };
    return {
      system:   await get('{SystemGlobalSetting}'),
      ports:    await get('{Ports}'),
      poe:      await get('{PoEPSEInterfaceList}'),
      vlans:    await get('{VLANList}'),
      members:  await get('{VLANInterfaceMembershipTable}'),
      lldp_med: await get('{LLDPMEDNeighborList}'),
      mac:      await get('{ForwardingTable}'),
      arp:      await get('{ARPList}'),
    };
  }, { base: wcdBase });

  // Étape 5 : Extraire le hostname depuis system.xml pour nommer le répertoire
  const hostnameMatch = data.system.match(/<systemName>([^<]+)<\/systemName>/);
  const macMatch      = data.system.match(/<MACAddress>([^<]+)<\/MACAddress>/);
  const firmwareMatch = data.system.match(/<firmwareVersion>([^<]+)<\/firmwareVersion>/);
  const modelMatch    = data.system.match(/<systemDescription>([^<]+)<\/systemDescription>/);
  const serialMatch   = data.system.match(/<serialNumber>([^<]+)<\/serialNumber>/);

  const hostname = hostnameMatch ? hostnameMatch[1].trim() : `aruba-${IP.replace(/\./g, '-')}`;
  const mac      = macMatch      ? macMatch[1].trim()      : '';
  const firmware = firmwareMatch ? firmwareMatch[1].trim() : '';
  const model    = modelMatch    ? modelMatch[1].trim()    : 'Aruba Instant On';
  const serial   = serialMatch   ? serialMatch[1].trim()   : '';

  // Étape 6 : Créer le répertoire <BASE_DIR>/<HOSTNAME>/
  const OUT_DIR = `${BASE_DIR}/${hostname}`;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Répertoire de sortie : ${OUT_DIR}`);

  // Étape 7 : Sauvegarder les XML
  const files = {
    'system.xml':   data.system,
    'ports.xml':    data.ports,
    'poe.xml':      data.poe,
    'vlans.xml':    data.vlans,
    'members.xml':  data.members,
    'lldp_med.xml': data.lldp_med,
    'mac.xml':      data.mac,
    'arp.xml':      data.arp,
  };

  let allOk = true;
  for (const [filename, content] of Object.entries(files)) {
    const path = `${OUT_DIR}/${filename}`;
    fs.writeFileSync(path, content);
    const size = content.length;
    const ok = size > 100 && content.includes('<ActionStatus>') && !content.includes('ERROR:');
    console.log(`${ok ? 'OK' : 'WARN'} ${filename} (${size} bytes)`);
    if (!ok) allOk = false;
  }

  // Étape 8 : Sauvegarder metadata.json (format commun multi-vendor)
  const metadata = {
    hostname,
    ip:          IP,
    vendor:      'aruba-instant-on',
    model,
    firmware,
    mac,
    serial,
    sessionId,
    collectedAt: new Date().toISOString(),
  };
  fs.writeFileSync(`${OUT_DIR}/metadata.json`, JSON.stringify(metadata, null, 2));
  console.log(`OK metadata.json`);

  console.log(`\nCollecte terminée → ${OUT_DIR}/`);
  if (!allOk) {
    console.warn('Certains fichiers semblent vides — vérifier le mot de passe ou la connectivité.');
  }

  await browser.close();
})().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
