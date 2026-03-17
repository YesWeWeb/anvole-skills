# Référence Aruba ProVision (HP ProCurve / HP Switch)

Formats de sortie des commandes CLI Aruba ProVision / K.xx.
Concerne les switches HP ProCurve et HP/Aruba legacy : 2530, 2540, 2920, 2930F, 3800, 5400, etc.

---

## Détection Aruba ProVision

Indices dans les outputs :
- `HP ProCurve Switch` ou `HP Switch` dans le banner
- `ProCurve` dans la description ou version
- `Aruba Switch` (renommage post-acquisition HPE)
- Prompt du style `HP-2920-48G# ` ou `switch# `
- Commande `show mac-address` (sans "table")
- Format de port `1`, `2`, `A1`, `A2` (numéros simples ou lettres pour SFP)

---

## show mac-address

### Format ProVision
```
Status and Counters - Port Address Table - All Ports

  MAC Address       Port    VLAN
  ----------------- ------- ----
  001a2b3c4d5e      1       10
  0026994labcd      5       10
  f8b156aa0011      5       10
  805ec0123456      5       20
  a0b1c2d3e4f5      48      99
```

**Parsing :**
- Format MAC : 12 hex sans séparateur (ex: `001a2b3c4d5e`) ou avec tiret (`00-1a-2b-3c-4d-5e`)
- Numéros de port : simples (`1`, `2`, ...) ou avec lettre pour SFP (`A1`, `A2`, `B1`)
- Sur les switches modulaires (5400) : `A1`, `B1`, etc. selon le slot

---

## show running-config (extrait interfaces)

### Format ProVision
```
interface 1
   name "PC-RH"
   untagged vlan 10
   exit
interface 5
   name "Phone-IP-Dupont"
   untagged vlan 10
   tagged vlan 20
   exit
interface 48
   name "Uplink-Core"
   tagged vlan 1,10,20,99
   exit
```

**Différences clés :**
- `untagged vlan X` = port access sur VLAN X (équivalent `switchport access vlan X`)
- `tagged vlan X` = VLAN autorisé taggé (trunk ou voice VLAN)
- Un port avec `untagged vlan 10` et `tagged vlan 20` → access data sur 10, voice VLAN 20 (phone IP)
- `name "..."` = description de l'interface
- Pas de keyword `voice vlan` explicite — le voice VLAN est simplement un VLAN taggé sur le port

### Identification port phone ProVision
Sur ProVision, un port phone IP + PC se reconnaît par :
- `untagged vlan 10` (VLAN data pour le PC)
- `tagged vlan 20` (VLAN voix taggé pour le phone)

---

## show lldp info remote-device detail

```
 LLDP Remote Device Information Detail

  LocalPort   : 5
  ChassisType : mac-address
  ChassisId   : 002699 41abcd
  PortType    : mac-address
  PortId      : 002699 41abcd
  SysName     : SEP002699 41ABCD
  System Descr: Cisco IP Phone CP-8841, V14-3-1SR3-1
  PortDescr   : SW Port

  System Capabilities Supported  : bridge, telephone
  System Capabilities Enabled    : bridge, telephone

  Remote Management Address
     Type    : ipv4
     Address : 10.0.10.45

  PortVlanID  : 10
------

  LocalPort   : 48
  ChassisType : mac-address
  ChassisId   : a0b1c2 d3e4f5
  PortType    : interface-name
  PortId      : GigabitEthernet0/1
  SysName     : SW-CORE
  System Descr: Cisco IOS Software, Catalyst C3750X
  PortDescr   : Uplink to Distribution

  System Capabilities Supported  : bridge, router
  System Capabilities Enabled    : bridge
```

**Parsing :**
- `System Capabilities Enabled` : `telephone` → phone IP ; `bridge` → switch
- `System Descr` → description complète (modèle de phone, OS switch)
- Format MAC dans `ChassisId` : groupes de 6 hex séparés par espace (ex: `002699 41abcd`)

---

## show config (équivalent running-config)

Sur certains firmware ProVision, la commande est `show config` au lieu de `show running-config`.
Le format est identique.

---

## Commandes à demander selon le besoin

| Objectif | Commande ProVision |
|----------|-------------------|
| Table MAC | `show mac-address` |
| Config complète | `show running-config` ou `show config` |
| Voisins LLDP | `show lldp info remote-device detail` |
| VLANs | `show vlans` |
| Statut ports | `show interfaces brief` |
| Version | `show system information` |

---

## Notes importantes ProVision

- Pas de CDP (protocole Cisco propriétaire) — uniquement LLDP
- LLDP activé par défaut sur ProVision
- Les ports SFP sont souvent nommés `A1`, `A2` (petits switches) ou `B1`-`B4` (uplinks)
- Sur les switches modulaires (5400, 8200) les ports incluent le slot : `A1`, `B5`, etc.
- La notion de "voice VLAN" n'existe pas explicitement — c'est un VLAN taggé normal
- `show lldp info remote-device` (sans detail) donne un résumé tabulaire moins riche
