/**
 * Collecte Cisco Small Business — SSH avec double authentification
 * Version 3 — structure normalisée multi-vendor
 *
 * Usage : node collect_cisco_ssh.js <IP> <PASSWORD> [BASE_DIR] [USERNAME]
 *
 * Produit dans BASE_DIR/<HOSTNAME>/ :
 *   metadata.json      — hostname, ip, vendor, model, firmware, mac, collectedAt
 *   version.txt        — show version
 *   system.txt         — show system
 *   ip_interface.txt   — show ip interface
 *   interfaces.txt     — show interfaces status
 *   vlans.txt          — show vlan
 *   mac.txt            — show mac address-table
 *   lldp.txt           — show lldp neighbors
 *   running_config.txt — show running-config
 *
 * Gère automatiquement :
 * - Double auth shell (User Name: + Password: dans le shell après SSH)
 * - Pager More: → envoie espace automatiquement
 * - terminal length 0 tentée en premier (échoue sur firmware 1.4.x, ignorée)
 */

const { Client } = require('ssh2');
const fs = require('fs');

const IP       = process.argv[2];
const PASSWORD = process.argv[3];
const BASE_DIR = process.argv[4] || 'C:/tmp/switch-data';
const USERNAME = process.argv[5] || 'admin';

if (!IP || !PASSWORD) {
  console.error('Usage: node collect_cisco_ssh.js <IP> <PASSWORD> [BASE_DIR] [USERNAME]');
  process.exit(1);
}

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Commandes à exécuter et nom de fichier de sortie associé
const COMMANDS = [
  { cmd: 'terminal length 0',    file: null },              // tenter désactivation pager (ignoré si 1.4.x)
  { cmd: 'show version',         file: 'version.txt' },
  { cmd: 'show system',          file: 'system.txt' },
  { cmd: 'show ip interface',    file: 'ip_interface.txt' },
  { cmd: 'show interfaces status', file: 'interfaces.txt' },
  { cmd: 'show vlan',            file: 'vlans.txt' },
  { cmd: 'show mac address-table', file: 'mac.txt' },
  { cmd: 'show lldp neighbors',  file: 'lldp.txt' },
  { cmd: 'show running-config',  file: 'running_config.txt' },
];

const conn = new Client();
let fullOutput = '';
let recentData = '';    // buffer glissant (300 derniers chars) pour détecter prompt/More:
let authState  = 'waiting_user';
let cmdQueue   = [...COMMANDS];
let cmdLocked  = false;
let stream     = null;

// Output accumulé pour la commande courante
let currentFile   = null;   // nom du fichier cible (ou null si pas à sauvegarder)
let currentOutput = '';     // texte accumulé depuis le dernier prompt

// Prompt du switch : se termine par # + éventuel espace/retour
const PROMPT_RE = /#\s*$/;
// Pager Cisco SB : "More:" avec ou sans codes ANSI
const MORE_RE   = /More:/i;

// Hostname extrait depuis le prompt (ex: "CBTP-SW02-972#")
let hostname = null;

