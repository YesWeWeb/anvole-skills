/**
 * FortiGate Audit Field Extractor
 *
 * Reads the large audit-data.json (200KB+) produced by collect-audit-data.js
 * and extracts only the fields needed for the 50 CIS/ANSSI controls into a
 * compact audit-extract.json (~5-10KB) that Claude can read in one shot.
 *
 * Usage:
 *   node extract-audit-fields.js <audit-data.json> <audit-extract.json>
 *
 * Can also be required as a module:
 *   const { extract } = require('./extract-audit-fields.js');
 *   extract('audit-data.json', 'audit-extract.json');
 */

const fs = require('fs');
const path = require('path');

// --- Parsers for FortiOS text output ---

/**
 * Parse "key : value" lines from FortiOS `get` command output.
 * Returns an object { key: value, ... }
 */
function parseKeyValue(text) {
  if (!text) return {};
  const result = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (m) {
      result[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return result;
}

/**
 * Parse FortiOS `show` config blocks into array of objects.
 * Each "edit" block becomes one object with its "set" fields.
 * Handles nested config/end blocks (e.g., "config entries" inside sensors).
 */
function parseConfigBlocks(text) {
  if (!text) return [];
  const blocks = [];
  let current = null;
  let nestedDepth = 0;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip nested config blocks entirely
    if (nestedDepth > 0) {
      if (trimmed === 'end') nestedDepth--;
      continue;
    }

    const editMatch = trimmed.match(/^edit\s+(?:"([^"]+)"|(\S+))/);
    if (editMatch) {
      current = { _id: editMatch[1] || editMatch[2] };
      continue;
    }

    if (trimmed === 'next' && current) {
      blocks.push(current);
      current = null;
      continue;
    }

    if (current) {
      // Detect nested config block (e.g., "config entries", "config hosts")
      if (trimmed.startsWith('config ')) {
        nestedDepth = 1;
        continue;
      }

      const setMatch = trimmed.match(/^set\s+([\w-]+)\s+(.*)/);
      if (setMatch) {
        let val = setMatch[2].trim();
        // Remove surrounding quotes
        val = val.replace(/^"(.*)"$/, '$1');
        current[setMatch[1]] = val;
      }
      const unsetMatch = trimmed.match(/^unset\s+([\w-]+)/);
      if (unsetMatch) {
        current[unsetMatch[1]] = null;
      }
    }
  }
  // Catch last block if no trailing "next"
  if (current) blocks.push(current);

  return blocks;
}

/**
 * Parse firewall policies — needs special handling for nested config blocks
 * (like "config authentication-rule") which we skip.
 */
function parsePolicies(text) {
  if (!text) return [];
  const policies = [];
  let current = null;
  let nestedDepth = 0;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    // Track nested config blocks (skip them)
    if (nestedDepth > 0) {
      if (trimmed === 'end') nestedDepth--;
      continue;
    }

    // Top-level edit = new policy
    const editMatch = trimmed.match(/^edit\s+(\d+)/);
    if (editMatch) {
      current = { id: editMatch[1] };
      continue;
    }

    if (trimmed === 'next' && current) {
      policies.push(current);
      current = null;
      continue;
    }

    if (current) {
      // Detect nested config block
      if (trimmed.startsWith('config ') && trimmed !== 'config firewall policy') {
        nestedDepth = 1;
        continue;
      }
      const setMatch = trimmed.match(/^set\s+([\w-]+)\s+(.*)/);
      if (setMatch) {
        let val = setMatch[2].trim();
        val = val.replace(/^"(.*)"$/, '$1');
        current[setMatch[1]] = val;
      }
    }
  }
  if (current) policies.push(current);
  return policies;
}

/**
 * Extract the specific global fields we need from the key-value output.
 */
