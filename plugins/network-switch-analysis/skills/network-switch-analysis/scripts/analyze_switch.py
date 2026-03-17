#!/usr/bin/env python3
"""
Switch Analyzer — Network Switch Analysis Skill
Parses CLI output from network switches (Cisco IOS, Aruba AOS-CX, Aruba ProVision, Netgear)
and produces a structured port inventory with device classification and VLAN recommendations.

Usage:
    python analyze_switch.py <file.txt>
    python analyze_switch.py <file1.txt> <file2.txt>   # multi-switch
    cat show_output.txt | python analyze_switch.py -
    python analyze_switch.py <file.txt> --vlans 10:DATA,20:VOIX,99:MGMT
    python analyze_switch.py <file.txt> --format csv

Output: Markdown report (default) or CSV
"""

import sys
import re
import json
import argparse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Import OUI lookup from sibling module
sys.path.insert(0, str(Path(__file__).parent))
from oui_lookup import lookup_oui


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class MacEntry:
    vlan: int
    mac: str
    port: str
    entry_type: str = "dynamic"  # dynamic, static


@dataclass
class LldpNeighbor:
    local_port: str
    system_name: str = ""
    system_description: str = ""
    chassis_id: str = ""
    port_id: str = ""
    capabilities_enabled: list = field(default_factory=list)
    management_ip: str = ""
    vlan_id: Optional[int] = None


@dataclass
class PortConfig:
    port: str
    description: str = ""
    mode: str = "unknown"        # access, trunk, unknown
    access_vlan: Optional[int] = None
    voice_vlan: Optional[int] = None
    trunk_vlans: list = field(default_factory=list)
    native_vlan: Optional[int] = None
    shutdown: bool = False
    portfast: bool = False


@dataclass
class PortAnalysis:
    port: str
    config: Optional[PortConfig] = None
    macs: list = field(default_factory=list)          # list of MacEntry
    lldp_neighbor: Optional[LldpNeighbor] = None
    device_type: str = "Unknown"
    device_detail: str = ""
    confidence: int = 0
    anomalies: list = field(default_factory=list)
    recommendation: str = ""


# ---------------------------------------------------------------------------
# Vendor detection
# ---------------------------------------------------------------------------

def detect_vendor(text: str) -> str:
    """Detect switch vendor/OS from CLI output text."""
    if re.search(r'Cisco IOS Software|IOS-XE|Catalyst.*Software|cisco WS-C|cisco C9', text, re.IGNORECASE):
        return "cisco-ios"
    if re.search(r'ArubaOS-CX|Aruba CX|AOS-CX', text, re.IGNORECASE):
        return "aruba-aos-cx"
    if re.search(r'HP ProCurve|HP Switch|ProVision|Aruba Switch.*K\.\d+|J\d{4}[A-Z]', text, re.IGNORECASE):
        return "aruba-provision"
    if re.search(r'NETGEAR|NetGear', text, re.IGNORECASE):
        return "netgear"
    if re.search(r'NX-OS|Cisco Nexus', text, re.IGNORECASE):
        return "cisco-nxos"
    return "unknown"


# ---------------------------------------------------------------------------
# Parsers — MAC address table
# ---------------------------------------------------------------------------

def parse_mac_table_cisco(text: str) -> list[MacEntry]:
    """Parse Cisco IOS 'show mac address-table' output."""
    entries = []
    # Pattern: VLAN  MAC_ADDRESS  TYPE  PORT(s)
    pattern = re.compile(
        r'^\s*(\d+)\s+([0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4})\s+(\w+)\s+([\w/]+)',
        re.MULTILINE
    )
    for m in pattern.finditer(text):
        vlan = int(m.group(1))
        mac_raw = m.group(2).replace('.', '')
        mac = ':'.join(mac_raw[i:i+2] for i in range(0, 12, 2)).upper()
        entry_type = m.group(3).lower()
        port = m.group(4)
        # Skip VLAN interfaces (Vl99) and CPU
        if port.startswith(('Vl', 'CPU', 'Router', 'Sup')):
            continue
        entries.append(MacEntry(vlan=vlan, mac=mac, port=port, entry_type=entry_type))
    return entries


