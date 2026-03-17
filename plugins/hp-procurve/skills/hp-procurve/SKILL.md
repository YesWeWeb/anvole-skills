---
name: hp-procurve
description: >
  Use this skill to collect data from HP ProCurve and Aruba ProVision switches via SSH CLI. ALWAYS
  trigger for HP 2530, HP 2620, HP 2920, HP 3800, Aruba 2530, Aruba 2920, or any switch running
  ProVision/ProCurve firmware with SSH access. Also matches part numbers J9625A, J9776A, J9773A,
  J9727A. Collects VLANs, MAC table, LLDP neighbors, port status, PoE via SSH CLI commands.
  Also invoked programmatically by analysis skills.
  French triggers: "switch HP", "inventaire HP 2530", "collecter le ProCurve", "HP en SSH",
  "switch HP ProCurve", "Aruba 2530", "config du HP", "VLAN HP", "table MAC HP".
  Do NOT use for HP OfficeConnect 1920/1920S (web-only, no SSH — use hp-officeconnect).
  Do NOT use for Aruba Instant On 1930/1960 (use aruba-instant-on).
  Do NOT use for Aruba CX switches (different OS).
---

# HP ProCurve / Aruba ProVision — Collecte SSH

Ce skill collecte les données d'un switch HP ProCurve via SSH (CLI ProVision).

## Prérequis

```bash
node --version        # Node.js requis
npm install ssh2      # package SSH
```

## Collecte — Étape 1 : Demander les accès

Demander :
- Adresse IP du switch
- Mot de passe admin
- Nom d'utilisateur (par défaut : `admin`)

## Collecte — Étape 2 : Exécuter le script de collecte

```bash
node <path>/scripts/collect_hp_ssh.js <IP> <PASSWORD> C:/tmp/switch-data [USERNAME]
```

Le script se connecte en SSH, gère le banner "Press any key to continue", désactive le pager (`no page`), puis exécute 7 commandes CLI.

## Collecte — Étape 3 : Vérifier les fichiers produits

```bash
ls -la C:/tmp/switch-data/<HOSTNAME>/
# metadata.json, version.txt, vlans.txt, interfaces.txt, mac.txt, lldp.txt, running_config.txt, poe.txt
```

## Parsing — Étape 4 : Interpréter les données

Lire `references/hp-procurve.md` pour le format CLI détaillé.

### show version (`version.txt`)
```
Image stamp: /ws/swbuildm/.../code/build/xform(...)
             Mar  1 2013 13:16:13
             RA.15.10.0010
```

### show vlans (`vlans.txt`)
```
  VLAN ID Name                             | Status     Voice Jumbo
  ------- -------------------------------- + ---------- ----- -----
  1       DEFAULT_VLAN                     | Port-based No    No
  100     ToIP                             | Port-based No    No
```

### show mac-address (`mac.txt`)
```
  MAC Address   Port  VLAN
  ------------- ----- ----
  08000f-61a346 4     1
  08000f-69cb4a 8     100
```
Format MAC : 6 hex sans séparateurs par groupes de 6 (`08000f-61a346`)

### show lldp info remote-device (`lldp.txt`)
```
  LocalPort | ChassisId          PortId PortDescr SysName
  --------- + ------------------ ------ --------- ----------------------
  4         | 1.5.0.0            08 ... LAN port  regDN 224,MITEL 532...
  26        | d4e053-5a5923      30     30        CBTP-SW01-971
```

### show power-over-ethernet brief (`poe.txt`)
```
  Port  | Enable Priority By    Power  Actual  Type   Detection   Class
  ----- + ------ -------- ----- ------ ------  ------ ----------- -----
  4     | Yes    low      usage 17 W   2.4 W          Delivering  2
  6     | Yes    low      usage 17 W   0.0 W          Searching   0
```

### show running-config (`running_config.txt`)
Config HP ProVision : `vlan X untagged Y` / `vlan X tagged Z`

## Identification des équipements

| Signal | Type | Confiance |
|--------|------|-----------|
| LLDP SysName contient "MITEL" ou "MINET" | Téléphone IP | 90% |
| LLDP SysName = switch connu | Switch aval/amont | 95% |
| PoE Delivering + LLDP phone | Phone IP confirmé | 95% |
| PoE Delivering sans LLDP | Device PoE inconnu | 50% |

## Références

- `references/hp-procurve.md` — protocole SSH, format CLI ProVision, commandes confirmées
- `scripts/collect_hp_ssh.js` — script de collecte SSH complet
