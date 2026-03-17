#!/usr/bin/env python3
"""
OUI Lookup Tool — Network Switch Analysis Skill
Lookups MAC address vendor from IEEE OUI database + device type hints.

Usage:
    python oui_lookup.py <MAC_ADDRESS> [<MAC_ADDRESS> ...]
    python oui_lookup.py --file <mac_list.txt>

MAC formats accepted: aa:bb:cc:dd:ee:ff, aabb.ccdd.eeff, aa-bb-cc-dd-ee-ff, aabbccddeeff
"""

import sys
import os
import re
import json
import argparse
from pathlib import Path

# Known device-type OUI mappings (from references/oui-vendors.md)
# Format: normalized OUI (6 hex chars uppercase) -> (vendor_name, device_type, confidence_boost)
KNOWN_DEVICE_OUIS = {
    # --- Phones IP ---
    "000283": ("Cisco Systems", "Phone IP", 20),
    "001120": ("Cisco Systems", "Phone IP", 20),
    "001E13": ("Cisco Systems", "Phone IP", 20),
    "001EE5": ("Cisco Systems", "Phone IP", 20),
    "0021A0": ("Cisco Systems", "Phone IP", 20),
    "002255": ("Cisco Systems", "Phone IP", 20),
    "0024C4": ("Cisco Systems", "Phone IP", 20),
    "002699": ("Cisco Systems", "Phone IP", 20),
    "2CD02D": ("Cisco Systems", "Phone IP", 20),
    "34BDC8": ("Cisco Systems", "Phone IP", 20),
    "54781A": ("Cisco Systems", "Phone IP", 20),
    "5897BD": ("Cisco Systems", "Phone IP", 20),
    "6C2056": ("Cisco Systems", "Phone IP", 20),
    "74A02F": ("Cisco Systems", "Phone IP", 20),
    "001565": ("Yealink Network Technology", "Phone IP", 20),
    "7C2F80": ("Yealink Network Technology", "Phone IP", 20),
    "805EC0": ("Yealink Network Technology", "Phone IP", 20),
    "AC359E": ("Yealink Network Technology", "Phone IP", 20),
    "D46A35": ("Yealink Network Technology", "Phone IP", 20),
    "6416 7F": ("Poly (HP)", "Phone IP", 20),
    "64167F": ("Poly (HP)", "Phone IP", 20),
    "0004F2": ("Polycom / Poly", "Phone IP", 20),
    "00E075": ("Polycom / Poly", "Phone IP", 20),
    "8C1ABF": ("Poly (HP)", "Phone IP", 20),
    "000413": ("Snom Technology", "Phone IP", 20),
    "000476": ("Snom Technology", "Phone IP", 20),
    "000945": ("Fanvil Technology", "Phone IP", 20),
    "00A859": ("Fanvil Technology", "Phone IP", 20),
    "0C383E": ("Grandstream Networks", "Phone IP", 20),
    "000B82": ("Grandstream Networks", "Phone IP", 20),
    "C074AD": ("Grandstream Networks", "Phone IP", 20),
    "003048": ("Mitel Networks", "Phone IP", 20),
    "00907A": ("Mitel Networks", "Phone IP", 20),
    "BCF171": ("Mitel Networks", "Phone IP", 20),
    "00194B": ("Aastra / Mitel", "Phone IP", 20),
    "00085D": ("Aastra Technologies", "Phone IP", 20),
    "0000F0": ("Auerswald GmbH", "Phone IP", 20),
    "B47C9C": ("Auerswald", "Phone IP", 20),
    "001416": ("Avaya", "Phone IP", 20),
    "001B4F": ("Avaya", "Phone IP", 20),
    "EC1D7F": ("Avaya", "Phone IP", 20),
    "00605A": ("Avaya", "Phone IP", 20),
    "001C4D": ("Spectralink", "Phone IP", 20),
    "0009EF": ("Spectralink", "Phone IP", 20),
    # --- Access Points WiFi ---
    "000CE6": ("Cisco Aironet", "AP WiFi", 20),
    "0017DF": ("Cisco Aironet / Meraki", "AP WiFi", 20),
    "001AA1": ("Cisco Meraki", "AP WiFi", 20),
    "0C75BD": ("Cisco Meraki", "AP WiFi", 20),
    "34DBFD": ("Cisco Meraki", "AP WiFi", 20),
    "881544": ("Cisco Meraki", "AP WiFi", 20),
    "E0CB4E": ("Cisco Meraki", "AP WiFi", 20),
    "000B86": ("Aruba Networks (HP)", "AP WiFi", 20),
    "001A1E": ("Aruba / HP", "AP WiFi", 20),
    "24DEC6": ("Aruba Networks", "AP WiFi", 20),
    "6CF37F": ("Aruba Networks", "AP WiFi", 20),
    "ACA31E": ("Aruba Networks", "AP WiFi", 20),
    "002722": ("Ubiquiti Networks", "AP WiFi", 20),
    "0418D6": ("Ubiquiti Networks", "AP WiFi", 20),
    "24A43C": ("Ubiquiti Networks", "AP WiFi", 20),
    "788A20": ("Ubiquiti Networks", "AP WiFi", 20),
    "FCECDA": ("Ubiquiti Networks", "AP WiFi", 20),
    "001874": ("Ruckus Networks", "AP WiFi", 20),
    "00227F": ("Ruckus Networks", "AP WiFi", 20),
    "2CE6CC": ("Ruckus (CommScope)", "AP WiFi", 20),
    "B4C799": ("Ruckus Networks", "AP WiFi", 20),
    "0060B3": ("Extreme Networks", "AP WiFi", 20),
    # --- Cameras IP ---
    "00408C": ("Axis Communications", "Camera IP", 20),
    "ACCC8E": ("Axis Communications", "Camera IP", 20),
    "B8A44F": ("Axis Communications", "Camera IP", 20),
    "001212": ("Hikvision", "Camera IP", 20),
    "1868CB": ("Hikvision", "Camera IP", 20),
    "BCAD28": ("Hikvision", "Camera IP", 20),
    "C056E3": ("Dahua Technology", "Camera IP", 20),
    "E4246C": ("Dahua Technology", "Camera IP", 20),
    "40ED00": ("Hanwha (Samsung)", "Camera IP", 20),
    "000918": ("Samsung Techwin", "Camera IP", 20),
    "0004A1": ("Mobotix", "Camera IP", 20),
    # --- Printers ---
    "000048": ("Epson", "Imprimante", 15),
    "0026AB": ("Epson", "Imprimante", 15),
    "008077": ("HP Inc.", "Imprimante", 15),
    "001708": ("HP Inc.", "Imprimante", 15),
    "A01D48": ("HP Inc.", "Imprimante", 15),
    "0000AA": ("Xerox", "Imprimante", 15),
    "000074": ("Ricoh", "Imprimante", 15),
    "002673": ("Konica-Minolta", "Imprimante", 15),
    "00206B": ("Canon", "Imprimante", 15),
    # --- PC / Workstation vendors (lower confidence) ---
    "001CC4": ("Dell Inc.", "PC", 0),
    "180373": ("Dell Inc.", "PC", 0),
    "B083FE": ("Dell Inc.", "PC", 0),
    "D4BED9": ("Dell Inc.", "PC", 0),
    "3CA82A": ("HP Inc.", "PC", 0),
    "A0D3C1": ("HP Inc.", "PC", 0),
    "E4A7C5": ("Lenovo", "PC", 0),
    "8CEC4B": ("Lenovo", "PC", 0),
    "3C970E": ("Apple Inc.", "PC", 0),
    "A4C3F0": ("Apple Inc.", "PC", 0),
    "001CBF": ("Intel Corp.", "PC", 0),
    "005056": ("VMware Inc.", "VM", 0),
    "000C29": ("VMware Inc.", "VM", 0),
    "525400": ("QEMU/KVM", "VM", 0),
    "080027": ("VirtualBox", "VM", 0),
}