function extractGlobalFields(kvData) {
  const fields = [
    'pre-login-banner', 'post-login-banner', 'timezone', 'hostname',
    'admin-telnet', 'admintimeout', 'admin-lockout-threshold', 'admin-lockout-duration',
    'ssl-static-key-ciphers', 'strong-crypto', 'admin-https-ssl-versions',
    'cli-audit-log', 'log-single-cpu-high', 'gui-display-hostname',
    'admin-server-cert', 'private-data-encryption', 'admin-reset-button',
    'admin-console-timeout', 'login-timestamp', 'admin-ssh-v1',
    'multi-factor-authentication', 'ssh-enc-algo', 'ssh-mac-algo',
    'auto-install-config', 'auto-install-image', 'admin-telnet-port',
    'ssl-min-proto-version', 'admin-ssh-port', 'admin-sport', 'admin-port'
  ];
  const result = {};
  for (const f of fields) {
    result[f] = kvData[f] !== undefined ? kvData[f] : null;
  }
  return result;
}

/**
 * Extract device info from system_status text.
 */
function extractDevice(statusText) {
  const kv = parseKeyValue(statusText);
  const device = {
    hostname: kv['Hostname'] || null,
    serial: kv['Serial-Number'] || null,
    firmware: null,
    model: null,
    ha_mode: kv['Current HA mode'] || null
  };

  // Parse version line: "Version: FortiGate-60F v7.4.11,build2878,..."
  if (statusText) {
    const versionMatch = statusText.match(/Version:\s*([\w-]+)\s+(v[\d.]+[^\r\n]*)/);
    if (versionMatch) {
      device.model = versionMatch[1];
      device.firmware = versionMatch[2].split(',').slice(0, 2).join(',');
    }
  }
  return device;
}

/**
 * Analyze policies for audit-relevant summaries.
 */
function analyzePolicies(policiesRaw) {
  const policies = parsePolicies(policiesRaw);
  const total = policies.length;
  let disabledCount = 0;
  const withServiceAll = [];
  const withoutLogtraffic = [];
  const anyAnyAnyAccept = [];
  const withoutUtm = [];
  let lastPolicyId = null;

  for (const p of policies) {
    lastPolicyId = p.id;
    const action = p.action || 'deny'; // FortiOS default is deny if not set

    if (p.status === 'disable') {
      disabledCount++;
      continue; // skip disabled policies for other checks
    }

    if (action === 'accept') {
      // Service ALL check
      if (p.service && /\bALL\b/.test(p.service) && !/\bALL_ICMP\b/.test(p.service)) {
        withServiceAll.push(p.id);
      }

      // any/any/any/accept check (A.6)
      const srcAll = p.srcaddr && /\ball\b/i.test(p.srcaddr);
      const dstAll = p.dstaddr && /\ball\b/i.test(p.dstaddr);
      const svcAll = p.service && /\bALL\b/.test(p.service) && !/\bALL_ICMP\b/.test(p.service);
      if (srcAll && dstAll && svcAll) {
        anyAnyAnyAccept.push(p.id);
      }

      // UTM check (A.8) — accept rules without utm-status or security profiles
      if (!p['utm-status'] || p['utm-status'] !== 'enable') {
        // Also check if individual profiles are set
        const hasProfile = p['av-profile'] || p['ips-sensor'] || p['webfilter-profile'] ||
                           p['application-list'] || p['ssl-ssh-profile'] || p['profile-group'];
        if (!hasProfile) {
          withoutUtm.push(p.id);
        }
      }
    }

    // Logging check — all active policies should log
    if (!p.logtraffic || p.logtraffic === 'disable') {
      withoutLogtraffic.push(p.id);
    }
  }

  return {
    total,
    disabled_count: disabledCount,
    with_service_all: withServiceAll,
    without_logtraffic: withoutLogtraffic,
    any_any_any_accept: anyAnyAnyAccept,
    without_utm: withoutUtm,
    last_policy_id: lastPolicyId
  };
}

/**
 * Extract WAN interfaces and their allowaccess settings.
 */
function extractWanInterfaces(interfaceText) {
  if (!interfaceText) return [];
  const blocks = parseConfigBlocks(interfaceText);
  const wanInterfaces = [];

  for (const b of blocks) {
    const name = (b._id || '').toLowerCase();
    // Match WAN interfaces: wan*, Internet, sdwan, or type=physical with role=wan
    if (name.includes('wan') || name === 'internet' || name.includes('sdwan') ||
        (b.role && b.role === 'wan')) {
      wanInterfaces.push({
        name: b._id,
        allowaccess: b.allowaccess || '',
        type: b.type || '',
        role: b.role || ''
      });
    }
  }
  return wanInterfaces;
}

