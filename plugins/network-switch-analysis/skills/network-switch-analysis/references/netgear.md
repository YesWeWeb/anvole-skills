# Référence Netgear ProSafe / Smart

Formats de sortie des commandes CLI Netgear (ProSafe, Smart, Plus managed switches).
Concerne principalement : GS7xx, GS7xxR, GS9xx, M4xxx, M6xxx, FSM7xxx.

---

## Détection Netgear

Indices dans les outputs :
- `(C)opyright.*NETGEAR` dans le banner
- Prompt du style `(NETGEAR Switch) #` ou `(NETGEAR Switch) (Config)#`
- `show version` contenant `NETGEAR`
- Format de port `0/X` ou `1/0/X` (slot/port ou unit/slot/port)

---

## show mac-address-table

### Format Netgear ProSafe (GS7xx, GS9xx)
```
VLAN ID  MAC Address        Type        Interface
-------  -----------------  ----------  ---------
1        00:1a:2b:3c:4d:5e  DYNAMIC     0/3
10       00:26:99:41:ab:cd  DYNAMIC     0/5
10       f8:b1:56:aa:00:11  DYNAMIC     0/5
20       80:5e:c0:12:34:56  DYNAMIC     0/8
99       a0:b1:c2:d3:e4:f5  DYNAMIC     0/24
```

### Format Netgear M4xxx (stackable)
```
VLAN ID  MAC Address        Type        Component  Interface
-------  -----------------  ----------  ---------  ---------
10       00:26:99:41:ab:cd  DYNAMIC     1          1/0/5
```

**Parsing :**
- Format MAC : `xx:xx:xx:xx:xx:xx` (notation standard)
- Format port : `0/X` (standalone) ou `unit/slot/port` (stack)

---

## show running-config (extrait interfaces)

### Format Netgear
```
interface 0/1
description 'PC-RH'
vlan participation include 10
vlan pvid 10
vlan tagging 20
spanning-tree portmode auto
exit

interface 0/5
description 'Phone-IP-Dupont'
vlan participation include 10,20
vlan pvid 10
vlan tagging 20
exit

interface 0/24
description 'Uplink-Core'
vlan participation include 1,10,20,99
vlan pvid 1
vlan tagging 1,10,20,99
exit
```

**Parsing :**
- `vlan pvid X` = VLAN non taggé (access) = VLAN data
- `vlan tagging X` = VLAN taggé sur le port
- `vlan participation include X,Y` = VLANs auxquels le port appartient
- Port avec `vlan pvid 10` + `vlan tagging 20` → access data 10, voice VLAN 20
- Port avec tous VLANs taggés → trunk
- `description '...'` avec guillemets simples

---

## show lldp remote-device all

```
Interface  RemID  Age  System Name    Port ID           System Capability
---------  -----  ---  -------------  ----------------  -----------------
0/5          1    90   SEP002699ABCD  Port 1            B T
0/24         2    85   SW-CORE        GigabitEthernet   B
```

### show lldp remote-device detail [interface]

```
Interface: 0/5
  Remote ID:                    1
  System Name:                  SEP002699ABCD
  System Description:           Cisco IP Phone CP-8841, V14-3-1SR3-1
  Chassis ID SubType:           MAC Address
  Chassis ID:                   00:26:99:41:ab:cd
  Port ID SubType:              MAC Address
  Port ID:                      00:26:99:41:ab:cd
  Port Description:             SW Port
  System Capabilities Supported: Bridge, Telephone
  System Capabilities Enabled:   Bridge, Telephone
  Time To Live:                 120
  Management Address:           10.0.10.45
  Port VLAN Identifier:         10
```

**Parsing :**
- `System Capabilities Enabled` : `Telephone` → phone IP ; `Bridge` → switch
- `System Description` → modèle (ex: "Cisco IP Phone CP-8841")

---

## show port all (statut des ports)

```
                                   Link    Physical    Physical    Flow Link
                                   Link    Config      Status      Control
Interface    Type         Mode     State   Mode        Status      Status
-----------  -----------  -------  ------  ----------  ----------  -------
0/1          Gigabit-TX   Auto     Up      Auto        1000full    Inactive
0/2          Gigabit-TX   Auto     Down    Auto        Unknown     Inactive
0/5          Gigabit-TX   Auto     Up      Auto        100full     Inactive
0/24         Gigabit-TX   Auto     Up      Auto        1000full    Inactive
```

---

## Commandes à demander selon le besoin

| Objectif | Commande Netgear |
|----------|-----------------|
| Table MAC | `show mac-address-table` |
| Config complète | `show running-config` |
| Statut ports | `show port all` ou `show interface status all` |
| Voisins LLDP résumé | `show lldp remote-device all` |
| Voisins LLDP détaillé | `show lldp remote-device detail [interface]` |
| VLANs | `show vlan brief` |
| Version | `show version` |

---

## Notes importantes Netgear

- Les gammes **ProSafe Plus** (GS1xx avec interface web uniquement) n'ont pas de CLI
  → l'utilisateur doit exporter les données via l'interface web (CSV ou HTML)
- Les gammes **Smart** et **ProSafe Fully Managed** ont un CLI
- CDP n'est pas supporté sur Netgear (standard LLDP uniquement)
- La notion de "voice VLAN" est implémentée via VLAN taggé (comme Aruba ProVision)
- Sur les switches Netgear avec export web, les colonnes CSV peuvent varier selon le firmware