# Base confidence by device type (when OUI is known)
DEVICE_TYPE_BASE_CONFIDENCE = {
    "Phone IP": 75,
    "AP WiFi": 75,
    "Camera IP": 75,
    "Imprimante": 70,
    "PC": 60,
    "VM": 60,
}


def normalize_mac(mac: str) -> str:
    """Normalize a MAC address to 12 uppercase hex characters."""
    # Remove common separators
    clean = re.sub(r'[:\-\.]', '', mac).upper()
    if len(clean) != 12 or not re.match(r'^[0-9A-F]{12}$', clean):
        raise ValueError(f"Invalid MAC address: {mac}")
    return clean


def get_oui(mac_normalized: str) -> str:
    """Extract the OUI (first 6 hex chars) from a normalized MAC."""
    return mac_normalized[:6]


def lookup_oui(mac: str) -> dict:
    """
    Lookup a MAC address and return vendor + device type info.

    Returns:
        dict with keys:
            mac_normalized: str
            oui: str
            vendor: str
            device_type: str  (Phone IP, AP WiFi, PC, Camera IP, Imprimante, Unknown)
            confidence: int   (0-99)
            source: str       (known_device_db, ieee_cache, unknown)
    """
    try:
        normalized = normalize_mac(mac)
    except ValueError as e:
        return {"error": str(e), "mac_normalized": mac, "oui": "", "vendor": "Invalid MAC", "device_type": "Unknown", "confidence": 0, "source": "error"}

    oui = get_oui(normalized)

    # 1. Check known device OUI database first
    if oui in KNOWN_DEVICE_OUIS:
        vendor, device_type, confidence_boost = KNOWN_DEVICE_OUIS[oui]
        base = DEVICE_TYPE_BASE_CONFIDENCE.get(device_type, 50)
        confidence = min(base + confidence_boost, 99)
        return {
            "mac_normalized": normalized,
            "oui": oui,
            "vendor": vendor,
            "device_type": device_type,
            "confidence": confidence,
            "source": "known_device_db",
        }

    # 2. Try IEEE OUI cache
    ieee_vendor = lookup_ieee_cache(oui)
    if ieee_vendor:
        device_type = guess_device_type_from_vendor(ieee_vendor)
        base = DEVICE_TYPE_BASE_CONFIDENCE.get(device_type, 40)
        return {
            "mac_normalized": normalized,
            "oui": oui,
            "vendor": ieee_vendor,
            "device_type": device_type,
            "confidence": base,
            "source": "ieee_cache",
        }

    # 3. Unknown
    return {
        "mac_normalized": normalized,
        "oui": oui,
        "vendor": "Unknown",
        "device_type": "Unknown",
        "confidence": 30,
        "source": "unknown",
    }


