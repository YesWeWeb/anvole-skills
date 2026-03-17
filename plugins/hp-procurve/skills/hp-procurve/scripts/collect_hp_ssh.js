/**
 * Collecte HP ProCurve / Aruba ProVision — SSH
 *
 * Usage : node collect_hp_ssh.js <IP> <PASSWORD> [BASE_DIR] [USERNAME]
 *
 * Produit dans BASE_DIR/<HOSTNAME>/ :
 *   metadata.json      — hostname, ip, vendor, model, firmware, mac, collectedAt
 *   version.txt        — show version
 *   vlans.txt          — show vlans
 *   interfaces.txt     — show interfaces brief
 *   mac.txt            — show mac-address
 *   lldp.txt           — show lldp info remote-device detail
 *   running_config.txt — show running-config
 *   poe.txt            — show power-over-ethernet brief
 *
 * Gère automatiquement :
 * - Banner "Press any key to continue" → envoie espace
 * - Pager "-- MORE --" → envoie espace
 * - no page pour désactiver le pager
 */

const { Client } = require('ssh2');
const fs = require('fs');

const IP       = process.argv[2];
const PASSWORD = process.argv[3];
const BASE_DIR = process.argv[4] || 'C:/tmp/switch-data';
const USERNAME = process.argv[5] || 'admin';

if (!IP || !PASSWORD) {
  console.error('Usage: node collect_hp_ssh.js <IP> <PASSWORD> [BASE_DIR] [USERNAME]');
  process.exit(1);
}

if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

const COMMANDS = [
  { cmd: 'no page',                              file: null },
  { cmd: 'show version',                         file: 'version.txt' },
  { cmd: 'show vlans',                           file: 'vlans.txt' },
  { cmd: 'show interfaces brief',                file: 'interfaces.txt' },
  { cmd: 'show mac-address',                     file: 'mac.txt' },
  { cmd: 'show lldp info remote-device',          file: 'lldp.txt' },
  { cmd: 'show running-config',                  file: 'running_config.txt' },
  { cmd: 'show power-over-ethernet brief',       file: 'poe.txt' },
];

const conn = new Client();
let recentData = '';
let state      = 'waiting_banner';
let cmdQueue   = [...COMMANDS];
let cmdLocked  = false;
let stream     = null;

let currentFile   = null;
let currentOutput = '';

const PROMPT_RE = /[#>]\s*$/;
const MORE_RE   = /-- MORE --/;

let hostname = null;

// Nettoie tous les codes ANSI escape d'un texte
function stripAnsi(text) {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9]*[A-D]/g, '')
    .replace(/\r/g, '');
}