/**
 * Extract admin accounts summary.
 */
function extractAdmins(adminText) {
  const blocks = parseConfigBlocks(adminText);
  return blocks.map(b => ({
    name: b._id,
    accprofile: b.accprofile || null,
    trusthost1: b.trusthost1 || null,
    'two-factor': b['two-factor'] || 'disable',
    'remote-auth': b['remote-auth'] || 'disable'
  }));
}

/**
 * Extract SNMP summary.
 */
function extractSnmp(communityText, userText) {
  const communities = parseConfigBlocks(communityText);
  const users = parseConfigBlocks(userText);
  return {
    communities_count: communities.length,
    communities: communities.map(c => ({ id: c._id, name: c.name || c._id })),
    users: users.map(u => ({
      name: u._id,
      'notify-hosts': u['notify-hosts'] || null,
      'security-level': u['security-level'] || null
    }))
  };
}

/**
 * Extract zone info.
 */
function extractZones(zoneText) {
  const blocks = parseConfigBlocks(zoneText);
  return blocks.map(z => ({
    name: z._id,
    intrazone: z.intrazone || 'deny', // FortiOS default is deny
    interface: z.interface || ''
  }));
}

/**
 * Extract logging config.
 */
function extractLog(syslogdText, fortianalyzerText, eventfilterText) {
  const syslogd = parseKeyValue(syslogdText);
  const faz = parseKeyValue(fortianalyzerText);

  // Check if sections are empty (just "config ... end" with nothing)
  const syslogdEmpty = !syslogdText || syslogdText.replace(/config\s+\S+.*\r?\nend/g, '').trim().length < 10;
  const fazEmpty = !fortianalyzerText || fortianalyzerText.replace(/config\s+\S+.*\r?\nend/g, '').trim().length < 10;
  const eventfilterEmpty = !eventfilterText || eventfilterText.replace(/config\s+\S+.*\r?\nend/g, '').trim().length < 10;

  return {
    syslogd_status: syslogdEmpty ? null : (syslogd.status || 'enable'),
    syslogd_server: syslogd.server || null,
    fortianalyzer_status: fazEmpty ? null : (faz.status || 'enable'),
    fortianalyzer_server: faz.server || null,
    fortianalyzer_enc: faz['enc-algorithm'] || null,
    eventfilter_empty: eventfilterEmpty
  };
}

/**
 * Extract VPN settings.
 */