function extractHostname(text) {
  // Le prompt Cisco SB ressemble à : HOSTNAME# ou HOSTNAME>
  const m = text.match(/([A-Za-z0-9_\-\.]+)[#>]\s*$/m);
  if (m && m[1] && m[1] !== 'Password' && m[1] !== 'User Name') {
    return m[1].trim();
  }
  return null;
}

function saveCurrentOutput() {
  if (!currentFile || !currentOutput.trim()) return;
  if (!hostname) return; // répertoire pas encore connu

  const OUT_DIR = `${BASE_DIR}/${hostname}`;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Nettoyer l'output : retirer la ligne de commande écho et les codes ANSI
  let content = currentOutput
    .replace(/\x1b\[[0-9;]*[mGKHF]/g, '')  // codes ANSI couleur/déplacement
    .replace(/\r/g, '')                      // CR Windows
    .trim();

  fs.writeFileSync(`${OUT_DIR}/${currentFile}`, content + '\n');
  console.log(`  OK ${currentFile} (${content.length} bytes)`);

  currentOutput = '';
  currentFile   = null;
}

function onData(data) {
  const chunk = data.toString();
  fullOutput  += chunk;
  process.stdout.write(chunk);

  recentData += chunk;
  if (recentData.length > 300) recentData = recentData.slice(-300);

  // Accumuler pour le fichier courant (en mode sending)
  if (authState === 'sending' && currentFile) {
    currentOutput += chunk;
  }

  // --- Gestion de la double authentification shell ---

  if (authState === 'waiting_user') {
    if (/User Name:/i.test(recentData)) {
      recentData = '';
      console.log('\n[AUTH] Demande User Name shell → envoi du username');
      stream.write(USERNAME + '\n');
      authState = 'waiting_pass';
    }
    return;
  }

  if (authState === 'waiting_pass') {
    if (/Password:/i.test(recentData)) {
      recentData = '';
      console.log('\n[AUTH] Demande Password shell → envoi du mot de passe');
      stream.write(PASSWORD + '\n');
      authState = 'waiting_first_prompt';
    }
    return;
  }

  // --- Attendre le premier prompt # après login ---

  if (authState === 'waiting_first_prompt') {
    if (PROMPT_RE.test(recentData.trimEnd())) {
      // Extraire le hostname depuis le prompt initial
      if (!hostname) {
        hostname = extractHostname(recentData);
        if (hostname) {
          console.log(`\n[INFO] Hostname détecté : ${hostname}`);
          const OUT_DIR = `${BASE_DIR}/${hostname}`;
          if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
          console.log(`[INFO] Répertoire de sortie : ${OUT_DIR}`);
        }
      }
      recentData = '';
      authState  = 'sending';
      console.log('\n[COLLECT] Envoi des commandes...');
      sendNextCommand();
    }
    return;
  }

  // --- Envoi des commandes : gérer pager et prompt ---

  if (authState === 'sending') {
    // Pager détecté → avancer d'une page avec espace
    if (MORE_RE.test(recentData)) {
      recentData = '';
      stream.write(' ');
      return;
    }

    // Prompt détecté → sauvegarder output courant et envoyer la commande suivante
    if (!cmdLocked && PROMPT_RE.test(recentData.trimEnd())) {
      // Extraire hostname si pas encore connu (certains firmwares n'affichent le prompt qu'ici)
      if (!hostname) {
        hostname = extractHostname(recentData);
        if (hostname) {
          console.log(`\n[INFO] Hostname détecté : ${hostname}`);
          const OUT_DIR = `${BASE_DIR}/${hostname}`;
          if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
        }
      }

      recentData = '';
      cmdLocked  = true;

      // Retirer le prompt du texte accumulé pour ne garder que le contenu de la commande
      if (currentFile && currentOutput) {
        // Supprimer la dernière ligne (le prompt de fin)
        const lines = currentOutput.split('\n');
        // Chercher et supprimer la ligne de prompt à la fin
        let lastSignif = lines.length - 1;
        while (lastSignif > 0 && /[#>]\s*$/.test(lines[lastSignif].replace(/\x1b\[[0-9;]*[mGKHF]/g, ''))) {
          lastSignif--;
        }
        currentOutput = lines.slice(0, lastSignif + 1).join('\n');
        saveCurrentOutput();
      }

      setTimeout(() => {
        cmdLocked = false;
        sendNextCommand();
      }, 200);
    }
  }
}

function sendNextCommand() {
  if (cmdQueue.length === 0) {
    console.log('\n[DONE] Toutes les commandes envoyées → sauvegarde et fermeture');
    writeMetadata();
    setTimeout(() => stream.write('exit\n'), 500);
    return;
  }
  const { cmd, file } = cmdQueue.shift();
  currentFile   = file;
  currentOutput = '';
  console.log(`  → ${cmd}`);
  stream.write(cmd + '\n');
}

function parseMetadata(versionTxt, systemTxt) {
  let model    = '';
  let firmware = '';
  let mac      = '';
  let serial   = '';

  // show version : "Cisco Small Business SG300-52 ..." et "Version: 1.4.8.06"
  if (versionTxt) {
    const mModel = versionTxt.match(/Cisco Small Business\s+([^\r\n]+)/i);
    if (mModel) model = mModel[1].trim();

    const mFw = versionTxt.match(/Version:\s*([\d.]+)/i);
    if (mFw) firmware = mFw[1].trim();
  }

  // show system : MAC address et serial
  if (systemTxt) {
    // Format Cisco SB : "MAC Address : xx:xx:xx:xx:xx:xx"
    const mMac = systemTxt.match(/MAC\s+Address\s*[:\-]\s*([0-9a-fA-F:]+)/i);
    if (mMac) mac = mMac[1].trim();

    const mSerial = systemTxt.match(/Serial\s+Number\s*[:\-]\s*(\S+)/i);
    if (mSerial) serial = mSerial[1].trim();
  }

  return { model, firmware, mac, serial };
}

function writeMetadata() {
  if (!hostname) {
    // Fallback : utiliser l'IP
    hostname = `cisco-${IP.replace(/\./g, '-')}`;
    const OUT_DIR = `${BASE_DIR}/${hostname}`;
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const OUT_DIR = `${BASE_DIR}/${hostname}`;

  // Lire les fichiers déjà écrits pour en extraire les métadonnées
  let versionTxt = '';
  let systemTxt  = '';
  try { versionTxt = fs.readFileSync(`${OUT_DIR}/version.txt`, 'utf8'); } catch (_) {}
  try { systemTxt  = fs.readFileSync(`${OUT_DIR}/system.txt`,  'utf8'); } catch (_) {}

  const { model, firmware, mac, serial } = parseMetadata(versionTxt, systemTxt);

  const metadata = {
    hostname,
    ip:          IP,
    vendor:      'cisco-sb',
    model:       model  || 'Cisco Small Business',
    firmware:    firmware || '',
    mac:         mac    || '',
    serial:      serial || '',
    collectedAt: new Date().toISOString(),
  };

  fs.writeFileSync(`${OUT_DIR}/metadata.json`, JSON.stringify(metadata, null, 2));
  console.log(`  OK metadata.json`);
  console.log(`\nCollecte terminée → ${OUT_DIR}/`);
}

conn.on('ready', () => {
  console.log('SSH connecté (niveau protocole). En attente du shell...');
  conn.shell((err, s) => {
    if (err) { console.error('Shell error:', err.message); conn.end(); return; }

    stream = s;
    stream.on('data', onData);
    stream.stderr.on('data', (d) => { fullOutput += d.toString(); });

    stream.on('close', () => {
      authState = 'done';
      conn.end();
    });

    // Fallback : si pas de double auth après 4s (firmware récent ou config différente)
    setTimeout(() => {
      if (authState === 'waiting_user') {
        console.log('[AUTH] Pas de double auth détectée → attente du prompt direct');
        authState = 'waiting_first_prompt';
      }
    }, 4000);
  });

}).connect({
  host: IP,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 20000,
  algorithms: {
    // Nécessaire pour les firmware anciens Cisco SB (2016 et avant)
    serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384'],
    kex: [
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group1-sha1',
      'ecdh-sha2-nistp256',
      'diffie-hellman-group14-sha256',
    ],
    cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc'],
  },
});

conn.on('error', (err) => {
  console.error('Erreur SSH:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('→ SSH non disponible sur ce switch. Activer via l\'interface web :');
    console.error('  Administration → Management Interface → SSH → Enable');
  }
  process.exit(1);
});