def parse_mac_table_aruba_cx(text: str) -> list[MacEntry]:
    """Parse Aruba AOS-CX 'show mac-address-table' output."""
    entries = []
    pattern = re.compile(
        r'^([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})\s+(\d+)\s+(\w+)\s+([\d/]+)',
        re.MULTILINE
    )
    for m in pattern.finditer(text):
        mac = m.group(1).upper()
        vlan = int(m.group(2))
        entry_type = m.group(3).lower()
        port = m.group(4)
        entries.append(MacEntry(vlan=vlan, mac=mac, port=port, entry_type=entry_type))
    return entries


def parse_mac_table_provision(text: str) -> list[MacEntry]:
    """Parse Aruba ProVision 'show mac-address' output."""
    entries = []
    # Format: MAC  PORT  VLAN  (or MAC  PORT  VLAN in table)
    pattern = re.compile(
        r'^([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}|[0-9a-fA-F]{12})\s+(\S+)\s+(\d+)',
        re.MULTILINE
    )
    for m in pattern.finditer(text):
        mac_raw = re.sub(r'[:\-]', '', m.group(1)).upper()
        mac = ':'.join(mac_raw[i:i+2] for i in range(0, 12, 2))
        port = m.group(2)
        vlan = int(m.group(3))
        entries.append(MacEntry(vlan=vlan, mac=mac, port=port))
    return entries


def parse_mac_table_netgear(text: str) -> list[MacEntry]:
    """Parse Netgear 'show mac-address-table' output."""
    entries = []
    pattern = re.compile(
        r'^(\d+)\s+([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})\s+(\w+)\s+([\d/]+)',
        re.MULTILINE
    )
    for m in pattern.finditer(text):
        vlan = int(m.group(1))
        mac = m.group(2).upper()
        entry_type = m.group(3).lower()
        port = m.group(4)
        entries.append(MacEntry(vlan=vlan, mac=mac, port=port, entry_type=entry_type))
    return entries


def parse_mac_table(text: str, vendor: str) -> list[MacEntry]:
    if vendor == "cisco-ios" or vendor == "cisco-nxos":
        return parse_mac_table_cisco(text)
    if vendor == "aruba-aos-cx":
        return parse_mac_table_aruba_cx(text)
    if vendor == "aruba-provision":
        return parse_mac_table_provision(text)
    if vendor == "netgear":
        return parse_mac_table_netgear(text)
    # Fallback: try all parsers
    for fn in [parse_mac_table_cisco, parse_mac_table_aruba_cx, parse_mac_table_provision, parse_mac_table_netgear]:
        result = fn(text)
        if result:
            return result
    return []


# ---------------------------------------------------------------------------
# Parser — running-config interfaces
# ---------------------------------------------------------------------------

def parse_interfaces_cisco(text: str) -> dict[str, PortConfig]:
    """Parse Cisco IOS interface configurations."""
    ports = {}
    # Split by interface blocks
    blocks = re.split(r'\ninterface ', text)
    for block in blocks[1:]:
        lines = block.strip().splitlines()
        if not lines:
            continue
        port = lines[0].strip().rstrip('!')
        # Normalize short names: Gi -> GigabitEthernet, Te -> TenGigabitEthernet, Fa -> FastEthernet
        cfg = PortConfig(port=port)
        for line in lines[1:]:
            line = line.strip()
            if line == '!':
                break
            if line.startswith('description'):
                cfg.description = line[len('description'):].strip()
            elif 'switchport mode access' in line:
                cfg.mode = 'access'
            elif 'switchport mode trunk' in line:
                cfg.mode = 'trunk'
            elif m := re.match(r'switchport access vlan (\d+)', line):
                cfg.access_vlan = int(m.group(1))
                if cfg.mode == 'unknown':
                    cfg.mode = 'access'
            elif m := re.match(r'switchport voice vlan (\d+)', line):
                cfg.voice_vlan = int(m.group(1))
            elif m := re.match(r'switchport trunk allowed vlan (.+)', line):
                vlan_str = m.group(1).replace('add ', '')
                cfg.trunk_vlans = parse_vlan_list(vlan_str)
            elif m := re.match(r'switchport trunk native vlan (\d+)', line):
                cfg.native_vlan = int(m.group(1))
            elif line == 'shutdown':
                cfg.shutdown = True
            elif 'spanning-tree portfast' in line:
                cfg.portfast = True
        ports[port] = cfg
    return ports


