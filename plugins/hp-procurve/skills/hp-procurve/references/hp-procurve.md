# Référence HP ProCurve / Aruba ProVision — SSH CLI

Guide de collecte de données pour les switches HP ProCurve via SSH.

**Méthode d'accès confirmée :** SSH + CLI ProVision (confirmé sur firmware RA.15.10.0010)

---

## Identification

**Modèles concernés :**
- HP 2620 (J9625A, J9626A) — ProVision firmware RA.xx
- HP 2530 (J9776A, J9781A) — ProVision firmware YA.xx
- HP 2920 (J9726A, J9727A) — ProVision firmware WB.xx
- HP 3800 (J9575A, J9576A) — ProVision firmware KB.xx
- Aruba 2530, 2540, 2930F/M — ProVision firmware

**Firmware testé :** RA.15.10.0010 — Switch CRCP-SW02-971 (HP 2620-24-PoEP, J9625A)

---

## Connexion SSH

- SSH standard port 22
- **Pas de double authentification** (contrairement à Cisco SB)
- Banner "Press any key to continue" au démarrage → envoyer un espace
- Pager `-- MORE --` → envoyer espace, ou désactiver avec `no page`
- Prompt : `HOSTNAME# ` ou `HOSTNAME> `

### Algorithmes SSH legacy

```javascript
algorithms: {
  serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-dss'],
  kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
  cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc'],
}
```

---

## Commandes confirmées (firmware RA.15.10.0010)

| Commande | Fichier | Données |
|----------|---------|---------|
| `no page` | — | Désactive le pager |
| `show version` | version.txt | Firmware, date build |
| `show vlans` | vlans.txt | 14 VLANs : ID, nom, status, voice, jumbo |
| `show interfaces brief` | interfaces.txt | 26 ports : type, état, vitesse, mode |
| `show mac-address` | mac.txt | Table MAC : MAC → port + VLAN (48 entrées) |
| `show lldp info remote-device` | lldp.txt | Voisins LLDP : port, chassis, sysname (9 voisins) |
| `show running-config` | running_config.txt | Config VLAN par port |
| `show power-over-ethernet brief` | poe.txt | PoE par port : enable, power, status, class |

### Commandes KO sur RA.15.10.0010

- `show lldp info remote-device detail` → "Module not present for port or invalid port: detail"
  - **Utiliser `show lldp info remote-device`** (sans detail)

---

## Format des sorties

### show vlans

```
  VLAN ID Name                             | Status     Voice Jumbo
  ------- -------------------------------- + ---------- ----- -----
  1       DEFAULT_VLAN                     | Port-based No    No
  100     ToIP                             | Port-based No    No
  666     Blackhole                        | Port-based No    No
```

### show mac-address

```
  MAC Address   Port  VLAN
  ------------- ----- ----
  08000f-61a346 4     1
  08000f-69cb4a 8     100
  70fc8c-a1e7a0 24    100
```

**Format MAC HP :** 6 hex sans séparateurs, groupes de 6 : `08000f-61a346`
Pour convertir : `08:00:0f:61:a3:46`

### show lldp info remote-device

```
  LocalPort | ChassisId                 PortId PortDescr SysName
  --------- + ------------------------- ------ --------- ----------------------
  4         | 1.5.0.0                   08 ... LAN port  regDN 224,MITEL 532...
  26        | d4e053-5a5923             30     30        CBTP-SW01-971
```

**Colonnes tronquées** — le format résumé coupe les champs longs.
Pour le détail par port : `show lldp info remote-device <port>` (non testé).

### show power-over-ethernet brief

```
  PoE   | Power  Power    Alloc Alloc Actual Configured  Detection   Power
  Port  | Enable Priority By    Power Power  Type        Status      Class
  ----- + ------ -------- ----- ----- ------ ----------- ----------- -----
  4     | Yes    low      usage 17 W  2.4 W              Delivering  2
  6     | Yes    low      usage 17 W  0.0 W              Searching   0
```

### show running-config

Config ProVision — VLAN assigné via blocs :
```
vlan 1
   name "DEFAULT_VLAN"
   untagged 1-3,6,10-12,14-15,17-18,20-22
   no ip address
   exit
vlan 100
   name "ToIP"
   tagged 26
   untagged 4-5,7-9,13,16,19,23-24
   exit
```

`untagged` = VLAN access pour ces ports
`tagged` = ports trunk transportant ce VLAN
