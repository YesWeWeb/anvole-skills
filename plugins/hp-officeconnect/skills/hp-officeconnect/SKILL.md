---
name: hp-officeconnect
description: >
  Use this skill to collect data from HP OfficeConnect 1920S and 1920 switches via their web interface.
  ALWAYS trigger when the user mentions HP 1920S, HP 1920, OfficeConnect, JL385A, JL381A, or any HP
  switch accessed via web UI (not SSH). These switches have no CLI — data is collected via Playwright
  browser automation reading Lua Server Pages. Collects VLANs, MAC table, LLDP, port status, PoE,
  trunk config. Also invoked programmatically by analysis skills.
  French triggers: "switch HP 1920S", "HP OfficeConnect", "HP via le web", "interface web du HP",
  "scanner le HP 1920", "inventaire HP 1920S", "collecter le 1920S".
  Do NOT use for HP ProCurve 2530/2620/2920 (SSH — use hp-procurve).
  Do NOT use for Aruba Instant On 1930/1960 (use aruba-instant-on).
---

# HP OfficeConnect — Collecte Lua Server Pages via Playwright

Ce skill collecte les données d'un switch HP OfficeConnect via les pages Lua (.lsp) embarquées.
**Protocole WCD XML (Aruba) NON supporté.** Les données sont dans le HTML (`var aDataSet = [...]`).

## Prérequis

```bash
node --version           # Node.js requis
npm install playwright   # package Playwright
npx playwright install chromium  # navigateur Chromium
```

## Collecte — Étape 1 : Demander les accès

Demander :
- Adresse IP du switch (ex: `192.168.30.235`)
- Mot de passe admin
- Nom d'utilisateur (par défaut : `admin`)

## Collecte — Étape 2 : Exécuter le script de collecte

```bash
node <path>/scripts/collect_hp.js <IP> <PASSWORD> C:/tmp/switch-data [USERNAME]
```

Le script se connecte via Playwright, login via POST jQuery AJAX (`/htdocs/login/login.lua`), puis récupère les pages LSP en extrayant `var aDataSet` de chaque page HTML.

**Si le script échoue :** mauvais mot de passe ou switch inaccessible. Vérifier et redemander.

## Collecte — Étape 3 : Vérifier les fichiers JSON produits

```bash
ls -la C:/tmp/switch-data/<HOSTNAME>/
# metadata.json, system.json, ports.json, poe.json, vlans.json, vlan_ports.json, lldp.json, mac_table.json, trunks.json
```

Si les fichiers sont vides ou contiennent `[]` → login a échoué.

## Parsing — Étape 4 : Interpréter les données

Lire `references/hp-officeconnect.md` pour le format détaillé des données.

### Ports (`ports.json`)

Tableau de tableaux. **La colonne [0] est un checkbox HTML (ignorer).** Données utiles à partir de [1].
```
[0] (checkbox HTML — ignorer)
[1] Port       — ex: "1", "24", "25" (SFP)
[2] Description
[3] Type       — "Normal"
[4] Admin Mode — "Enabled" / "Disabled"
[5] Speed      — "Auto"
[6] Négocié    — "1000 Mbps", "100 Mbps", "Unknown" (= Down)
[7] Advertised — "10h | 10f | 100h | 100f | 1000f"
[8] Flow Ctrl
[9] Jumbo      — "Enabled" / "Disabled"
[10] Link State — "Link Up" / "Link Down"
[11] MTU       — "1500"
```

### PoE (`poe.json`)

**Colonne [0] = checkbox HTML (ignorer).**
```
[0] (checkbox HTML)
[1] Port
[2-...] Enabled, Priority, Class Override, High Power, Standard, Power Limit, Detection Status, Class, Power
```

### VLANs (`vlans.json`)

**Colonne [0] = checkbox HTML (ignorer).**
```
[0] (checkbox HTML)
[1] VLAN ID    — ex: "1", "33", "666"
[2] Name       — ex: "default", "INTERCO_DATA", "Blackhole"
[3] Type       — "Default" / "Static"
```

### VLAN par port (`vlan_ports.json`)

**Colonne [0] = checkbox HTML (ignorer).**
```
[0] (checkbox HTML)
[1] Port
[2] PVID       — VLAN access (natif)
[3] Admit All
[4] Ingress Filter
[5] Untagged VLAN
[6] Tagged VLANs
```

### Voisins LLDP (`lldp.json`)

**Pas de checkbox en [0] pour cette table.**
```
[0] Port       — ex: "20", "24"
[1] Index
[2] Chassis ID — MAC
[3] Port ID
[4] Port Description
[5] System Name — ex: "FortiAP-221E", "CRCP-SW02-973"
[6] Capabilities — ex: "bridge, WLAN access point, router"
[7] Enabled Capabilities
[8] Management IP — contient du HTML : <a href="http://IP">IP</a>
```

### Table MAC (`mac_table.json`)

**Pas de checkbox en [0].**
```
[0] VLAN ID
[1] MAC Address
[2] Port       — ex: "1", "TRK1"
[3] (vide ou type)
[4] Type       — "Dynamic" / "Static"
```

### Trunks (`trunks.json`)

**Colonne [0] = checkbox HTML (ignorer).**
```
[0] (checkbox HTML)
[1] Name       — ex: "TRK1"
[2] Description
[3] Type
[4] Admin Status
[5] Link Status — "Link Up" / "Link Down"
[6] Member Ports
[7] Active Ports
```

### Note importante : nettoyage HTML

Certaines colonnes contiennent du HTML (checkboxes, liens `<a>`). Pour extraire la valeur utile :
- **Checkbox** (col 0) : ignorer entièrement, les données utiles commencent à col 1
- **Liens IP** (LLDP col 8) : extraire l'IP avec regex `/>([^<]+)</` ou `href="http://([^"]+)"`

## Identification des équipements

**Avec LLDP (`lldp.json`) :**

| Signal | Type | Confiance |
|--------|------|-----------|
| Capabilities contient "Bridge" + System Name | Switch aval | 90% |
| Capabilities contient "WLAN Access Point" | AP WiFi | 90% |
| Capabilities contient "Telephone" | Téléphone IP | 90% |

**Sans LLDP (port absent de lldp.json) :**

| Signal | Type probable | Confiance |
|--------|-------------|-----------|
| PoE Delivering + VLAN voix | Phone IP | 65% |
| PoE Delivering + puissance > 10W | AP WiFi | 65% |
| Trunk multi-VLAN + sans PoE | Switch aval | 70% |

**Après identification :** retourner les données structurées au skill `network-switch-analysis` pour l'analyse et le rapport.

## Références

- `references/hp-officeconnect.md` — protocole LSP, login, endpoints, format des données
- `scripts/collect_hp.js` — script de collecte Playwright complet