def parse_interfaces_aruba_cx(text: str) -> dict[str, PortConfig]:
    """Parse Aruba AOS-CX interface configurations."""
    ports = {}
    blocks = re.split(r'\ninterface ', text)
    for block in blocks[1:]:
        lines = block.strip().splitlines()
        if not lines:
            continue
        port = lines[0].strip()
        cfg = PortConfig(port=port)
        for line in lines[1:]:
            line = line.strip()
            if line.startswith('!'):
                break
            if line.startswith('description'):
                cfg.description = line[len('description'):].strip()
            elif m := re.match(r'vlan access (\d+)', line):
                cfg.access_vlan = int(m.group(1))
                cfg.mode = 'access'
            elif m := re.match(r'voice-vlan (\d+)', line):
                cfg.voice_vlan = int(m.group(1))
            elif m := re.match(r'vlan trunk allowed (.+)', line):
                cfg.trunk_vlans = parse_vlan_list(m.group(1))
                cfg.mode = 'trunk'
            elif m := re.match(r'vlan trunk native (\d+)', line):
                cfg.native_vlan = int(m.group(1))
            elif line == 'shutdown':
                cfg.shutdown = True
            elif 'port-type admin-edge' in line:
                cfg.portfast = True
        ports[port] = cfg
    return ports


def parse_interfaces_provision(text: str) -> dict[str, PortConfig]:
    """Parse Aruba ProVision interface configurations."""
    ports = {}
    blocks = re.split(r'\ninterface ', text)
    for block in blocks[1:]:
        lines = block.strip().splitlines()
        if not lines:
            continue
        port = lines[0].strip()
        cfg = PortConfig(port=port)
        tagged_vlans = []
        untagged_vlan = None
        for line in lines[1:]:
            line = line.strip()
            if line in ('exit', '!'):
                break
            if line.startswith('name'):
                cfg.description = line[4:].strip().strip('"\'')
            elif m := re.match(r'untagged vlan (\d+)', line):
                untagged_vlan = int(m.group(1))
            elif m := re.match(r'tagged vlan (.+)', line):
                tagged_vlans = parse_vlan_list(m.group(1))
            elif line == 'disable':
                cfg.shutdown = True
        # Determine mode
        if tagged_vlans and not untagged_vlan:
            cfg.mode = 'trunk'
            cfg.trunk_vlans = tagged_vlans
        elif untagged_vlan and tagged_vlans:
            # Access + voice or access + trunk VLANs
            cfg.mode = 'access'
            cfg.access_vlan = untagged_vlan
            # Heuristic: if only 1 tagged VLAN, treat as voice VLAN
            if len(tagged_vlans) == 1:
                cfg.voice_vlan = tagged_vlans[0]
            else:
                cfg.trunk_vlans = tagged_vlans
        elif untagged_vlan:
            cfg.mode = 'access'
            cfg.access_vlan = untagged_vlan
        ports[port] = cfg
    return ports


