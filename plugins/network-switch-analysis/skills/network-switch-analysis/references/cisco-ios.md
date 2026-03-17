# Référence Cisco IOS / IOS-XE

Formats de sortie des commandes CLI Cisco IOS et IOS-XE (Catalyst 2960, 3xxx, 9xxx, etc.).

---

## Détection Cisco IOS

Indices dans les outputs :
- Ligne `Cisco IOS Software, Version XX.XX`
- Prompt du style `Switch#`, `SW-CORE#`, `hostname#`
- Copyright `Copyright (c) 1986-20XX by Cisco Systems`

---

## show mac address-table

### Format standard (IOS)
```
          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    aabb.cc11.2233    DYNAMIC     Gi1/0/3
  10    0026.9941.abcd    DYNAMIC     Gi1/0/5
  10    f8b1.56aa.0011    DYNAMIC     Gi1/0/5
  20    0026.9941.abcd    DYNAMIC     Gi1/0/5
  99    0050.56a1.0001    STATIC      Vl99
Total Mac Addresses for this criterion: 5
```

**Parsing :**
- Colonnes : `Vlan | Mac Address | Type | Ports`
- Format MAC : groupes de 4 hex séparés par `.` (ex: `aabb.cc11.2233`)
- Convertir en notation standard : `aa:bb:cc:11:22:33`
- `DYNAMIC` = appris dynamiquement ; `STATIC` = configuré manuellement
- Un port avec plusieurs MACs = équipement en cascade ou phone avec PC
- Interface `Vl99` = VLAN interface (ne pas confondre avec port physique)

### Variante IOS-XE (Catalyst 9xxx)
Format identique, parfois avec colonne supplémentaire `Move` ou `Secure`.

---

## show interfaces status

```
Port      Name               Status       Vlan       Duplex  Speed Type
Gi1/0/1   PC-Comptabilite    connected    10         a-full  a-100 10/100/1000BaseTX
Gi1/0/2                      connected    10         a-full  a-1G  10/100/1000BaseTX
Gi1/0/3                      notconnect   1          auto    auto  10/100/1000BaseTX
Gi1/0/24  Uplink-SW-CORE     connected    trunk      a-full  a-1G  10/100/1000BaseTX
Gi1/0/25  Uplink-FO          connected    trunk      full    10G   SFP-10GBase-LR
```

**Parsing :**
- `connected` = port actif avec un équipement branché
- `notconnect` = port sans équipement ou câble débranché
- `Vlan` = numéro de VLAN access, ou `trunk` si port trunk
- `Name` = description configurée sur l'interface (souvent le nom de l'équipement)
- `a-full`/`a-100` = auto-négocié, full duplex, 100 Mbps

---

## show running-config (extrait interfaces)

```
interface GigabitEthernet1/0/1
 description PC-Comptabilite
 switchport access vlan 10
 switchport mode access
 spanning-tree portfast
!
interface GigabitEthernet1/0/5
 description Phone-IP-Dupont
 switchport access vlan 10
 switchport mode access
 switchport voice vlan 20
 spanning-tree portfast
!
interface GigabitEthernet1/0/24
 description Uplink-SW-CORE
 switchport mode trunk
 switchport trunk allowed vlan 1,10,20,99
!
interface GigabitEthernet1/0/48
 shutdown
!
```

**Parsing :**
- `switchport mode access` → port access
- `switchport mode trunk` → port trunk
- `switchport access vlan X` → VLAN data assigné
- `switchport voice vlan X` → VLAN voix configuré (port avec phone IP)
- `switchport trunk allowed vlan X,Y,Z` → VLANs autorisés sur trunk
- `spanning-tree portfast` → port connecté à un endpoint (non-switch)
- `shutdown` → port désactivé
- `description` → étiquette libre, souvent le nom de l'équipement

---

## show lldp neighbors detail

```
------------------------------------------------
Local Intf: Gi1/0/5
Chassis id: 0026.9941.abcd
Port id: Port 1
Port Description: SW Port
System Name: SEP00269941ABCD

System Description:
Cisco IP Phone CP-8841, V14-3-1SR3-1

Time remaining: 116 seconds
System Capabilities: B, T
Enabled Capabilities: B, T

Management Addresses:
    IP: 10.0.10.45

Auto Negotiation - supported, enabled
Physical media capabilities:
    1000baseT(HD)
    100base-TX(FD)
    100base-TX(HD)
    10base-T(FD)
    10base-T(HD)
Media Attachment Unit type: 16
Vlan ID: 20
------------------------------------------------
Local Intf: Gi1/0/24
Chassis id: a0b1.c2d3.e4f5
Port id: Gi0/1
Port Description: Link to SW-ETAGE1
System Name: SW-ETAGE1

System Description:
Cisco IOS Software, Catalyst C2960S

System Capabilities: B
Enabled Capabilities: B

Management Addresses:
    IP: 10.0.99.2
------------------------------------------------
```

**Parsing :**
- `System Capabilities` et `Enabled Capabilities` : clés de classification
  - `T` (Telephone) → Phone IP
  - `B` (Bridge) → switch ou AP avec pont
  - `W` (WLAN Access Point) → AP WiFi
  - `S` (Station) → endpoint PC
  - `R` (Router) → routeur
- `System Name` → hostname de l'équipement distant
- `System Description` → modèle détaillé (très utile : "Cisco IP Phone CP-8841")
- `Vlan ID` → VLAN de management de l'équipement (souvent VLAN voix pour phones)
- `Management Addresses` → IP de l'équipement distant

---

## show cdp neighbors detail

```
-------------------------
Device ID: SEP00269941ABCD
Entry address(es):
  IP address: 10.0.10.45
Platform: Cisco IP Phone CP-8841,  Capabilities: Host Phone
Interface: GigabitEthernet1/0/5,  Port ID (outgoing port): Port 1
Holdtime : 140 sec

Version :
Cisco IP Phone CP-8841, V14-3-1SR3-1

advertisement version: 2
Duplex: full
Power drawn: 6.300 Watts
Management address(es):
  IP address: 10.0.10.45
-------------------------
Device ID: SW-ETAGE1
Entry address(es):
  IP address: 10.0.99.2
Platform: cisco WS-C2960S-48TS-L,  Capabilities: Switch IGMP
Interface: GigabitEthernet1/0/24,  Port ID (outgoing port): GigabitEthernet0/1
```

**Parsing :**
- `Capabilities` : `Phone` → phone IP ; `Switch` → switch aval ; `Host` → endpoint
- `Platform` contient `IP Phone` → phone IP (très fiable)
- `Platform` contient `WS-C`, `C9`, `C2960`, etc. → switch Cisco
- `Power drawn` → équipement PoE (phone, AP, caméra IP)

---

## Commandes à demander selon le besoin

| Objectif | Commande |
|----------|----------|
| Table MAC complète | `show mac address-table` |
| Config interfaces | `show running-config` (ou `sh run`) |
| Statut ports | `show interfaces status` |
| Voisins LLDP détaillés | `show lldp neighbors detail` |
| Voisins CDP détaillés | `show cdp neighbors detail` |
| VLANs configurés | `show vlan brief` |
| Résumé interfaces | `show ip interface brief` |

---

## Notes spécifiques IOS-XE (Catalyst 9xxx)

- La commande `show mac address-table` est identique
- `show interfaces status` peut avoir des colonnes supplémentaires (Type détaillé)
- LLDP doit être activé avec `lldp run` en global config
- CDP est activé par défaut sur les équipements Cisco
