# Référence Aruba Instant On

Guide de collecte de données pour les switches Aruba Instant On via interface web locale.
Ces switches n'ont pas de CLI SSH — l'administration se fait uniquement via navigateur web.

**Méthode d'accès confirmée :** Playwright + protocole WCD XML (confirmé sur firmware 2.6.0.0)
**Curl ne fonctionne pas** : le login utilise du JavaScript avec chiffrement RSA — impossible à reproduire en curl.

---

## Identification

**Modèles concernés :**
- Aruba Instant On 1930 (8, 24, 48 ports — avec ou sans PoE)
- Aruba Instant On 1960 (24, 48 ports — avec PoE+/PoE++)

**Accès local :** `http://<IP_du_switch>/`
- HTTP fonctionne même sur firmware récent (2.6.x confirmé)
- Login par défaut : `admin` / (voir étiquette sous le switch)
- Interface : SPA basée sur HPE Web UI (framework propriétaire)

---

## Protocole WCD XML (confirmé)

L'interface web Aruba Instant On utilise un protocole propriétaire **WCD (Web Configuration Device)**.
Ce n'est PAS une API REST JSON. Les réponses sont du XML.

**Structure des URLs :**
```
http://<IP>/cs<SESSION_ID>/hpe/wcd?{EndpointName}
```

Le `SESSION_ID` est un identifiant hexadécimal persistant visible dans l'URL après login (ex: `cs236fac9e`).
Il ne change pas entre sessions sur le même switch.

**Plusieurs sections peuvent être groupées dans une seule requête :**
```
http://<IP>/cs<SID>/hpe/wcd?{SystemGlobalSetting}{VLANList}{VLANInterfaceMembershipTable}
```

---

## Mécanisme de login (RSA JavaScript — OBLIGATOIRE via Playwright)

Le login Aruba utilise du JavaScript embarqué dans la page :
1. La page fait GET `/device/wcd?{EncryptionSetting}` → reçoit une clé RSA publique
2. Le JavaScript chiffre le mot de passe avec RSA
3. La page POSTe les credentials chiffrés à `system.xml?action=login&cred=<RSA_HASH>`

**Ce flux ne peut pas être reproduit avec curl.** Playwright doit appeler `formSubmit()` directement.

### Script Node.js Playwright (confirmé fonctionnel)

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(`http://${IP}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#inputUsername', { timeout: 15000 });
  await page.fill('#inputUsername', USER);
  await page.fill('#inputPassword', PASSWORD);

  // NE PAS cliquer le bouton — appeler formSubmit() directement (gère le RSA)
  await page.evaluate(() => {
    if (typeof formSubmit === 'function') formSubmit();
    else document.querySelector('#signinForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await page.waitForURL(/home\.htm/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Extraire le session ID depuis l'URL (ex: /cs236fac9e/)
  const sessionId = page.url().match(/\/(cs[a-f0-9]+)\//)?.[1];
  const wcdBase = `http://${IP}/${sessionId}/hpe/wcd`;

  // Requêter les endpoints WCD via fetch() interne (cookies inclus automatiquement)
  const data = await page.evaluate(async ({ base }) => {
    const get = async (ep) => {
      const r = await fetch(`${base}?${ep}`, { credentials: 'include' });
      return r.text();
    };
    return {
      system:   await get('{SystemGlobalSetting}'),
      ports:    await get('{Ports}'),
      poe:      await get('{PoEPSEInterfaceList}'),
      vlans:    await get('{VLANList}'),
      members:  await get('{VLANInterfaceMembershipTable}'),
      lldp_med: await get('{LLDPMEDNeighborList}'),
      mac:      await get('{ForwardingTable}'),
      arp:      await get('{ARPList}'),
    };
  }, { base: wcdBase });

  await browser.close();
})();
```

---

## Endpoints WCD confirmés

Confirmés sur firmware InstantOn_1930_2.6.0.0 — HTTP 200 avec données réelles.

| Endpoint | Taille typique | Données |
|----------|---------------|---------|
| `{SystemGlobalSetting}` | ~1.6 KB | hostname, firmware, MAC, serial, modèle |
| `{Ports}` | ~20 KB | statut (up/down), vitesse, PoE supporté par port |
| `{PoEPSEInterfaceList}` | ~52 KB | statut PoE par port, puissance délivrée |
| `{VLANList}` | ~2.5 KB | liste des VLANs avec ID et nom |
| `{VLANInterfaceMembershipTable}` | ~5.5 KB | ports tagged/untagged par VLAN |
| `{LLDPMEDNeighborList}` | variable | **voisins LLDP-MED** : IP, MAC, nom, modèle, fabricant, VLAN voix |
| `{ForwardingTable}` | ~14 KB | **table MAC** : MAC → port + VLAN |
| `{ARPList}` | variable | **table ARP** : IP → MAC → interface VLAN |
| `{DiagnosticsUnitList}` | ~0.9 KB | informations matérielles |
| `{ConnectedUserList}` | ~0.5 KB | sessions admin actives |

**Endpoints NON disponibles (ancienne API, statusCode=-1) :**
- `{LldpRemoteSystemsData}`, `{LldpPortConfig}`, `{LldpConfig}`, `{LldpNeighbor}` etc. — ancienne API LLDP (minuscules)
- Ces endpoints retournent HTTP 200 mais avec `<statusCode>-1</statusCode>`.
- **Utiliser `{LLDPMEDNeighborList}` (majuscules) qui fonctionne.**

Pour la carte complète de tous les endpoints par section UI, voir `references/aruba-wcd-api-map.md`.

---

## Format des réponses XML

### `{SystemGlobalSetting}`

```xml
<SystemGlobalSetting type="section">
  <systemName>CBTP-SW01-972</systemName>
  <systemDescription>Aruba Instant On 1930 48G ... JL686B, InstantOn_1930_2.6.0.0 (74)</systemDescription>
  <MACAddress>88:25:10:93:b4:66</MACAddress>
  <firmwareVersion>InstantOn_1930_2.6.0.0 (74)</firmwareVersion>
  <serialNumber>CN37LB4224</serialNumber>