def parse_interfaces_netgear(text: str) -> dict[str, PortConfig]:
    """Parse Netgear interface configurations."""
    ports = {}
    blocks = re.split(r'\ninterface ', text)
    for block in blocks[1:]:
        lines = block.strip().splitlines()
        if not lines:
            continue
        port = lines[0].strip()
        cfg = PortConfig(port=port)
        pvid = None
        tagged = []
        for line in lines[1:]:
            line = line.strip()
            if line in ('exit', '!'):
                break
            if line.startswith('description'):
                cfg.description = line[len('description'):].strip().strip("'\"")
            elif m := re.match(r'vlan pvid (\d+)', line):
                pvid = int(m.group(1))
            elif m := re.match(r'vlan tagging (.+)', line):
                tagged = parse_vlan_list(m.group(1))
            elif line == 'shutdown':
                cfg.shutdown = True
        if pvid and tagged:
            cfg.mode = 'access'
            cfg.access_vlan = pvid
            if len(tagged) == 1:
                cfg.voice_vlan = tagged[0]
            else:
                cfg.trunk_vlans = tagged
        elif pvid:
            cfg.mode = 'access'
            cfg.access_vlan = pvid
        elif tagged:
            cfg.mode = 'trunk'
            cfg.trunk_vlans = tagged
        ports[port] = cfg
    return ports


def parse_interfaces(text: str, vendor: str) -> dict[str, PortConfig]:
    if vendor == "cisco-ios" or vendor == "cisco-nxos":
        return parse_interfaces_cisco(text)
    if vendor == "aruba-aos-cx":
        return parse_interfaces_aruba_cx(text)
    if vendor == "aruba-provision":
        return parse_interfaces_provision(text)
    if vendor == "netgear":
        return parse_interfaces_netgear(text)
    return {}


# ---------------------------------------------------------------------------
# Parser — LLDP neighbors
# ---------------------------------------------------------------------------

def parse_lldp_cisco(text: str) -> dict[str, LldpNeighbor]:
    """Parse Cisco IOS 'show lldp neighbors detail' output."""
    neighbors = {}
    blocks = re.split(r'-{10,}', text)
    for block in blocks:
        local_port_m = re.search(r'Local Intf:\s*(\S+)', block)
        if not local_port_m:
            continue
        port = local_port_m.group(1)
        neighbor = LldpNeighbor(local_port=port)

        if m := re.search(r'System Name:\s*(.+)', block):
            neighbor.system_name = m.group(1).strip()
        if m := re.search(r'System Description:\s*\n\s*(.+)', block):
            neighbor.system_description = m.group(1).strip()
        if m := re.search(r'Chassis id:\s*(\S+)', block):
            neighbor.chassis_id = m.group(1).strip()
        if m := re.search(r'Enabled Capabilities:\s*(.+)', block):
            caps = m.group(1).strip()
            neighbor.capabilities_enabled = [c.strip() for c in caps.split(',')]
        if m := re.search(r'IP:\s*([\d.]+)', block):
            neighbor.management_ip = m.group(1).strip()
        if m := re.search(r'Vlan ID:\s*(\d+)', block):
            neighbor.vlan_id = int(m.group(1))

        neighbors[port] = neighbor
    return neighbors


def parse_lldp_aruba_cx(text: str) -> dict[str, LldpNeighbor]:
    """Parse Aruba AOS-CX 'show lldp neighbor-info detail' output."""
    neighbors = {}
    blocks = re.split(r'\n---\n|\n={3,}\n', text)
    for block in blocks:
        port_m = re.search(r'Port\s*:\s*(\S+)', block)
        if not port_m:
            continue
        port = port_m.group(1)
        neighbor = LldpNeighbor(local_port=port)

        if m := re.search(r'System-name\s*:\s*(.+)', block):
            neighbor.system_name = m.group(1).strip()
        if m := re.search(r'System-descr\s*:\s*(.+)', block):
            neighbor.system_description = m.group(1).strip()
        if m := re.search(r'Chassis-id\s*:\s*(\S+)', block):
            neighbor.chassis_id = m.group(1).strip()
        if m := re.search(r'Enabled\s*:\s*(.+)', block):
            caps_text = m.group(1).strip()
            neighbor.capabilities_enabled = [c.strip() for c in caps_text.split(',')]
        if m := re.search(r'IPV4\s*:\s*([\d.]+)', block):
            neighbor.management_ip = m.group(1).strip()

        neighbors[port] = neighbor
    return neighbors


