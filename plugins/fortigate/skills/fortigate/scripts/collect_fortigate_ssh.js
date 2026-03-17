/**
 * Collecte FortiGate — SSH avec detection de prompt (state machine)
 *
 * Usage : node collect_fortigate_ssh.js <IP> <PORT> <PASSWORD> [OUT_DIR] [USERNAME] [--vdom <name>] [--cmd-timeout <ms>]
 *
 * FortiOS utilise keyboard-interactive pour l'authentification SSH.
 * Le port SSH est souvent non-standard (ex: 48022).
 * Pas de pager a desactiver (FortiOS envoie la sortie complete en SSH).
 *
 * Produit dans OUT_DIR un fichier par categorie :
 *   system.txt      — hostname, firmware, serial, perf, NICs
 *   interfaces.txt  — interfaces physiques + config (VLANs, alias)
 *   routing.txt     — table de routage + routes statiques
 *   policies.txt    — firewall policies
 *   objects.txt     — adresses, groupes, VIP, IP pools
 *   services.txt    — services custom + groupes
 *   zones.txt       — zones de securite
 *   dhcp_dns.txt    — serveurs DHCP + DNS
 *   vpn.txt         — IPSec phase1/phase2 + tunnel summary + SSL VPN
 *   users.txt       — users locaux, groupes, LDAP
 *   network.txt     — HA, ARP, sessions, SD-WAN
 *   security.txt    — profils AV, webfilter, IPS, app control
 *   admin.txt       — logging, SNMP, NTP, admin, VDOM
 *   metadata.json   — hostname, firmware, model, serial, timestamp
 */

const { Client } = require('ssh2');
const fs = require('fs');

// --- Parse arguments ---
const args = process.argv.slice(2);
const IP       = args[0];
const PORT     = parseInt(args[1], 10);
const PASSWORD = args[2];
const OUT_DIR  = args[3] || 'C:/tmp/fortigate_data';
const USERNAME = args[4] || 'admin';

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}
const vdomName   = getFlag('--vdom');
const CMD_TIMEOUT = parseInt(getFlag('--cmd-timeout') || '30000', 10);