function extractVpn(sslText, phase1Text, phase2Text) {
  const sslBlocks = parseConfigBlocks(sslText);
  const sslKv = {};
  // SSL settings is a single block, parse set lines directly
  if (sslText) {
    const lines = sslText.split(/\r?\n/);
    for (const line of lines) {
      const m = line.trim().match(/^set\s+([\w-]+)\s+(.*)/);
      if (m) sslKv[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  const phase1 = parseConfigBlocks(phase1Text).map(p => ({
    name: p._id,
    proposal: p.proposal || null,
    dhgrp: p.dhgrp || null,
    'ike-version': p['ike-version'] || null
  }));

  const phase2 = parseConfigBlocks(phase2Text).map(p => ({
    name: p._id,
    proposal: p.proposal || null,
    pfs: p.pfs || null
  }));

  return {
    ssl_servercert: sslKv.servercert || null,
    ssl_min_proto_ver: sslKv['ssl-min-proto-ver'] || null,
    ssl_banned_cipher: sslKv['banned-cipher'] || null,
    ipsec_phase1: phase1,
    ipsec_phase2: phase2
  };
}

/**
 * Extract security profiles summary.
 */
function extractSecurityProfiles(ipsText, avText, dnsfilterText, sslSshText, webfilterText) {
  // IPS — scan-botnet-connections (top-level sensor names)
  const ipsSensors = parseConfigBlocks(ipsText);
  const ipsBotnet = ipsSensors.map(s => ({
    name: s._id,
    'scan-botnet-connections': s['scan-botnet-connections'] || null
  }));

  // Antivirus — machine-learning-detection, grayware
  const avProfiles = parseConfigBlocks(avText);
  const avSummary = avProfiles.map(p => ({
    name: p._id,
    'machine-learning-detection': p['machine-learning-detection'] || null,
    grayware: p.grayware || null
  }));

  // DNS filter — log-all-domain
  const dnsProfiles = parseConfigBlocks(dnsfilterText);
  const dnsSummary = dnsProfiles.map(p => ({
    name: p._id,
    'log-all-domain': p['log-all-domain'] || null
  }));

  // SSL/SSH — deep inspection
  const sslProfiles = parseConfigBlocks(sslSshText);
  const hasDeepInspection = sslProfiles.some(p =>
    (p._id && p._id.toLowerCase().includes('deep')) ||
    (p['inspection-mode'] && p['inspection-mode'] === 'deep')
  );

  // Web filter — configured
  const webProfiles = parseConfigBlocks(webfilterText);

  return {
    ips_sensors: ipsBotnet,
    av_profiles: avSummary,
    dnsfilter_profiles: dnsSummary,
    ssl_deep_inspection: hasDeepInspection,
    ssl_profiles: sslProfiles.map(p => p._id),
    webfilter_configured: webProfiles.length > 0,
    webfilter_profiles: webProfiles.map(p => p._id)
  };
}

/**
 * Extract auto-update status.
 */
function extractAutoupdate(text) {
  if (!text) return { scheduled: null, virus_definitions: null, ips_definitions: null };
  const kv = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([\w\s]+?):\s+(enable|disable)/i);
    if (m) kv[m[1].trim().toLowerCase()] = m[2].toLowerCase();
  }
  return {
    scheduled: kv['scheduled update'] || null,
    virus_definitions: kv['virus definitions update'] || null,
    ips_definitions: kv['ips definitions update'] || null
  };
}

// --- Main extraction ---

function extract(inputPath, outputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const globalKv = parseKeyValue(raw.system_global || '');

  const result = {
    _meta: {
      source: path.basename(inputPath),
      extracted_at: new Date().toISOString(),
      description: 'Compact extract for CIS/ANSSI audit — 50 controls'
    },
    device: extractDevice(raw.system_status || ''),
    system_global: extractGlobalFields(globalKv),
    dns: {
      primary: parseKeyValue(raw.system_dns || '').primary || null,
      secondary: parseKeyValue(raw.system_dns || '').secondary || null,
      protocol: parseKeyValue(raw.system_dns || '').protocol || null
    },
    ntp: {
      ntpsync: parseKeyValue(raw.system_ntp || '').ntpsync || null,
      type: parseKeyValue(raw.system_ntp || '').type || null
    },
    password_policy: {
      status: parseKeyValue(raw.system_password_policy || '').status || null,
      'min-length': parseKeyValue(raw.system_password_policy || '')['min-length'] || null
    },
    ha: {
      mode: parseKeyValue(raw.system_ha || '').mode || null,
      monitor: parseKeyValue(raw.system_ha || '').monitor || ''
    },
    zones: extractZones(raw.system_zone || ''),
    admins: extractAdmins(raw.system_admin || ''),
    wan_interfaces: extractWanInterfaces(raw.system_interface || ''),
    snmp: extractSnmp(raw.snmp_community || '', raw.snmp_user || ''),
    local_in_policy_count: parseConfigBlocks(raw.firewall_local_in_policy || '').length,
    policies: analyzePolicies(raw.firewall_policy || ''),
    log: extractLog(raw.log_syslogd || '', raw.log_fortianalyzer || '', raw.log_eventfilter || ''),
    vpn: extractVpn(raw.vpn_ssl_settings || '', raw.vpn_ipsec_phase1 || '', raw.vpn_ipsec_phase2 || ''),
    security_profiles: extractSecurityProfiles(
      raw.ips_sensor || '',
      raw.antivirus_profile || '',
      raw.dnsfilter_profile || '',
      raw.ssl_ssh_profile || '',
      raw.webfilter_profile || ''
    ),
    autoupdate: extractAutoupdate(raw.system_autoupdate || '')
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`Extracted: ${outputPath} (${sizeKb} KB)`);

  return result;
}

// CLI mode
if (require.main === module) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    console.error('Usage: node extract-audit-fields.js <audit-data.json> <audit-extract.json>');
    process.exit(1);
  }

  try {
    extract(inputPath, outputPath);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}

// Module export
module.exports = { extract };