def parse_lldp(text: str, vendor: str) -> dict[str, LldpNeighbor]:
    if vendor in ("cisco-ios", "cisco-nxos"):
        return parse_lldp_cisco(text)
    if vendor == "aruba-aos-cx":
        return parse_lldp_aruba_cx(text)
    # Generic fallback: try cisco parser
    result = parse_lldp_cisco(text)
    return result if result else {}


# ---------------------------------------------------------------------------
# Device classification
# ---------------------------------------------------------------------------

def classify_port(port_id: str, macs: list[MacEntry], lldp: Optional[LldpNeighbor],
                  cfg: Optional[PortConfig]) -> tuple[str, str, int, list[str]]:
    """
    Classify a port and return (device_type, device_detail, confidence, anomalies).
    """
    anomalies = []

    # No activity
    if not macs and (not cfg or cfg.shutdown):
        return "Port libre", "Shutdown", 0, anomalies
    if not macs:
        return "Port libre", "Aucune MAC", 0, anomalies

    # LLDP is the most reliable source
    if lldp:
        caps = [c.upper() for c in lldp.capabilities_enabled]
        desc = lldp.system_description.upper()
        name = lldp.system_name

        is_phone = any(c in caps for c in ['T', 'TELEPHONE', 'PHONE'])
        is_bridge = any(c in caps for c in ['B', 'BRIDGE'])
        is_ap = any(c in caps for c in ['W', 'WLAN', 'WLAN ACCESS POINT', 'ACCESS POINT'])

        # Check description for explicit device type
        if 'IP PHONE' in desc or 'CISCO IP PHONE' in desc or 'YEALINK' in desc or 'POLYCOM' in desc:
            is_phone = True
        if 'ACCESS POINT' in desc or 'AIR-' in desc or 'MERAKI MR' in desc or 'ARUBA AP' in desc:
            is_ap = True

        if is_phone and len(macs) >= 2:
            # Phone + PC behind it
            return "Phone IP + PC", f"{lldp.system_name} ({lldp.system_description[:50]})", 90, anomalies
        if is_phone:
            return "Phone IP", f"{lldp.system_name} ({lldp.system_description[:50]})", 95, anomalies
        if is_ap:
            return "AP WiFi", f"{lldp.system_name}", 92, anomalies
        if is_bridge:
            # Switch or router
            if cfg and cfg.mode == 'trunk':
                return "Switch aval", f"{lldp.system_name}", 95, anomalies
            return "Switch aval", f"{lldp.system_name}", 88, anomalies

    # No LLDP — use OUI + heuristics
    # Multiple MACs on same port
    if len(macs) > 1:
        # Check if one MAC is a phone OUI
        phone_macs = []
        other_macs = []
        for entry in macs:
            result = lookup_oui(entry.mac)
            if result["device_type"] == "Phone IP":
                phone_macs.append(entry)
            else:
                other_macs.append(entry)

        if phone_macs:
            detail = f"Phone OUI: {phone_macs[0].mac}"
            if other_macs:
                return "Phone IP + PC", detail, 80, anomalies
            return "Phone IP", detail, 75, anomalies

        # Multiple non-phone MACs — could be mini-switch
        if len(macs) >= 3:
            anomalies.append(f"{len(macs)} MACs sur ce port — mini-switch non autorisé ?")

    # Single MAC — OUI lookup
    mac_entry = macs[0]
    oui_result = lookup_oui(mac_entry.mac)
    device_type = oui_result["device_type"]
    vendor = oui_result["vendor"]
    confidence = oui_result["confidence"]

    if device_type == "Unknown":
        # Port trunk with one MAC = switch uplink
        if cfg and cfg.mode == 'trunk':
            return "Switch amont/aval", "Trunk sans LLDP", 60, anomalies
        return "Inconnu", f"OUI: {mac_entry.mac[:8]}", confidence, anomalies

    return device_type, f"{vendor} ({mac_entry.mac})", confidence, anomalies


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

