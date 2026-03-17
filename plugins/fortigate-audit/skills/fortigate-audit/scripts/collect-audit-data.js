/**
 * FortiGate Audit Data Collector
 * Connects via SSH and collects all config data needed for CIS/ANSSI audit.
 *
 * Usage:
 *   node collect-audit-data.js <host> <port> <username> <password> <output_dir>
 *
 * Output: One JSON file (audit-data.json) with all parsed command results,
 *         plus raw_output.txt for reference.
 *
 * Requirements: ssh2 (npm install ssh2)
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = process.argv[2];
const PORT = parseInt(process.argv[3], 10);
const USER = process.argv[4];
const PASS = process.argv[5];
const OUTPUT_DIR = process.argv[6] || '.';

if (!HOST || !PORT || !USER || !PASS) {
  console.error('Usage: node collect-audit-data.js <host> <port> <user> <password> [output_dir]');
  process.exit(1);
}

// All FortiOS commands needed for the 40+ CIS/ANSSI controls
const COMMANDS = [
  { name: 'system_status',           cmd: 'get system status' },
  { name: 'system_global',           cmd: 'get system global' },
  { name: 'system_dns',              cmd: 'get system dns' },
  { name: 'system_ntp',              cmd: 'get system ntp' },
  { name: 'system_admin',            cmd: 'show full-configuration system admin' },
  { name: 'system_password_policy',  cmd: 'get system password-policy' },
  { name: 'system_ha',               cmd: 'get system ha' },
  { name: 'system_zone',             cmd: 'show system zone' },
  { name: 'system_interface',        cmd: 'show full-configuration system interface' },
  { name: 'firewall_policy',         cmd: 'show firewall policy' },
  { name: 'ips_sensor',              cmd: 'show ips sensor' },
  { name: 'antivirus_profile',       cmd: 'show antivirus profile' },
  { name: 'vpn_ssl_settings',        cmd: 'show vpn ssl settings' },
  { name: 'vpn_ipsec_phase1',        cmd: 'show vpn ipsec phase1-interface' },
  { name: 'vpn_ipsec_phase2',        cmd: 'show vpn ipsec phase2-interface' },
  { name: 'log_eventfilter',         cmd: 'show log eventfilter' },
  { name: 'log_syslogd',             cmd: 'show log syslogd setting' },
  { name: 'log_fortianalyzer',       cmd: 'show log fortianalyzer setting' },
  { name: 'snmp_community',          cmd: 'show system snmp community' },
  { name: 'snmp_user',               cmd: 'show system snmp user' },
  { name: 'firewall_local_in_policy',cmd: 'show firewall local-in-policy' },
  { name: 'dnsfilter_profile',       cmd: 'show dnsfilter profile' },
  { name: 'system_autoupdate',       cmd: 'get system auto-update status' },
  { name: 'webfilter_profile',       cmd: 'show webfilter profile' },
  { name: 'ssl_ssh_profile',         cmd: 'show firewall ssl-ssh-profile' },
];

/**
 * Runs all commands in a single shell session.
 * FortiOS doesn't support `echo`, so we send commands sequentially
 * with a unique delimiter comment between each.
 * We parse the output by splitting on the command prompts.
 */
function runShell(conn, commands) {
  return new Promise((resolve, reject) => {
    conn.shell((err, stream) => {
      if (err) return reject(err);
      let fullOutput = '';
      stream.on('data', d => { fullOutput += d.toString(); });
      stream.stderr.on('data', d => { fullOutput += d.toString(); });
      stream.on('close', () => resolve(fullOutput));

      // Disable paging first, then send all commands
      let cmdString = 'config system console\nset output standard\nend\n';
      for (const c of commands) {
        cmdString += `${c.cmd}\n`;
      }
      cmdString += 'exit\n';

      // Small delay to let the shell initialize before writing
      setTimeout(() => stream.write(cmdString), 500);
    });
  });
}

/**
 * Parse the raw shell output into per-command sections.
 * Strategy: find each command string in the output, then capture
 * everything between that command and the next command (or end).
 */
function parseOutput(rawOutput, commands) {
  const results = {};

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i].cmd;
    const name = commands[i].name;
    const nextCmd = (i < commands.length - 1) ? commands[i + 1].cmd : null;

    // Find the command in the output
    const cmdIdx = rawOutput.indexOf(cmd);
    if (cmdIdx === -1) {
      results[name] = '';
      continue;
    }

    const startIdx = cmdIdx + cmd.length;
    let endIdx;

    if (nextCmd) {
      endIdx = rawOutput.indexOf(nextCmd, startIdx);
      if (endIdx === -1) endIdx = rawOutput.length;
    } else {
      endIdx = rawOutput.length;
    }

    // Clean up: remove leading/trailing whitespace and prompt lines
    let section = rawOutput.substring(startIdx, endIdx).trim();
    // Remove trailing prompt line (hostname # or hostname $)
    section = section.replace(/\n[^\n]*[#$]\s*$/, '').trim();
    results[name] = section;
  }

  return results;
}

async function main() {
  console.log(`[${new Date().toISOString()}] FortiGate Audit Data Collector`);
  console.log(`Target: ${HOST}:${PORT} (user: ${USER})`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      console.log(`[${new Date().toISOString()}] SSH connected`);

      try {
        console.log(`Collecting ${COMMANDS.length} commands...`);
        const rawOutput = await runShell(conn, COMMANDS);

        // Save raw output
        const rawPath = path.join(OUTPUT_DIR, 'raw_output.txt');
        fs.writeFileSync(rawPath, rawOutput);
        console.log(`Raw output: ${rawPath} (${rawOutput.length} bytes)`);

        // Parse per-command outputs
        const results = parseOutput(rawOutput, COMMANDS);

        // Save structured JSON
        const jsonPath = path.join(OUTPUT_DIR, 'audit-data.json');
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        console.log(`Parsed data: ${jsonPath}`);

        // Summary
        const collected = Object.entries(results).filter(([, v]) => v.length > 10).length;
        console.log(`[${new Date().toISOString()}] Done: ${collected}/${COMMANDS.length} commands returned data`);

        // Auto-extract audit fields for compact analysis
        try {
          const { extract } = require(path.join(__dirname, 'extract-audit-fields.js'));
          const extractPath = path.join(OUTPUT_DIR, 'audit-extract.json');
          extract(jsonPath, extractPath);
        } catch (extractErr) {
          console.error(`Warning: extraction failed: ${extractErr.message}`);
          console.error('Run extract-audit-fields.js manually after collection.');
        }

        conn.end();
        resolve(results);
      } catch (e) {
        console.error('Collection error:', e.message);
        conn.end();
        reject(e);
      }
    }).on('error', err => {
      console.error(`SSH error: ${err.message}`);
      reject(err);
    }).connect({
      host: HOST,
      port: PORT,
      username: USER,
      password: PASS,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      algorithms: {
        kex: [
          'curve25519-sha256@libssh.org',
          'curve25519-sha256',
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1'
        ],
        serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-rsa'],
        cipher: ['aes256-ctr', 'aes128-ctr', 'aes256-gcm@openssh.com', 'aes128-gcm@openssh.com'],
        hmac: ['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-512-etm@openssh.com', 'hmac-sha2-256', 'hmac-sha2-512']
      }
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(`FATAL: ${err.message}`);
    process.exit(1);
  });