function extractHostname(text) {
  const clean = stripAnsi(text);
  const m = clean.match(/([A-Za-z0-9_\-\.]+)[#>]\s*$/m);
  if (m && m[1] && m[1] !== 'Password') return m[1].trim();
  return null;
}

function saveCurrentOutput() {
  if (!currentFile || !currentOutput.trim()) return;
  if (!hostname) return;

  const OUT_DIR = `${BASE_DIR}/${hostname}`;
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let content = currentOutput
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')   // codes ANSI séquences CSI
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '') // mode set/reset ANSI
    .replace(/\x1b[()][A-Z0-9]/g, '')        // character set selection
    .replace(/\r/g, '')
    .trim();

  // Retirer les lignes de prompt à la fin
  let lines = content.split('\n');
  while (lines.length > 0 && /[#>]\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }
  // Retirer la première ligne (écho de la commande, souvent avec résidus ANSI)
  if (lines.length > 0) {
    lines.shift();
  }
  content = lines.join('\n').trim();

  fs.writeFileSync(`${OUT_DIR}/${currentFile}`, content + '\n');
  console.log(`  OK ${currentFile} (${content.length} bytes)`);

  currentOutput = '';
  currentFile   = null;
}

function onData(data) {
  const chunk = data.toString();
  recentData += chunk;
  if (recentData.length > 500) recentData = recentData.slice(-500);

  // Nettoyage ANSI pour la détection de patterns
  const clean = stripAnsi(recentData).trimEnd();

  if (state === 'sending' && currentFile) {
    currentOutput += chunk;
  }

  // Banner "Press any key to continue" au démarrage
  if (state === 'waiting_banner') {
    if (/Press any key to continue/i.test(clean)) {
      recentData = '';
      stream.write(' ');
      state = 'waiting_prompt';
      return;
    }
    // Peut-être pas de banner → directement un prompt
    if (PROMPT_RE.test(clean)) {
      state = 'waiting_prompt';
      // fall through
    } else {
      return;
    }
  }

  // Attente du premier prompt
  if (state === 'waiting_prompt') {
    if (PROMPT_RE.test(clean)) {
      if (!hostname) {
        hostname = extractHostname(recentData);
        if (hostname) {
          console.log(`Hostname : ${hostname}`);
          const OUT_DIR = `${BASE_DIR}/${hostname}`;
          if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
        }
      }
      recentData = '';
      state = 'sending';
      sendNextCommand();
    }
    return;
  }

  // Mode envoi des commandes
  if (state === 'sending') {
    // Pager → avancer
    if (MORE_RE.test(clean)) {
      recentData = '';
      stream.write(' ');
      return;
    }

    // Prompt → sauvegarder et commande suivante
    if (!cmdLocked && PROMPT_RE.test(clean)) {
      if (!hostname) {
        hostname = extractHostname(recentData);
        if (hostname) console.log(`Hostname : ${hostname}`);
      }

      recentData = '';
      cmdLocked  = true;

      if (currentFile && currentOutput) {
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
    console.log('\nToutes les commandes envoyées.');
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

function writeMetadata() {
  if (!hostname) {
    hostname = `hp-${IP.replace(/\./g, '-')}`;
    const OUT_DIR = `${BASE_DIR}/${hostname}`;
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const OUT_DIR = `${BASE_DIR}/${hostname}`;

  let versionTxt = '';
  try { versionTxt = fs.readFileSync(`${OUT_DIR}/version.txt`, 'utf8'); } catch (_) {}

  let model    = '';
  let firmware = '';
  const mModel = versionTxt.match(/HP\s+([^\r\n]+Switch[^\r\n]*)/i)
              || versionTxt.match(/Aruba\s+([^\r\n]+Switch[^\r\n]*)/i);
  if (mModel) model = mModel[1].trim();

  const mFw = versionTxt.match(/([A-Z]{2}\.\d+\.\d+\.\d+)/);
  if (mFw) firmware = mFw[1].trim();

  const metadata = {
    hostname,
    ip:          IP,
    vendor:      'hp-procurve',
    model:       model || 'HP ProCurve',
    firmware:    firmware || '',
    mac:         '',
    serial:      '',
    collectedAt: new Date().toISOString(),
  };

  fs.writeFileSync(`${OUT_DIR}/metadata.json`, JSON.stringify(metadata, null, 2));
  console.log(`  OK metadata.json`);
  console.log(`\nCollecte terminée → ${OUT_DIR}/`);
}

conn.on('ready', () => {
  console.log(`SSH connecté à ${IP}`);
  conn.shell((err, s) => {
    if (err) { console.error('Shell error:', err.message); conn.end(); return; }
    stream = s;
    stream.on('data', onData);
    stream.stderr.on('data', () => {});
    stream.on('close', () => { conn.end(); });

    // Fallback : si pas de banner après 5s
    setTimeout(() => {
      if (state === 'waiting_banner') {
        state = 'waiting_prompt';
        stream.write('\n');
      }
    }, 5000);
  });
}).connect({
  host: IP,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 20000,
  algorithms: {
    serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ssh-dss'],
    kex: [
      'diffie-hellman-group-exchange-sha256',
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group1-sha1',
      'ecdh-sha2-nistp256',
    ],
    cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc'],
  },
});

conn.on('error', (err) => {
  console.error('Erreur SSH:', err.message);
  process.exit(1);
});