def detect_anomalies(port_analysis: PortAnalysis) -> list[str]:
    anomalies = list(port_analysis.anomalies)
    cfg = port_analysis.config
    dt = port_analysis.device_type

    if not cfg:
        return anomalies

    # Phone without voice VLAN
    if 'Phone' in dt and not cfg.voice_vlan:
        anomalies.append("Phone IP detecte sans voice VLAN configure")

    # Endpoint on VLAN 1
    if cfg.mode == 'access' and cfg.access_vlan in (1, None) and dt not in ("Port libre",):
        anomalies.append("Port en VLAN 1 (VLAN par defaut) — segmenter")

    # Trunk connected to non-switch endpoint
    if cfg.mode == 'trunk' and dt in ("PC", "Phone IP", "Imprimante"):
        anomalies.append(f"Port trunk connecte a un endpoint ({dt}) — mauvaise config ?")

    return anomalies


# ---------------------------------------------------------------------------
# Recommendation generation
# ---------------------------------------------------------------------------

def generate_recommendation(analysis: PortAnalysis, vlan_map: dict) -> str:
    cfg = analysis.config
    dt = analysis.device_type

    if dt == "Port libre":
        return "Shutdown + placer en VLAN parking"

    if not cfg:
        return "Verifier configuration"

    if not analysis.anomalies:
        return "OK — aucune action requise"

    recs = []
    if 'Phone IP detecte sans voice VLAN configure' in analysis.anomalies:
        voice_vlan_id = vlan_map.get("VOIX") or vlan_map.get("VOICE") or vlan_map.get("voice")
        if voice_vlan_id:
            recs.append(f"Ajouter: switchport voice vlan {voice_vlan_id}")
        else:
            recs.append("Ajouter voice VLAN (ID a specifier)")

    if any("VLAN 1" in a for a in analysis.anomalies):
        data_vlan_id = vlan_map.get("DATA") or vlan_map.get("data")
        if data_vlan_id:
            recs.append(f"Deplacer vers VLAN {data_vlan_id} (DATA)")
        else:
            recs.append("Deplacer vers VLAN DATA (ID a specifier)")

    return " | ".join(recs) if recs else "Verifier anomalies signalees"


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def generate_markdown_report(switch_name: str, vendor: str, analyses: list[PortAnalysis],
                               vlan_map: dict, hostname: str = "") -> str:
    lines = []
    lines.append(f"# Rapport d'analyse — {hostname or switch_name}")
    lines.append("")

    lines.append("## Informations switch")
    lines.append(f"- **Hostname** : {hostname or 'Non détecté'}")
    lines.append(f"- **Vendor/OS** : {vendor}")
    lines.append(f"- **Ports analysés** : {len(analyses)}")
    lines.append("")

    # VLAN state
    vlans_seen: dict[int, set] = {}
    for a in analyses:
        if a.config:
            if a.config.mode == 'access' and a.config.access_vlan:
                vlans_seen.setdefault(a.config.access_vlan, set()).add(a.port)
            if a.config.voice_vlan:
                vlans_seen.setdefault(a.config.voice_vlan, set()).add(a.port)

    lines.append("## État des lieux VLAN")
    lines.append("| VLAN | Nom (si fourni) | Nb ports |")
    lines.append("|------|----------------|---------|")
    for vid in sorted(vlans_seen.keys()):
        vlan_name = ""
        for k, v in vlan_map.items():
            if str(v) == str(vid):
                vlan_name = k
        lines.append(f"| {vid} | {vlan_name} | {len(vlans_seen[vid])} |")
    lines.append("")

    # Port inventory
    lines.append("## Inventaire par port")
    lines.append("| Port | Mode | VLAN data | VLAN voix | Équipement | Confiance | Anomalies | Recommandation |")
    lines.append("|------|------|-----------|-----------|------------|-----------|-----------|----------------|")

    for a in sorted(analyses, key=lambda x: x.port):
        cfg = a.config
        mode = cfg.mode if cfg else "?"
        access_vlan = cfg.access_vlan or "" if cfg else ""
        voice_vlan = cfg.voice_vlan or "" if cfg else ""
        anomaly_str = " / ".join(a.anomalies) if a.anomalies else "—"
        conf_str = f"{a.confidence}%" if a.confidence > 0 else "—"
        detail = f"{a.device_type}" + (f" ({a.device_detail[:40]})" if a.device_detail else "")
        lines.append(f"| {a.port} | {mode} | {access_vlan} | {voice_vlan} | {detail} | {conf_str} | {anomaly_str} | {a.recommendation} |")

    lines.append("")

    # Summary and recommendations
    phones_no_voice = [a for a in analyses if 'Phone IP detecte sans voice VLAN' in ' '.join(a.anomalies)]
    vlan1_ports = [a for a in analyses if any('VLAN 1' in x for x in a.anomalies)]
    unused_ports = [a for a in analyses if a.device_type == "Port libre"]

    lines.append("## Recommandations")
    if phones_no_voice:
        lines.append(f"- **{len(phones_no_voice)} ports avec phone IP sans voice VLAN** — ajouter `switchport voice vlan [ID]`")
    if vlan1_ports:
        lines.append(f"- **{len(vlan1_ports)} ports en VLAN 1** — déplacer vers VLAN DATA dédié")
    if unused_ports:
        lines.append(f"- **{len(unused_ports)} ports libres** — mettre en shutdown + VLAN parking")

    trunk_ports = [a for a in analyses if a.config and a.config.mode == 'trunk']
    non_trunk_ports = [a for a in analyses if not a.config or a.config.mode != 'trunk']
    if trunk_ports and non_trunk_ports:
        trunk_port_ids = [a.port for a in trunk_ports]
        lines.append(f"\n### Organisation physique")
        lines.append(f"- Ports trunk actuels : {', '.join(trunk_port_ids)}")
        lines.append(f"- Best practice : regrouper les trunks/uplinks sur les ports hauts numérotés (à droite du panneau)")

    return "\n".join(lines)


