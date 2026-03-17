---
name: aruba-instant-on
description: >
  Use this skill to collect data from Aruba Instant On 1930 and 1960 switches via their web interface.
  ALWAYS trigger when the user mentions Aruba Instant On, Aruba 1930, Aruba 1960, JL681A, JL682A,
  JL683A, JL684A, or an Aruba switch accessed via web UI. Uses Playwright + WCD XML protocol
  (RSA JavaScript login). Collects VLANs, MAC table, LLDP-MED, port status, PoE, ARP table.
  Also invoked programmatically by analysis skills.
  French triggers: "switch Aruba Instant On", "Aruba 1930", "Aruba 1960", "scanner le Aruba",
  "inventaire Aruba", "collecter le Aruba via le web", "switch Aruba".
  Do NOT use for Aruba ProVision/ProCurve 2530/2920 (SSH — use hp-procurve).
  Do NOT use for Aruba CX 6300/6400 (different OS). Do NOT use for Aruba APs (access points).
---

# Aruba Instant On — Collecte WCD XML via Playwright

Ce skill collecte les données d'un switch Aruba Instant On via le protocole WCD XML propriétaire.
**Curl ne fonctionne pas** : le login utilise RSA JavaScript. Playwright est obligatoire.

## Prérequis

```bash
node --version           # Node.js requis
npm install playwright   # package Playwright
npx playwright install chromium  # navigateur Chromium
```

## Collecte — Étape 1 : Demander les accès

Demander :
- Adresse IP du switch (ex: `10.10.90.201`)
- Mot de passe admin (étiquette sous le switch)

Nom d'utilisateur : `admin` par défaut.

## Collecte — Étape 2 : Exécuter le script de collecte

```bash
node <path>/scripts/collect_aruba.js <IP> <PASSWORD> C:/tmp/switch-data
```

Le script se connecte via Playwright, login via `formSubmit()` JavaScript (RSA), extrait le session ID depuis l'URL, puis requête les endpoints WCD directement depuis le contexte du navigateur (cookies automatiques).

**Si le script échoue :** mauvais mot de passe ou switch inaccessible. Vérifier et redemander.

## Collecte — Étape 3 : Vérifier les fichiers produits

Structure de sortie normalisée (commune à tous les vendors) :

```
C:/tmp/switch-data/<HOSTNAME>/
├── metadata.json      ← hostname, ip, vendor, model, firmware, mac, serial, collectedAt
├── system.xml
├── ports.xml
├── poe.xml
├── vlans.xml
├── members.xml
├── lldp_med.xml
├── mac.xml
└── arp.xml
```

Si les fichiers XML sont vides ou < 100 bytes, ou `metadata.json` absent → login a échoué.

## Parsing — Étape 4 : Interpréter les données XML

Lire `references/aruba-instant-on.md` pour le format XML détaillé.
Lire `references/aruba-wcd-api-map.md` pour la carte complète de tous les endpoints WCD.

### Ports (`ports.xml`)

```xml
<port>
  <portName>8</portName>
  <operStatus>1</operStatus>   <!-- 1=UP, 2=DOWN -->
  <ifSpeed>100</ifSpeed>       <!-- Mbps -->
  <POESupported>1</POESupported>
</port>
```

### PoE (`poe.xml`)

```xml
<Interface>
  <interfaceName>8</interfaceName>
  <detectionStatus>3</detectionStatus>  <!-- 2=no device, 3=delivering power -->
  <outputPower>3400</outputPower>        <!-- mW -->
</Interface>
```

### VLANs — accès/trunk par port (`members.xml`)

```xml
<Entry>
  <VLANID>100</VLANID>
  <VLANName>TOIP</VLANName>
  <untaggedPorts>47</untaggedPorts>    <!-- VLAN access pour ces ports -->
  <taggedPorts>1-46,48-52</taggedPorts> <!-- ports trunk transportant ce VLAN -->
</Entry>
```

Pour trouver le VLAN access d'un port, chercher ce port dans `untaggedPorts` de chaque VLAN.

### Voisins LLDP-MED (`lldp_med.xml`)

```xml
<NeighborEntry>
  <interfaceName>8</interfaceName>            <!-- port du switch -->
  <deviceID>192.168.210.34</deviceID>         <!-- IP du device -->
  <advertisedPortID>08:00:0f:4b:2c:e6</advertisedPortID>
  <systemName>regDN 102,MITEL 5320 IP</systemName>
  <MEDDeviceType>3</MEDDeviceType>            <!-- 3=téléphone IP -->
  <InvntryMfrName>Mitel Corporation</InvntryMfrName>
  <InvntryModelName>MITEL 5320 IP</InvntryModelName>
  <NetworkPolicyList>
    <NetworkPolicyEntry>
      <VLANID>100</VLANID>                    <!-- VLAN voix configuré sur le phone -->
    </NetworkPolicyEntry>
  </NetworkPolicyList>
</NeighborEntry>
```

**`MEDDeviceType` :** 1=switch/routeur, 3=téléphone IP/endpoint class III.

⚠️ **LLDP-MED fonctionne via `{LLDPMEDNeighborList}`.** Les anciens endpoints `{Lldp*}` (minuscules) retournent statusCode=-1.

### Table MAC (`mac.xml`)

```xml
<Entry>
  <VLANID>1</VLANID>
  <MACAddress>00:13:b0:05:d0:ed</MACAddress>
  <interfaceName>39</interfaceName>   <!-- port du switch -->
  <addressType>3</addressType>        <!-- 3=dynamic -->
</Entry>
```

### Table ARP (`arp.xml`)

```xml
<ARPEntry>
  <interfaceName>VLAN90</interfaceName>
  <IPAddress>10.10.90.251</IPAddress>
  <physicalAddress>94:f3:92:43:0d:57</physicalAddress>
</ARPEntry>
```

## Identification des équipements

**Avec LLDP-MED (`lldp_med.xml`) :**

| Signal | Type | Confiance |
|--------|------|-----------|
| MEDDeviceType=3 | Téléphone IP | 95% |
| systemName contient AP/WiFi ou puissance PoE > 10W | AP WiFi | 85% |

**Sans LLDP-MED (port absent de lldp_med.xml) :**

| Signal | Type probable | Confiance |
|--------|-------------|-----------|
| PoE detectionStatus=3 + vitesse 100M + VLAN TOIP/VOIX | Phone IP | 65% |
| PoE detectionStatus=3 + puissance > 10000 mW | AP WiFi | 65% |
| Trunk multi-VLAN + PoE | AP WiFi | 55% |
| Trunk multi-VLAN + sans PoE | Switch aval | 70% |

**Après identification :** retourner les données structurées au skill `network-switch-analysis` pour l'analyse et le rapport.

## Références

- `references/aruba-instant-on.md` — protocole WCD, format XML, login RSA, endpoints confirmés
- `references/aruba-wcd-api-map.md` — carte complète de tous les endpoints WCD par section UI
- `scripts/collect_aruba.js` — script de collecte Playwright complet
