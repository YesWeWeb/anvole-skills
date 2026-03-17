# Référence Aruba AOS-CX

Formats de sortie des commandes CLI Aruba AOS-CX (gamme CX 6200, 6300, 6400, 8320, 8360, etc.).

---

## Détection Aruba AOS-CX

Indices dans les outputs :
- Ligne `ArubaOS-CX` dans la description du système
- Prompt du style `switch# ` ou `switch(config)#`
- Output de `show version` contenant `ArubaOS-CX`
- Commande `show mac-address-table` (avec tiret, différent de Cisco)

---

## show mac-address-table

### Format AOS-CX
```
MAC age-time    : 300 seconds
Number of MAC addresses : 6

MAC Address          VLAN    Type    Port
-----------------  ------  ------  -----------
00:26:99:41:ab:cd      10  dynamic  1/1/5
f8:b1:56:aa:00:11      10  dynamic  1/1/5
80:5e:c0:12:34:56      20  dynamic  1/1/8
a0:b1:c2:d3:e4:f5      99  dynamic  1/1/48
08:00:27:aa:bb:cc       1  dynamic  1/1/3
```

**Parsing :**
- Format MAC : `xx:xx:xx:xx:xx:xx` (notation UNIX standard — différent de Cisco)
- Format port : `1/1/X` (module/slot/port) — notation propre à AOS-CX
- `dynamic` = appris dynamiquement
- `static` / `permanent` = configuré ou MAC management du switch

---

## show running-config (extrait interfaces)

### Format AOS-CX
```
interface 1/1/1
    no shutdown
    description PC-RH
    vlan access 10
    spanning-tree bpdu-guard
    spanning-tree port-type admin-edge
!
interface 1/1/5
    no shutdown
    description Phone-IP-Dupont
    vlan access 10
    voice-vlan 20
    spanning-tree port-type admin-edge
!
interface 1/1/48
    no shutdown
    description Uplink-Core
    vlan trunk native 1
    vlan trunk allowed 1,10,20,99
!
interface 1/1/49
    shutdown
!
```

**Différences clés avec Cisco IOS :**
- `vlan access X` au lieu de `switchport access vlan X`
- `voice-vlan X` au lieu de `switchport voice vlan X`
- `vlan trunk allowed X,Y` au lieu de `switchport trunk allowed vlan X,Y`
- `spanning-tree port-type admin-edge` équivalent de `spanning-tree portfast`
- `no shutdown` explicite (sur AOS-CX les ports sont up par défaut)

---

## show lldp neighbor-info detail

```
LLDP Neighbor Information
=========================

Port        : 1/1/5
Neighbor    : 00:26:99:41:ab:cd
Chassis-id  : 00:26:99:41:ab:cd
Port-id     : Port 1
TTL         : 120
System-name : SEP002699 41ABCD
System-descr: Cisco IP Phone CP-8841, V14-3-1SR3-1

System capabilities
  Supported  : Bridge, Telephone
  Enabled    : Bridge, Telephone

Management addresses
  IPV4        : 10.0.10.45

Port VLAN ID (PVID): 10
Port & Protocol VLAN
  VLAN id     : 20
  VLAN name   : VOICE

---

Port        : 1/1/48
Neighbor    : a0:b1:c2:d3:e4:f5
Chassis-id  : a0:b1:c2:d3:e4:f5
Port-id     : 1/1/1
TTL         : 110
System-name : SW-CORE

System capabilities
  Supported  : Bridge, Router
  Enabled    : Bridge

Management addresses
  IPV4        : 10.0.99.1
```

**Parsing :**
- `System capabilities / Enabled` → capabilities texte (pas bits comme Cisco)
  - `Telephone` → phone IP
  - `Bridge` → switch
  - `WLAN Access Point` → AP WiFi
  - `Station Only` ou `Station` → endpoint PC
- `Port VLAN ID (PVID)` → VLAN natif/access du voisin
- `Port & Protocol VLAN` → VLAN(s) transportés (voice VLAN du phone)

---

## show interface [port]

```
Interface 1/1/5 is up
Admin state is up
Hardware: Ethernet, MAC Address: aa:bb:cc:dd:ee:ff
Description: Phone-IP-Dupont
MTU 1500
Full-duplex, Auto-speed, Auto-negotiation
...
Input Statistics:
  ...
```

---

## show vlan

```
VLAN  Name                             Status    Interfaces
----  ------                           --------  ----------
1     DEFAULT_VLAN_1                   up        1/1/1, 1/1/2, 1/1/3
10    DATA                             up        1/1/1, 1/1/2, 1/1/4, 1/1/5
20    VOICE                            up        1/1/5, 1/1/8
99    MGMT                             up        1/1/48
```

---

## Commandes à demander selon le besoin

| Objectif | Commande AOS-CX |
|----------|----------------|
| Table MAC complète | `show mac-address-table` |
| Config complète | `show running-config` |
| Statut interfaces | `show interface brief` |
| Voisins LLDP | `show lldp neighbor-info detail` |
| VLANs | `show vlan` |
| Version | `show version` |

---

## Notes importantes AOS-CX

- AOS-CX utilise une architecture **OVSDB** (base de données distribuée) — la config est très différente d'IOS en syntaxe mais logiquement similaire
- Pas de CDP sur AOS-CX (sauf si mode compatibilité Cisco activé)
- LLDP est activé par défaut
- Les ports s'appellent `1/1/X` (chassis/slot/port) pour les switches fixes
- Sur les châssis modulaires (8400) : `1/X/Y` où X = numéro de carte
