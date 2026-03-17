---
name: cisco-sb
description: >
  Use this skill to collect data from Cisco Small Business switches (SG300, SG500, SG350, SG350X,
  CBS220, CBS250, CBS350). ALWAYS trigger when the user mentions any Cisco SG or CBS model switch,
  or says "Cisco Small Business", or wants to inventory/export config from a Cisco switch that is NOT
  a Catalyst/IOS/Nexus. These switches run proprietary SMB firmware, not Cisco IOS. Collects VLANs,
  MAC table, LLDP neighbors, port status, PoE, running-config via SSH. Also invoked programmatically
  by analysis skills. French triggers: "switch Cisco", "inventaire Cisco SG350", "collecter le CBS250",
  "config du Cisco", "table MAC Cisco", "VLAN Cisco", "switch Cisco en SSH".
  Do NOT use for Cisco Catalyst, IOS, IOS-XE, Nexus, Meraki, or ISR routers.
---

# Cisco Small Business — Collecte SSH

Ce skill collecte les données des switches Cisco Small Business (SG300, SG500, CBS) via SSH.
**Firmware propriétaire SMB** — pas Cisco IOS. Syntaxe CLI différente.

## Prérequis

```bash
node --version   # Node.js requis
npm install ssh2  # module SSH
```

## Collecte — Étape 1 : Demander les accès

Demander :
- Adresse IP du switch (ex: `10.10.90.202`)
- Mot de passe admin (étiquette sous le switch)
- Port SSH (défaut : 22)

Nom d'utilisateur : `admin` par défaut (parfois `cisco`).

## Collecte — Étape 2 : Exécuter le script de collecte

```bash
node <path>/scripts/collect_cisco_ssh.js <IP> <PASSWORD> C:/tmp/switch-data
```

**Double authentification :** le firmware SG300/SG500 demande user/password une DEUXIÈME fois dans le shell après connexion SSH. Le script gère cela automatiquement.

**Le script gère automatiquement :**
- Double authentification shell (User Name + Password)
- Pager `More:` — envoie espace automatiquement, sans dépendre de `terminal length 0`
- `terminal length 0` échoue sur firmware 1.4.x (`% Unrecognized command`) → ignoré, le pager est géré par détection de prompt
- Extraction du hostname depuis le prompt SSH → répertoire nommé automatiquement

**Si le script échoue :**
- `Connection refused` → SSH désactivé → activer via interface web (Administration → Management Interface → SSH)
- Authentification échouée → vérifier mot de passe et username (`admin` ou `cisco`)
- Timeout → augmenter `readyTimeout` dans le script

## Collecte — Étape 3 : Vérifier les fichiers produits

Structure de sortie normalisée (commune à tous les vendors) :

```
C:/tmp/switch-data/<HOSTNAME>/
├── metadata.json       ← hostname, ip, vendor, model, firmware, mac, serial, collectedAt
├── version.txt         ← show version
├── system.txt          ← show system
├── ip_interface.txt    ← show ip interface
├── interfaces.txt      ← show interfaces status
├── vlans.txt           ← show vlan
├── mac.txt             ← show mac address-table
├── lldp.txt            ← show lldp neighbors
└── running_config.txt  ← show running-config
```

Si les fichiers sont vides ou `metadata.json` absent → double auth non gérée ou login échoué.

## Parsing — Étape 4 : Interpréter l'output CLI

Lire `references/cisco-sb.md` pour le format détaillé.

### `show mac address-table`

```
Vlan    Mac Address       Type       Ports
   1    aa:bb:cc:dd:ee:ff Dynamic    gi5
  10    11:22:33:44:55:66 Dynamic    gi12
```

Format MAC : `xx:xx:xx:xx:xx:xx` avec `:` (différent de Cisco IOS).

### `show interfaces status`

```
gi1  1G-Copper  Full  100M   Enabled  Up
gi2  1G-Copper  Full  1000M  Enabled  Up
gi3  1G-Copper         Auto  Enabled  Down
```

### `show vlan` — membership par port

```
VLAN  Name      Status  Ports
1     Default   active  gi1-gi52
10    DATA      active  gi1-gi24
20    VOIX      active  gi1-gi12, gi24(T)
```

`(T)` = port taggé (trunk), sinon non-taggé (access).

### `show lldp neighbors gi<N>` (firmware 1.4.x)

⚠️ `show lldp neighbors detail` → "Wrong number of parameters" sur firmware 1.4.x.
Utiliser `show lldp neighbors gi<N>` pour chaque port d'intérêt.

```
Device ID: 88:25:10:93:b4:66
Capabilities: Bridge
System Name: SW-ARUBA
```

Capabilities : `B`=Bridge, `T`=Telephone, `W`=WLAN AP, `H`=Host, `R`=Router.

### `show running-config interface gi<N>` (firmware 1.4.x)

⚠️ `show interfaces gi<N> switchport` → "Unrecognized command" sur firmware 1.4.x.

```
interface gigabitethernet44
 switchport trunk allowed vlan add 100
!
```

## Commandes à collecter systématiquement

```
terminal length 0                    ← désactiver le pager (TOUJOURS en premier)
show version
show system
show interfaces status
show vlan
show mac address-table
show lldp neighbors
show running-config
```

## Après identification : passer au rapport

Retourner les données structurées au skill `network-switch-analysis` pour l'analyse et le rapport.

## Références

- `references/cisco-sb.md` — commandes, formats, double auth, firmware quirks
- `scripts/collect_cisco_ssh.js` — script de collecte SSH complet avec double auth
