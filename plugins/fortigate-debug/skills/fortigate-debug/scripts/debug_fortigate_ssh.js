/**
 * Debug FortiGate — SSH avec detection de prompt (state machine)
 *
 * Usage : node debug_fortigate_ssh.js <IP> <PORT> <PASSWORD> [OUT_DIR] [USERNAME] --group <categories> [--deep] [--vdom <name>] [--cmd-timeout <ms>] [--with-log-test] [--skip-existing]
 *
 * Exemples :
 *   node debug_fortigate_ssh.js 10.10.90.251 48022 "pass" C:/tmp/fortigate_debug admin --group vpn-ipsec,performance
 *   node debug_fortigate_ssh.js 10.10.90.251 48022 "pass" C:/tmp/fortigate_debug admin --group network --deep
 *   node debug_fortigate_ssh.js 10.10.90.251 48022 "pass" C:/tmp/fortigate_debug admin --group ha --vdom root
 *
 * Les commandes "live debug" (diagnose debug enable, sniffer, debug flow) ne sont
 * JAMAIS executees par ce script — trop dangereux a automatiser.
 *
 * Produit dans OUT_DIR :
 *   triage.txt     — sortie des commandes triage (structuree par commande)
 *   deep.txt       — sortie des commandes deep-dive (si --deep)
 *   commands.json  — manifeste des commandes executees + metadata
 */

const { Client } = require('ssh2');
const fs = require('fs');

// --- Parse arguments ---
const args = process.argv.slice(2);
const IP       = args[0];
const PORT     = parseInt(args[1], 10);
const PASSWORD = args[2];
const OUT_DIR  = args[3] || 'C:/tmp/fortigate_debug';
const USERNAME = args[4] || 'admin';

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}
const groupArg    = getFlag('--group');
const vdomName    = getFlag('--vdom');
const deepMode    = args.includes('--deep');
const withLogTest = args.includes('--with-log-test');
const skipExisting = args.includes('--skip-existing');
const CMD_TIMEOUT = parseInt(getFlag('--cmd-timeout') || '30000', 10);

// --delay is deprecated (prompt-based detection), accept silently
if (args.includes('--delay')) {
  console.log('[WARN] --delay is deprecated (prompt-based detection now). Ignoring.');
}