</SystemGlobalSetting>
```

### `{Ports}`

```xml
<port>
  <portName>8</portName>           <!-- numéro de port -->
  <operStatus>1</operStatus>        <!-- 1=UP, 2=DOWN -->
  <adminStatus>1</adminStatus>      <!-- 1=enabled -->
  <ifSpeed>1000</ifSpeed>           <!-- vitesse en Mbps -->
  <POESupported>1</POESupported>    <!-- 1=PoE supporté physiquement -->
</port>
```

### `{PoEPSEInterfaceList}`

```xml
<Interface>
  <interfaceName>8</interfaceName>
  <adminEnable>1</adminEnable>          <!-- 1=PoE activé -->
  <detectionStatus>3</detectionStatus>  <!-- 2=no device, 3=delivering power -->
  <outputPower>3400</outputPower>       <!-- puissance en mW -->
</Interface>
```

### `{VLANInterfaceMembershipTable}`

```xml
<Entry>
  <VLANID>100</VLANID>
  <VLANName>TOIP</VLANName>
  <taggedPorts>1-3,6-21,25-40,42-46,48,49-52</taggedPorts>   <!-- ports trunk -->
  <untaggedPorts>47</untaggedPorts>                            <!-- port access VLAN 100 -->
</Entry>
```

**Lecture :** `untaggedPorts` = access VLAN de ces ports. `taggedPorts` = ports trunk.
Pour trouver le VLAN access d'un port, chercher ce port dans `untaggedPorts` de chaque VLAN.

### `{LLDPMEDNeighborList}` (voisins LLDP-MED)

```xml
<NeighborEntry>
  <interfaceName>8</interfaceName>            <!-- port du switch -->
  <deviceID>192.168.210.34</deviceID>         <!-- IP du device -->
  <advertisedPortID>08:00:0f:4b:2c:e6</advertisedPortID>  <!-- MAC du device -->
  <systemName>regDN 102,MITEL 5320 IP</systemName>
  <systemDescription>regDN 102,MITEL 5320 IP,...,f/w Main 06.05.00.18</systemDescription>
  <MEDDeviceType>3</MEDDeviceType>            <!-- 1=switch/routeur, 3=téléphone IP -->
  <InvntryMfrName>Mitel Corporation</InvntryMfrName>
  <InvntryModelName>MITEL 5320 IP</InvntryModelName>
  <InvntrySWRev>Main 06.05.00.18</InvntrySWRev>
  <PDPowerRequired>47</PDPowerRequired>       <!-- en 100mW (47 = 4.7W) -->
  <NetworkPolicyList>
    <NetworkPolicyEntry>
      <VLANID>100</VLANID>                    <!-- VLAN voix configuré sur le téléphone -->
      <userPriority>3</userPriority>
      <DSCP>26</DSCP>
    </NetworkPolicyEntry>
  </NetworkPolicyList>