if (!IP || !PORT || !PASSWORD) {
  console.error('Usage: node collect_fortigate_ssh.js <IP> <PORT> <PASSWORD> [OUT_DIR] [USERNAME] [--vdom <name>] [--cmd-timeout <ms>]');
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Commandes groupees par categorie → un fichier par groupe
const GROUPS = {
  system:     ['get system status', 'get system performance status', 'get hardware nic'],
  interfaces: ['get system interface physical', 'show system interface'],
  routing:    ['get router info routing-table all', 'show router static'],
  policies:   ['show firewall policy'],
  objects:    ['show firewall address', 'show firewall addrgrp', 'show firewall vip', 'show firewall ippool'],
  services:   ['show firewall service custom', 'show firewall service group'],
  zones:      ['show system zone'],
  dhcp_dns:   ['show system dhcp server', 'get system dns', 'show system dns-database'],
  vpn:        ['show vpn ipsec phase1-interface', 'show vpn ipsec phase2-interface', 'get vpn ipsec tunnel summary', 'show vpn ssl settings'],
  users:      ['show user local', 'show user group', 'show user ldap'],
  network:    ['get system ha status', 'get system arp', 'get system session-info statistics', 'show system sdwan'],
  security:   ['show antivirus profile', 'show webfilter profile', 'show ips sensor', 'show application list'],
  admin:      ['show log setting', 'show system snmp community', 'show system ntp', 'show system admin', 'get system vdom-property'],
};

// Mapping commande → groupe
const CMD_TO_GROUP = {};
for (const [group, cmds] of Object.entries(GROUPS)) {
  for (const cmd of cmds) {
    CMD_TO_GROUP[cmd] = group;
  }
}

// Bootstrap command: always first for hostname + version detection
const BOOTSTRAP_CMD = 'get system status';

// Build flat command list with bootstrap first
let COMMANDS = [BOOTSTRAP_CMD];
for (const [, cmds] of Object.entries(GROUPS)) {
  for (const cmd of cmds) {
    if (cmd !== BOOTSTRAP_CMD) COMMANDS.push(cmd);
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- State machine ---
let recentData = '';
let state = 'waiting_prompt';   // waiting_prompt | entering_vdom | sending | done
let hostname = null;
let fortiosVersion = null;
let fortiosModel = null;
let fortiosSerial = null;
let stream = null;
let cmdLocked = false;
let commandTimeout = null;

// Command queue: [{cmd, group}]
let cmdQueue = [];
// Results: [{command, output, group}]
const commandResults = [];

let currentCmd = null;
let currentOutput = '';

function resetCommandTimeout() {
  if (commandTimeout) clearTimeout(commandTimeout);
  commandTimeout = setTimeout(() => {
    console.warn(`[WARN] Timeout (${CMD_TIMEOUT}ms) waiting for prompt after: ${currentCmd ? currentCmd.cmd : '?'}`);
    saveCommandResult();
    sendNextCommand();
  }, CMD_TIMEOUT);
}

function clearCommandTimeout() {
  if (commandTimeout) { clearTimeout(commandTimeout); commandTimeout = null; }
}

function adaptCommandsForVersion(cmds) {
  if (!fortiosVersion) return cmds;
  const major = parseFloat(fortiosVersion.replace('v', ''));
  return cmds.map(cmd => {
    // SD-WAN was renamed from virtual-wan-link in FortiOS 6.4+
    if (major < 6.4 && cmd === 'show system sdwan') {
      return 'show system virtual-wan-link';
    }
    return cmd;
  });
}

function saveCommandResult() {
  clearCommandTimeout();
  if (!currentCmd) return;

  let output = currentOutput.replace(/\r+\n/g, '\n').replace(/\r/g, '');
  const lines = output.split('\n');

  // Remove first line (echo of command)
  if (lines.length > 0) lines.shift();

  // Remove trailing prompt lines
  if (hostname) {
    const promptRe = new RegExp(escapeRegex(hostname) + '.*[#$]\\s*$');
    while (lines.length > 0 && promptRe.test(lines[lines.length - 1])) {
      lines.pop();
    }
  }

  const cleanOutput = lines.join('\n').trim();

  // Extract metadata from bootstrap command
  if (currentCmd.cmd === BOOTSTRAP_CMD && !fortiosVersion) {
    const vMatch = cleanOutput.match(/Version\s*:\s*(\S+)\s+(v[\d.]+)[,\s]/);
    if (vMatch) {
      fortiosModel = vMatch[1];
      fortiosVersion = vMatch[2];
      console.log(`[DETECT] Model: ${fortiosModel}, FortiOS: ${fortiosVersion}`);
      // Adapt remaining commands for this version
      const remaining = cmdQueue.map(c => c.cmd);
      const adapted = adaptCommandsForVersion(remaining);
      for (let i = 0; i < cmdQueue.length; i++) {
        cmdQueue[i].cmd = adapted[i];
      }
    }
    const sMatch = cleanOutput.match(/Serial-Number\s*:\s*(\S+)/);
    if (sMatch) {
      fortiosSerial = sMatch[1];
      console.log(`[DETECT] Serial: ${fortiosSerial}`);
    }
  }

  commandResults.push({
    command: currentCmd.cmd,
    output: cleanOutput,
    group: currentCmd.group,
  });

  currentCmd = null;
  currentOutput = '';
}

function writeOutputFiles() {
  // Group results by category and write one file per group
  let totalBytes = 0;
  let fileCount = 0;

  for (const [group] of Object.entries(GROUPS)) {
    const parts = [];
    // Collect all results for this group (handles adapted command names)
    const groupResults = commandResults.filter(r => r.group === group);
    for (const r of groupResults) {
      if (r.output) {
        parts.push(`### ${r.command}\n${r.output}`);
      }
    }
    if (parts.length > 0) {
      const content = parts.join('\n\n');
      const filePath = `${OUT_DIR}/${group}.txt`;
      fs.writeFileSync(filePath, content, 'utf8');
      totalBytes += content.length;
      fileCount++;
      console.log(`  OK  ${group}.txt (${content.length} bytes, ${parts.length} section(s))`);
    } else {
      console.log(`  SKIP ${group}.txt (aucune donnee)`);
    }
  }

  // Write metadata.json
  const metadata = {
    hostname: hostname || null,
    model: fortiosModel || null,
    firmware: fortiosVersion || null,
    serial: fortiosSerial || null,
    ip: IP,
    port: PORT,
    username: USERNAME,
    vdom: vdomName || null,
    collectedAt: new Date().toISOString(),
    commandsExecuted: commandResults.length,
    commandsFailed: COMMANDS.length - commandResults.length,
    groups: Object.keys(GROUPS),
  };
  fs.writeFileSync(`${OUT_DIR}/metadata.json`, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`  OK  metadata.json`);

  console.log(`\nCollecte terminee -> ${OUT_DIR}/ (${fileCount} fichiers + metadata.json, ${totalBytes} bytes total)`);
}

function onData(data) {
  const chunk = data.toString();
  recentData += chunk;
  process.stdout.write(chunk);

  // Keep recentData bounded
  if (recentData.length > 3000) recentData = recentData.slice(-3000);

  // Accumulate output for current command
  if (state === 'sending' && currentCmd) {
    currentOutput += chunk;
  }

  // State: waiting for initial prompt to detect hostname
  if (state === 'waiting_prompt') {
    // FortiGate prompt: "HOSTNAME # " or "HOSTNAME (vdom) # "
    const promptMatch = recentData.match(/\n?([A-Za-z0-9_\-\.]+)(?:\s+\([^)]+\))?\s+[#$]\s*$/);
    if (promptMatch) {
      hostname = promptMatch[1];
      console.log(`\n[DETECT] Hostname: ${hostname}`);
      recentData = '';

      if (vdomName) {
        state = 'entering_vdom';
        console.log(`[VDOM] Entering VDOM: ${vdomName}`);
        stream.write('config vdom\n');
        setTimeout(() => {
          stream.write(`edit ${vdomName}\n`);
        }, 1000);
      } else {
        state = 'sending';
        startExecution();
      }
    }
    return;
  }

  // State: entering VDOM, wait for vdom prompt
  if (state === 'entering_vdom') {
    const vdomPromptRe = new RegExp(
      escapeRegex(hostname) + '\\s+\\(' + escapeRegex(vdomName) + '\\)\\s+[#$]\\s*$'
    );
    if (vdomPromptRe.test(recentData.trimEnd())) {
      recentData = '';
      state = 'sending';
      startExecution();
    }
    return;
  }

  // State: sending commands — detect prompt to know command completed
  if (state === 'sending' && !cmdLocked) {
    const promptRe = new RegExp(
      escapeRegex(hostname) + '(?:\\s+\\([^)]+\\))?\\s+[#$]\\s*$'
    );
    if (promptRe.test(recentData.trimEnd())) {
      cmdLocked = true;
      recentData = '';

      if (currentCmd) {
        saveCommandResult();
      }

      setTimeout(() => {
        cmdLocked = false;
        sendNextCommand();
      }, 150);
    }
  }
}

function startExecution() {
  // Build the command queue
  cmdQueue = [];
  for (const cmd of COMMANDS) {
    cmdQueue.push({ cmd, group: CMD_TO_GROUP[cmd] || 'system' });
  }
  console.log(`\n[COLLECT] Envoi de ${cmdQueue.length} commandes...`);
  sendNextCommand();
}

function sendNextCommand() {
  clearCommandTimeout();

  if (cmdQueue.length === 0) {
    state = 'done';
    finishSession();
    return;
  }

  currentCmd = cmdQueue.shift();
  currentOutput = '';

  const total = commandResults.length + cmdQueue.length + 1;
  const current = commandResults.length + 1;
  console.log(`  [${current}/${total}] ${currentCmd.cmd}`);

  stream.write(currentCmd.cmd + '\n');
  resetCommandTimeout();
}

function finishSession() {
  writeOutputFiles();
  if (vdomName) {
    stream.write('end\n');
    setTimeout(() => stream.write('exit\n'), 1000);
  } else {
    stream.write('exit\n');
  }
}

// --- SSH connection ---
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connecte. Ouverture du shell...');
  conn.shell((err, s) => {
    if (err) { console.error('Shell error:', err.message); conn.end(); return; }
    stream = s;

    stream.on('data', onData);
    stream.stderr.on('data', (data) => {
      if (state === 'sending' && currentCmd) {
        currentOutput += data.toString();
      }
    });

    stream.on('close', () => {
      clearCommandTimeout();
      conn.end();
    });

    // Fallback: if no prompt detected after 10s, send newline
    setTimeout(() => {
      if (state === 'waiting_prompt') {
        console.log('[WARN] No prompt detected after 10s, sending newline...');
        stream.write('\n');
      }
    }, 10000);
  });

}).on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
  console.log('[AUTH] Keyboard-interactive -> envoi du mot de passe');
  finish([PASSWORD]);

}).on('error', (err) => {
  console.error('Erreur SSH:', err.message);
  if (err.message.includes('ECONNREFUSED')) {
    console.error('-> SSH non disponible. Verifier que le service SSH est active sur le FortiGate.');
  }
  if (err.message.includes('Timed out')) {
    console.error('-> Timeout de connexion. Verifier le port SSH et la connectivite reseau.');
  }
  if (err.message.includes('authentication')) {
    console.error('-> Echec authentification. Verifier le nom d\'utilisateur et le mot de passe.');
  }
  process.exit(1);

}).connect({
  host: IP,
  port: PORT,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 30000,
  tryKeyboard: true,
});