def lookup_ieee_cache(oui: str) -> str | None:
    """Look up OUI in local IEEE cache file."""
    cache_path = Path(__file__).parent / "oui_cache.json"
    if not cache_path.exists():
        return None
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            cache = json.load(f)
        return cache.get(oui.upper())
    except Exception:
        return None


def guess_device_type_from_vendor(vendor: str) -> str:
    """Heuristic: guess device type from IEEE vendor name."""
    vendor_upper = vendor.upper()
    phone_keywords = ["PHONE", "YEALINK", "POLYCOM", "POLY ", "SNOM", "FANVIL", "GRANDSTREAM", "MITEL", "AASTRA", "AUERSWALD", "AVAYA", "SPECTRALINK"]
    ap_keywords = ["MERAKI", "AIRONET", "UBIQUITI", "RUCKUS", "ARUBA", "EXTREME NETWORK", "ACCESS POINT", "WIFI"]
    camera_keywords = ["AXIS COMM", "HIKVISION", "DAHUA", "HANWHA", "MOBOTIX", "BOSCH SECURITY", "SAMSUNG TECHWIN"]
    printer_keywords = ["EPSON", "HEWLETT-PACKARD", "HP INC", "XEROX", "RICOH", "KONICA", "CANON INC", "LEXMARK"]
    pc_keywords = ["DELL", "LENOVO", "APPLE", "INTEL CORP", "VMWARE", "VIRTUALBOX", "QEMU"]

    for kw in phone_keywords:
        if kw in vendor_upper:
            return "Phone IP"
    for kw in ap_keywords:
        if kw in vendor_upper:
            return "AP WiFi"
    for kw in camera_keywords:
        if kw in vendor_upper:
            return "Camera IP"
    for kw in printer_keywords:
        if kw in vendor_upper:
            return "Imprimante"
    for kw in pc_keywords:
        if kw in vendor_upper:
            return "PC"
    return "Unknown"


def download_ieee_cache():
    """Download and cache the IEEE OUI database."""
    import urllib.request
    url = "https://standards-oui.ieee.org/oui/oui.txt"
    cache_path = Path(__file__).parent / "oui_cache.json"

    print(f"Downloading IEEE OUI database from {url}...")
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Error downloading OUI database: {e}", file=sys.stderr)
        return False

    # Parse: lines like "001120   (hex)  Cisco Systems, Inc"
    oui_map = {}
    for line in raw.splitlines():
        match = re.match(r'^([0-9A-Fa-f]{6})\s+\(hex\)\s+(.+)$', line)
        if match:
            oui = match.group(1).upper().replace("-", "")
            vendor = match.group(2).strip()
            oui_map[oui] = vendor

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(oui_map, f, ensure_ascii=False)

    print(f"Cached {len(oui_map)} OUI entries to {cache_path}")
    return True


def format_result(result: dict, fmt: str = "text") -> str:
    """Format lookup result for display."""
    if fmt == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)

    if "error" in result:
        return f"ERROR: {result['error']}"

    mac = result["mac_normalized"]
    mac_fmt = ":".join(mac[i:i+2] for i in range(0, 12, 2)).lower()
    vendor = result["vendor"]
    device_type = result["device_type"]
    confidence = result["confidence"]
    source = result["source"]

    return f"{mac_fmt}  |  {vendor:<35}  |  {device_type:<12}  |  {confidence:>2}%  |  [{source}]"


def main():
    parser = argparse.ArgumentParser(description="OUI Lookup Tool for Network Switch Analysis")
    parser.add_argument("macs", nargs="*", help="MAC addresses to look up")
    parser.add_argument("--file", "-f", help="File containing one MAC address per line")
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    parser.add_argument("--update-cache", action="store_true", help="Download/update IEEE OUI database cache")
    args = parser.parse_args()

    if args.update_cache:
        download_ieee_cache()
        return

    macs = list(args.macs)

    if args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        macs.append(line)
        except FileNotFoundError:
            print(f"File not found: {args.file}", file=sys.stderr)
            sys.exit(1)

    if not macs:
        parser.print_help()
        sys.exit(0)

    fmt = "json" if args.json else "text"

    if fmt == "text":
        print(f"{'MAC Address':<20}  {'Vendor':<35}  {'Type':<12}  {'Conf':>5}  Source")
        print("-" * 90)

    results = []
    for mac in macs:
        result = lookup_oui(mac)
        results.append(result)
        if fmt == "text":
            print(format_result(result, fmt="text"))

    if fmt == "json":
        print(json.dumps(results if len(results) > 1 else results[0], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