</NeighborEntry>
```

**`MEDDeviceType` :** 1=Network Connectivity Device, 3=Media Endpoint class III (téléphone IP).

### `{ForwardingTable}` (table MAC)

```xml
<Entry>
  <VLANID>1</VLANID>
  <MACAddress>00:13:b0:05:d0:ed</MACAddress>
  <interfaceName>39</interfaceName>    <!-- numéro de port -->
  <addressType>3</addressType>         <!-- 2=static, 3=dynamic -->
</Entry>
```

### `{ARPList}` (table ARP)

```xml
<ARPEntry>
  <interfaceName>VLAN90</interfaceName>
  <IPAddress>10.10.90.251</IPAddress>
  <physicalAddress>94:f3:92:43:0d:57</physicalAddress>
  <status>3</status>                   <!-- 3=dynamic -->
</ARPEntry>
```

**Réponse d'erreur (endpoint non supporté) :**
```xml
<ActionStatus>
  <requestURL>LldpRemoteSystemsData</requestURL>
  <statusCode>-1</statusCode>
  <statusString>Cannot find the section LldpRemoteSystemsData !</statusString>
</ActionStatus>
```

---

## Données disponibles

| Donnée | Via WCD | Endpoint |
|--------|---------|----------|
| Hostname, firmware, MAC, serial | ✓ | `{SystemGlobalSetting}` |
| Statut UP/DOWN et vitesse par port | ✓ | `{Ports}` |
| PoE delivering / puissance par port | ✓ | `{PoEPSEInterfaceList}` |
| VLANs configurés (nom, ID) | ✓ | `{VLANList}` |
| VLAN access/trunk par port | ✓ | `{VLANInterfaceMembershipTable}` |
| Voisins LLDP-MED (nom, modèle, IP, VLAN voix) | ✓ | `{LLDPMEDNeighborList}` |
| Table MAC (MAC → port) | ✓ | `{ForwardingTable}` |
| Table ARP (IP → MAC) | ✓ | `{ARPList}` |

---

## Heuristiques identification

Avec LLDP-MED disponible, la classification est fiable :

**`{LLDPMEDNeighborList}` + `MEDDeviceType=3` → téléphone IP confirmé** (confiance 95%)
- On a le fabricant (`InvntryMfrName`), le modèle (`InvntryModelName`), l'IP, la MAC
- On a le VLAN voix configuré sur le téléphone (`NetworkPolicyList/VLANID`)

**Sans LLDP-MED (port non visible dans LLDPMEDNeighborList) :**
- Port PoE `detectionStatus=3` + puissance 2000-6000 mW + VLAN TOIP/VOIX en untagged → phone probable (65%)
- Port PoE `detectionStatus=3` + vitesse 100M → probablement téléphone (70%)
- Port PoE `detectionStatus=3` + puissance > 10000 mW → AP probable (75%)
- Trunk multi-VLAN + PoE → AP probable (60%)
- Trunk multi-VLAN sans PoE → switch aval (70%)

**Croiser avec `{ForwardingTable}` + `{ARPList}` :**
- Table MAC → port : permet de confirmer la présence d'un device sur un port et son VLAN
- Table ARP → IP : permet de résoudre MAC en IP pour les équipements sur VLANs L3

---

## Workflow guidé manuel (fallback si Playwright indisponible)

```
ÉTAPE 1 — Connexion
→ Ouvre ton navigateur et va sur : http://<IP_SWITCH>/
→ Connecte-toi (utilisateur : admin / mot de passe : voir étiquette sous le switch)

ÉTAPE 2 — Capture des ports
→ Clique sur "Ports" dans le menu → copie-colle le tableau

ÉTAPE 3 — Voisins LLDP
→ Clique sur "Neighbor Discovery" → copie-colle le tableau

ÉTAPE 4 — Configuration VLANs
→ Clique sur "VLANs" → copie-colle la liste et la config
```