if (!IP || !PORT || !PASSWORD || !groupArg) {
  console.error('Usage: node debug_fortigate_ssh.js <IP> <PORT> <PASSWORD> [OUT_DIR] [USERNAME] --group <categories> [--deep] [--vdom <name>] [--cmd-timeout <ms>] [--with-log-test] [--skip-existing]');
  console.error('Categories: vpn-ipsec, vpn-ssl, network, auth, performance, ha, security, sdwan, services, admin, wireless, managed-switches');
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// --- Command groups ---
const COMMAND_GROUPS = {
  'vpn-ipsec': {
    triage: [
      'get vpn ipsec tunnel summary',
      'get vpn ipsec tunnel details',
      'diagnose vpn ike gateway list',
      'diagnose vpn tunnel list',
      'get router info routing-table all',
      'get vpn ipsec stats tunnel',
    ],
    deep: [
      'diagnose vpn ike status',
      'diagnose vpn ike counts',
      'diagnose vpn ike errors',
      'diagnose vpn ike stats',
      'diagnose vpn ike crypto',
      'diagnose vpn ike routes',
      'diagnose vpn ipsec status',
      'get vpn ipsec stats crypto',
      'show vpn ipsec phase1-interface',
      'show vpn ipsec phase2-interface',
    ],
  },
  'vpn-ssl': {
    triage: [
      'get vpn ssl monitor',
      'diagnose vpn ssl list',
      'show vpn ssl settings',
      'get system performance status',
      'diagnose vpn ssl statistics',
    ],
    deep: [
      'diagnose vpn ssl mux-stat',
      'execute vpn sslvpn list',
      'show user group',
      'show user ldap',
      'show user radius',
      'diagnose firewall auth list',
    ],
  },
  'network': {
    triage: [
      'get system interface physical',
      'get router info routing-table all',
      'get system arp',
      'get system session-info statistics',
      'diagnose ip address list',
      'diagnose netlink aggregate list',
    ],
    deep: [
      'get router info kernel',
      'diagnose ip route list',
      'diagnose ip rtcache list',
      'get system interface transceiver',
      'diagnose sys gre list',
      'diagnose sys waninfo',
      'get firewall proute',
    ],
  },
  'auth': {
    triage: [
      'diagnose firewall auth list',
      'diagnose debug authd fsso server-status',
      'diagnose debug authd fsso list',
      'get user fsso',
    ],
    deep: [
      'show user ldap',
      'show user radius',
      'show user fsso-polling',
      'show user group',
      'show user saml',
      'diagnose debug fsso-polling detail',
      'diagnose debug fsso-polling summary',
      'diagnose wad user list',
    ],
  },
  'performance': {
    triage: [
      'get system performance status',
      'get system status',
      'diagnose sys top 2 20 1',
      'get system session-info statistics',
      'execute sensor list',
      'diagnose hardware sysinfo conserve',
    ],
    deep: [
      'diagnose sys session stat',
      'diagnose sys session full-stat',
      'diagnose sys session exp-stat',
      'diagnose hardware sysinfo memory',
      'get hardware memory',
      'diagnose sys flash list',
      'diagnose hardware deviceinfo disk',
      'diagnose firewall packet distribution',
      'diagnose autoupdate status',
    ],
  },
  'ha': {
    triage: [
      'get system ha status',
      'diagnose sys ha status',
      'diagnose sys ha checksum cluster',
      'diagnose sys ha dump-by group',
    ],
    deep: [
      'diagnose sys ha history read',
      'get system interface physical',
      'diagnose sys ha checksum recalculate',
    ],
  },
  'security': {
    triage: [
      'diagnose test application ipsmonitor 1',
      'diagnose ips session list',
      'diagnose webfilter fortiguard statistics',
      'diagnose debug rating',
      'diagnose autoupdate versions',
    ],
    deep: [
      'show ips sensor',
      'show webfilter profile',
      'diagnose test application dnsproxy 2',
      'diagnose test application dnsproxy 7',
      'diagnose test application dnsproxy 10',
      'diagnose test application dnsproxy 15',
    ],
  },
  'sdwan': {
    triage: [
      'diagnose sys sdwan health-check',
      'diagnose sys sdwan member',
      'diagnose sys sdwan service4',
      'diagnose sys sdwan service6',
      'get router info routing-table all',
      'diagnose firewall proute list',
    ],
    deep: [
      'show system sdwan',
      'diagnose sys link-monitor status',
    ],
  },
  'services': {
    triage: [
      'execute dhcp lease-list',
      'get system dns',
      'diagnose test application dnsproxy 2',
      'execute time',
      // 'diagnose log test' removed — generates actual logs. Use --with-log-test to opt-in.
      'get log setting',
      'diagnose sys ntp status',
    ],
    deep: [
      'show system dhcp server',
      'show system dns-database',
      'diagnose test application dnsproxy 7',
      'diagnose test application dnsproxy 6',
      'diagnose test application dnsproxy 8',
      'execute log fortianalyzer test-connectivity',
      'get log fortianalyzer setting',
      'get log fortianalyzer filter',
      'get system ntp',
      'show system snmp community',
    ],
  },
  'admin': {
    triage: [
      'get sys info admin status',
      'show system admin',
      'diagnose debug config-error-log read',
    ],
    deep: [],
  },
  'wireless': {
    triage: [
      'diagnose wireless-controller wlac -c ap-status',
      'diagnose wireless-controller wlac -c sta',
      'diagnose wireless-controller wlac -c vap',
    ],
    deep: [
      'diagnose wireless-controller wlac -d wtp',
      'diagnose wireless-controller wlac -d sta',
      'show wireless-controller wtp-profile',
      'show wireless-controller wtp',
    ],
  },
  'managed-switches': {
    triage: [
      'diagnose switch-controller switch-info mac-table',
      'diagnose switch-controller switch-info port-stats',
      'diagnose switch-controller switch-info trunk status',
      'diagnose switch-controller switch-info poe',
      'diagnose switch-controller switch-info stp',
      'diagnose switch-controller switch-info 802.1X',
      'diagnose switch-controller switch-info lldp',
    ],
    deep: [
      'diagnose switch-controller switch-info port-properties',
      'diagnose switch-controller switch-info acl-counters',
      'diagnose switch-controller switch-info dhcp-snooping',
      'diagnose switch-controller switch-info igmp-snooping',
      'diagnose switch-controller switch-info loop-guard',
      'diagnose switch-controller switch-info flapguard',
      'diagnose switch-controller switch-info modules',
    ],
  },
};

// --- Validate groups ---
const selectedGroups = groupArg.split(',').map(g => g.trim());
const unknownGroups = selectedGroups.filter(g => !COMMAND_GROUPS[g]);
if (unknownGroups.length) {
  console.error(`Unknown group(s): ${unknownGroups.join(', ')}`);
  console.error(`Available: ${Object.keys(COMMAND_GROUPS).join(', ')}`);
  process.exit(1);
}

// --- Deduplication with existing collection ---
let existingCommands = new Set();
if (skipExisting) {
  const collectDir = 'C:/tmp/fortigate_data';
  if (fs.existsSync(collectDir)) {
    const files = fs.readdirSync(collectDir).filter(f => f.endsWith('.txt'));
    for (const file of files) {
      const content = fs.readFileSync(`${collectDir}/${file}`, 'utf8');
      const matches = content.matchAll(/^### (.+)$/gm);
      for (const m of matches) existingCommands.add(m[1].trim());
    }
    if (existingCommands.size) {
      console.log(`[DEDUP] Found ${existingCommands.size} commands from existing collection, will skip duplicates`);
    }
  }
}

// --- Build command lists ---
function dedup(arr) {
  const seen = new Set();
  return arr.filter(cmd => {
    if (seen.has(cmd)) return false;
    seen.add(cmd);
    return true;
  });
}

// Bootstrap command: always run 'get system status' first for version detection
const BOOTSTRAP_CMD = 'get system status';

let triageCmds = dedup(selectedGroups.flatMap(g => COMMAND_GROUPS[g].triage));
// Ensure bootstrap is first, deduplicated
triageCmds = [BOOTSTRAP_CMD, ...triageCmds.filter(c => c !== BOOTSTRAP_CMD)];

// Opt-in: diagnose log test
if (withLogTest && selectedGroups.includes('services')) {
  triageCmds.push('diagnose log test');
}

let deepCmds = deepMode
  ? dedup(selectedGroups.flatMap(g => COMMAND_GROUPS[g].deep).filter(c => !triageCmds.includes(c)))
  : [];

// Apply dedup with existing collection
if (existingCommands.size) {
  const before = triageCmds.length + deepCmds.length;
  triageCmds = triageCmds.filter(cmd => !existingCommands.has(cmd));
  deepCmds = deepCmds.filter(cmd => !existingCommands.has(cmd));
  // Always keep bootstrap even if already collected
  if (!triageCmds.includes(BOOTSTRAP_CMD)) triageCmds.unshift(BOOTSTRAP_CMD);
  const after = triageCmds.length + deepCmds.length;
  console.log(`[DEDUP] Skipped ${before - after} already-collected commands`);
}

// Map command → group for output tagging
const cmdGroupMap = {};
for (const g of selectedGroups) {
  for (const cmd of [...COMMAND_GROUPS[g].triage, ...COMMAND_GROUPS[g].deep]) {
    if (!cmdGroupMap[cmd]) cmdGroupMap[cmd] = g;
  }
}
cmdGroupMap[BOOTSTRAP_CMD] = 'system';

console.log(`[CONFIG] Groups: ${selectedGroups.join(', ')}`);
console.log(`[CONFIG] Triage: ${triageCmds.length} commands`);
if (deepMode) console.log(`[CONFIG] Deep-dive: ${deepCmds.length} commands`);
if (vdomName) console.log(`[CONFIG] VDOM: ${vdomName}`);
console.log(`[CONFIG] Command timeout: ${CMD_TIMEOUT}ms`);

// --- State machine ---
let recentData = '';
let state = 'waiting_prompt';   // waiting_prompt | entering_vdom | sending | done
let hostname = null;
let fortiosVersion = null;
let stream = null;
let cmdLocked = false;
let commandTimeout = null;

// Command queue: [{cmd, phase, group}]
let cmdQueue = [];
// Results: [{command, output, phase, group}]
const commandResults = [];

let currentCmd = null;        // current {cmd, phase, group}
let currentOutput = '';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    if (major < 6.4 && cmd.startsWith('diagnose sys sdwan')) {
      return cmd.replace('diagnose sys sdwan', 'diagnose sys virtual-wan-link');
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

  // Extract FortiOS version from bootstrap command
  if (currentCmd.cmd === BOOTSTRAP_CMD && !fortiosVersion) {
    const vMatch = cleanOutput.match(/Version\s*:\s*\S+\s+(v[\d.]+)[,\s]/);
    if (vMatch) {
      fortiosVersion = vMatch[1];
      console.log(`[DETECT] FortiOS version: ${fortiosVersion}`);
      // Adapt deep commands now that we know the version
      if (deepMode && deepCmds.length) {
        deepCmds = adaptCommandsForVersion(deepCmds);
      }
    }
  }

  commandResults.push({
    command: currentCmd.cmd,
    output: cleanOutput,
    phase: currentCmd.phase,
    group: currentCmd.group,
  });

  currentCmd = null;
  currentOutput = '';
}

function buildOutputFile(phase) {
  const results = commandResults.filter(r => r.phase === phase);
  if (!results.length) return null;

  const headerLines = [
    `# FortiGate Debug Collection`,
    `# Timestamp: ${new Date().toISOString()}`,
    `# Target: ${IP}:${PORT} (user: ${USERNAME})`,
    `# Hostname: ${hostname || 'unknown'}`,
    `# FortiOS: ${fortiosVersion || 'unknown'}`,
    `# Groups: ${selectedGroups.join(', ')}`,
    `# Mode: ${deepMode ? 'triage + deep-dive' : 'triage only'}`,
  ];
  if (vdomName) headerLines.push(`# VDOM: ${vdomName}`);
  headerLines.push('');

  const body = results.map(r =>
    `===== COMMAND: ${r.command} =====\n[group: ${r.group}]\n${r.output}\n`
  ).join('\n');

  return headerLines.join('\n') + '\n' + body;
}

function writeOutputFiles() {
  const triageContent = buildOutputFile('triage');
  if (triageContent) {
    const p = `${OUT_DIR}/triage.txt`;
    fs.writeFileSync(p, triageContent);
    const count = commandResults.filter(r => r.phase === 'triage').length;
    console.log(`\nTriage -> ${p} (${triageContent.length} bytes, ${count} commands)`);
  }

  const deepContent = buildOutputFile('deep');
  if (deepContent) {
    const p = `${OUT_DIR}/deep.txt`;
    fs.writeFileSync(p, deepContent);
    const count = commandResults.filter(r => r.phase === 'deep').length;
    console.log(`Deep-dive -> ${p} (${deepContent.length} bytes, ${count} commands)`);
  }

  // Write final commands.json with detected info
  const manifest = {
    timestamp: new Date().toISOString(),
    target: { ip: IP, port: PORT, username: USERNAME, vdom: vdomName || null },
    hostname: hostname || null,
    fortiosVersion: fortiosVersion || null,
    groups: selectedGroups,
    deepMode,
    commandsExecuted: commandResults.map(r => ({ command: r.command, phase: r.phase, group: r.group })),
  };
  fs.writeFileSync(`${OUT_DIR}/commands.json`, JSON.stringify(manifest, null, 2));
  console.log(`Commandes -> ${OUT_DIR}/commands.json`);
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
      console.log(`[DETECT] Hostname: ${hostname}`);
      recentData = '';

      if (vdomName) {
        state = 'entering_vdom';
        console.log(`[VDOM] Entering VDOM: ${vdomName}`);
        stream.write(`config vdom\n`);
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
    // After 'edit vdom', prompt becomes "HOSTNAME (vdomname) # "
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

  // State: sending commands
  if (state === 'sending' && !cmdLocked) {
    // Build dynamic prompt regex from detected hostname
    const promptRe = new RegExp(
      escapeRegex(hostname) + '(?:\\s+\\([^)]+\\))?\\s+[#$]\\s*$'
    );
    if (promptRe.test(recentData.trimEnd())) {
      cmdLocked = true;
      recentData = '';

      // Save current command output
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
  // Build the command queue: triage first, then deep
  cmdQueue = [];
  for (const cmd of triageCmds) {
    cmdQueue.push({ cmd, phase: 'triage', group: cmdGroupMap[cmd] || 'unknown' });
  }
  if (deepMode && deepCmds.length) {
    for (const cmd of deepCmds) {
      cmdQueue.push({ cmd, phase: 'deep', group: cmdGroupMap[cmd] || 'unknown' });
    }
  }
  console.log(`\n[EXEC] Starting execution: ${cmdQueue.length} commands total`);
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

  // Log phase transitions
  const remaining = cmdQueue.length;
  const total = commandResults.length + remaining + 1;
  const current = commandResults.length + 1;
  console.log(`  [${current}/${total}] (${currentCmd.phase}) ${currentCmd.cmd}`);

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
      // Capture stderr in current command output too
      if (state === 'sending' && currentCmd) {
        currentOutput += data.toString();
      }
    });

    stream.on('close', () => {
      clearCommandTimeout();
      conn.end();
    });

    // Fallback: if no prompt detected after 10s, try sending newline
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
  process.exit(1);

}).connect({
  host: IP,
  port: PORT,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 15000,
  tryKeyboard: true,
});
