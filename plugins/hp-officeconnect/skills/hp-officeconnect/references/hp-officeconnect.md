# Référence HP OfficeConnect 1920S

Guide de collecte de données pour les switches HP OfficeConnect via interface web locale.
Ces switches n'ont pas de CLI SSH — l'administration se fait uniquement via navigateur web.

**Méthode d'accès confirmée :** Playwright + pages Lua Server Pages (confirmé sur firmware PD.02.14)
**Protocole WCD XML (Aruba) NON supporté** — les endpoints WCD retournent 404.

---

## Identification

**Modèles concernés :**
- HP OfficeConnect 1920S 24G 2SFP PoE+ (370W) — JL385A
- HP OfficeConnect 1920S 24G 2SFP — JL381A
- HP OfficeConnect 1920S 48G 2SFP — JL382A
- Autres variantes 1920S (8G, 48G PoE+, etc.)

**Accès local :** `http://<IP_du_switch>/`
- HTTP (pas HTTPS par défaut)
- Login par défaut : `admin` / (configurer un mot de passe)
- Interface : jQuery 1.7.1 + jQuery UI 1.8.16 + Lua Server Pages

**Firmware testé :** PD.02.14, Linux 3.6.5
**System OID :** 1.3.6.1.4.1.11.2.3.7.11.188

---

## Mécanisme de login

Le login est un simple POST jQuery AJAX — **pas de RSA**, contrairement aux Aruba Instant On.

### Endpoint de login

```
POST /htdocs/login/login.lua
Content-Type: application/x-www-form-urlencoded

username=admin&password=<MOT_DE_PASSE>
```

### Réponse JSON

**Succès :**
```json
{
  "username": "admin",
  "redirect": "/htdocs/pages/main/main.lsp"
}
```

**Échec :**
```json
{
  "error": "Invalid password."
}
```

### Session

- Cookie `SID` (76 caractères aléatoires) — défini par le serveur après login
- **PAS de SID dans l'URL** (contrairement à Aruba)
- Timeout idle : 60 minutes
- Keepalive : `GET /htdocs/lua/ajax/ping.lua`

### Via Playwright