def generate_csv_report(analyses: list[PortAnalysis]) -> str:
    lines = ["Port,Mode,VLAN_data,VLAN_voix,Type_equipement,Detail,Confiance,Anomalies,Recommandation"]
    for a in analyses:
        cfg = a.config
        row = [
            a.port,
            cfg.mode if cfg else "",
            str(cfg.access_vlan or "") if cfg else "",
            str(cfg.voice_vlan or "") if cfg else "",
            a.device_type,
            a.device_detail.replace(",", ";"),
            f"{a.confidence}%" if a.confidence > 0 else "",
            " / ".join(a.anomalies).replace(",", ";"),
            a.recommendation.replace(",", ";"),
        ]
        lines.append(",".join(row))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_vlan_list(vlan_str: str) -> list[int]:
    """Parse VLAN list like '10,20,30-35,99' into a list of ints."""
    vlans = []
    for part in re.split(r'[,\s]+', vlan_str.strip()):
        if '-' in part:
            start, end = part.split('-', 1)
            try:
                vlans.extend(range(int(start), int(end) + 1))
            except ValueError:
                pass
        else:
            try:
                vlans.append(int(part))
            except ValueError:
                pass
    return vlans


def extract_hostname(text: str) -> str:
    """Try to extract switch hostname from CLI output."""
    # Cisco: "hostname SW-CORE" in config
    if m := re.search(r'^hostname\s+(\S+)', text, re.MULTILINE):
        return m.group(1)
    # AOS-CX: "hostname SW-CORE"
    if m := re.search(r'^set system name\s+"?(\S+)"?', text, re.MULTILINE | re.IGNORECASE):
        return m.group(1)
    # Try prompt pattern: "SW-CORE#"
    if m := re.search(r'^([A-Za-z0-9_\-]+)[#>]', text, re.MULTILINE):
        return m.group(1)
    return ""