```javascript
await page.goto(`http://${IP}/`);
await page.waitForSelector('input[name="username"]', { timeout: 15000 });
await page.fill('input[name="username"]', USERNAME);
await page.fill('input[name="password"]', PASSWORD);
await page.click('#login_button');
await page.waitForURL(/main\.lsp/, { timeout: 20000 });
```

Le cookie `SID` est automatiquement géré par Playwright. Les fetch() suivants incluent le cookie.

---

## Architecture API

Le HP 1920S utilise des **pages Lua Server Pages (.lsp)** côté serveur. Chaque page HTML contient les données sous forme de tableaux JavaScript embarqués.

### Format des données

Les pages retournent du HTML contenant :
```html
<script>
var aDataSet = [
  ["g1","","1G - Level","Enable","Auto","1000M Full","","Disable","Disable","Up","1518"],
  ["g2","","1G - Level","Enable","Auto","Down","","Disable","Disable","Down","1518"],
  ...
];
</script>
```

**Extraction via regex :**
```javascript
const match = html.match(/var\s+aDataSet\s*=\s*(\[[\s\S]*?\])\s*;/);
const data = match ? JSON.parse(match[1]) : [];
```

### Cas spéciaux

- `dashboard.lsp` : pas de `aDataSet`. Les données sont dans des `<td class="label">` et des champs de formulaire.
- `poe_port_cfg.lsp` : contient aussi `var consPower = "4100";` (puissance globale consommée en mW).
- Certaines pages utilisent `aDataSet2` pour des données secondaires.

---

## Endpoints LSP confirmés

Confirmés sur firmware PD.02.14, switch CRCP-SW01-973 (192.168.30.235).

### Données système

| Page | Données |
|------|---------|
| `/htdocs/pages/base/dashboard.lsp` | hostname, firmware, serial, MAC, uptime, CPU%, RAM% |
| `/htdocs/pages/base/get_connected.lsp` | IP, subnet, gateway, HTTP port |

### Ports

| Page | Données | Colonnes aDataSet |
|------|---------|-------------------|
| `/htdocs/pages/base/port_summary.lsp` | 26 ports (24 RJ45 + 2 SFP) | Port, Description, Type, Admin, Speed, Negotiated, Advertised, FlowCtrl, Jumbo, LinkState, MTU |
| `/htdocs/pages/base/port_summary_stats.lsp` | Compteurs trafic par port | Port, TxPkts, TxMcast, TxBcast, TxBytes, ... |

### PoE

| Page | Données | Colonnes aDataSet |
|------|---------|-------------------|
| `/htdocs/pages/base/poe_port_cfg.lsp` | 24 ports PoE + consPower global | Port, Enabled, Priority, ClassOverride, HighPower, Standard, PowerLimit, DetectionStatus, Class, Power |

### VLANs

| Page | Données | Colonnes aDataSet |
|------|---------|-------------------|
| `/htdocs/pages/switching/vlan_status.lsp` | Liste VLANs (14 trouvés) | VLAN_ID, Name, Type |
| `/htdocs/pages/switching/vlan_port.lsp` | Config VLAN par port (26 ports + 8 TRK) | Port, PVID, AdmitAll, IngressFilter, UntaggedVLAN, TaggedVLANs |

### LLDP

| Page | Données | Colonnes aDataSet |
|------|---------|-------------------|
| `/htdocs/pages/switching/lldp_remote.lsp` | Voisins LLDP | Port, Index, ChassisID, PortID, PortDesc, SystemName, Capabilities, EnabledCaps, MgmtIP |
| `/htdocs/pages/switching/lldp_med_remote.lsp` | Voisins LLDP-MED | Port, Index, DeviceType, MgmtIP |

### Table MAC

| Page | Données | Colonnes aDataSet |
|------|---------|-------------------|
| `/htdocs/pages/base/mac_address_table.lsp` | Table MAC (31 entrées) | VLAN_ID, MACAddress, PortName, PortNumber, Type |

### Trunks (LAG)

| Page | Données | Colonnes aDataSet |
|------|---------|-------------------|
| `/htdocs/pages/switching/port_channel_summary.lsp` | Link aggregation | Name, Description, Type, AdminStatus, LinkStatus, MemberPorts, ActivePorts |

### STP

| Page | Données |
|------|---------|
| `/htdocs/pages/switching/stp_cfg.lsp` | STP Admin Mode, Protocol Version, Config Name |

### AJAX Endpoints (JSON)

| Endpoint | Méthode | Données |
|----------|---------|---------|
| `/htdocs/login/login.lua` | POST | Login → redirect URL |
| `/htdocs/lua/ajax/ping.lua` | GET | `{configChanged, time, unexpectedRestart}` |
| `/htdocs/lua/ajax/dashboard_ajax.lua` | GET | `uptime\|cpu%\|mem%\|time\|date` (pipe-delimited) |
| `/htdocs/lua/deviceviewer/deviceviewer_status.lua?unit=1&ports[]=1&...` | GET | Per-port status JSON: `{intf, state, pse, description}` |

---

## Différences avec Aruba Instant On

| Caractéristique | Aruba Instant On (1930) | HP OfficeConnect 1920S |
|----------------|------------------------|----------------------|
| **Protocole** | WCD XML | Lua Server Pages (HTML + JS) |
| **Format données** | XML structuré | `var aDataSet = [[...]]` dans HTML |
| **Login** | RSA JavaScript + formSubmit() | POST simple JSON |
| **Session** | SID dans URL (`/cs<SID>/...`) | Cookie `SID` |
| **Parsing** | Parse XML | Regex aDataSet + JSON.parse() |
| **AJAX APIs** | Nombreux endpoints WCD | Très peu (ping, dashboard) |

---

## Données disponibles

| Donnée | Disponible | Endpoint |
|--------|-----------|----------|
| Hostname, firmware, MAC, serial | Oui | `dashboard.lsp` |
| Statut UP/DOWN et vitesse par port | Oui | `port_summary.lsp` |
| PoE delivering / puissance par port | Oui | `poe_port_cfg.lsp` |
| VLANs configurés (nom, ID) | Oui | `vlan_status.lsp` |
| VLAN access/trunk par port | Oui | `vlan_port.lsp` |
| Voisins LLDP (nom, IP, capabilities) | Oui | `lldp_remote.lsp` |
| Voisins LLDP-MED | Oui | `lldp_med_remote.lsp` |
| Table MAC (MAC → port) | Oui | `mac_address_table.lsp` |
| Trunks / LAG | Oui | `port_channel_summary.lsp` |
| Table ARP | Partiel | `arp_status.lsp` (souvent vide si L2-only) |