# ---------------------------------------------------------------------------
# Main analysis pipeline
# ---------------------------------------------------------------------------

def analyze(text: str, vlan_map: dict, output_format: str = "markdown") -> str:
    vendor = detect_vendor(text)
    hostname = extract_hostname(text)

    mac_entries = parse_mac_table(text, vendor)
    port_configs = parse_interfaces(text, vendor)
    lldp_neighbors = parse_lldp(text, vendor)

    # Group MACs by port
    macs_by_port: dict[str, list[MacEntry]] = {}
    for entry in mac_entries:
        macs_by_port.setdefault(entry.port, []).append(entry)

    # Collect all port IDs
    all_ports = set(macs_by_port.keys()) | set(port_configs.keys()) | set(lldp_neighbors.keys())

    analyses = []
    for port in all_ports:
        macs = macs_by_port.get(port, [])
        cfg = port_configs.get(port)
        lldp = lldp_neighbors.get(port)

        device_type, detail, confidence, anomalies = classify_port(port, macs, lldp, cfg)

        analysis = PortAnalysis(
            port=port,
            config=cfg,
            macs=macs,
            lldp_neighbor=lldp,
            device_type=device_type,
            device_detail=detail,
            confidence=confidence,
            anomalies=anomalies,
        )
        analysis.anomalies = detect_anomalies(analysis)
        analysis.recommendation = generate_recommendation(analysis, vlan_map)
        analyses.append(analysis)

    if output_format == "csv":
        return generate_csv_report(analyses)
    if output_format == "json":
        result = []
        for a in analyses:
            result.append({
                "port": a.port,
                "mode": a.config.mode if a.config else None,
                "access_vlan": a.config.access_vlan if a.config else None,
                "voice_vlan": a.config.voice_vlan if a.config else None,
                "device_type": a.device_type,
                "device_detail": a.device_detail,
                "confidence": a.confidence,
                "anomalies": a.anomalies,
                "recommendation": a.recommendation,
            })
        return json.dumps(result, ensure_ascii=False, indent=2)

    return generate_markdown_report(
        switch_name=hostname or "switch",
        vendor=vendor,
        analyses=analyses,
        vlan_map=vlan_map,
        hostname=hostname,
    )


def parse_vlan_arg(vlan_str: str) -> dict:
    """Parse '--vlans 10:DATA,20:VOIX,99:MGMT' into {DATA: 10, VOIX: 20, MGMT: 99}."""
    result = {}
    for part in vlan_str.split(','):
        if ':' in part:
            vid, name = part.split(':', 1)
            result[name.strip().upper()] = int(vid.strip())
    return result


def main():
    parser = argparse.ArgumentParser(description="Network Switch Analyzer")
    parser.add_argument("files", nargs="*", help="Input files (use '-' for stdin)")
    parser.add_argument("--vlans", help="VLAN map: '10:DATA,20:VOIX,99:MGMT'", default="")
    parser.add_argument("--format", choices=["markdown", "csv", "json"], default="markdown")
    args = parser.parse_args()

    vlan_map = parse_vlan_arg(args.vlans) if args.vlans else {}

    files = args.files or ["-"]

    for f in files:
        if f == "-":
            text = sys.stdin.read()
            name = "stdin"
        else:
            path = Path(f)
            if not path.exists():
                print(f"File not found: {f}", file=sys.stderr)
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            name = path.stem

        if len(files) > 1:
            print(f"\n{'='*60}")
            print(f"# Switch: {name}")
            print(f"{'='*60}\n")

        print(analyze(text, vlan_map=vlan_map, output_format=args.format))


if __name__ == "__main__":
    main()
