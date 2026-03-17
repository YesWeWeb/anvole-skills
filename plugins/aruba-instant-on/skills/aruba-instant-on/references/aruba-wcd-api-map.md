# Aruba Instant On — Carte complète des endpoints WCD

Générée par exploration exhaustive de l'UI via Playwright (firmware InstantOn_1930_2.6.0.0).
Switch testé : Aruba Instant On 1930 48G PoE, IP 10.10.90.201.

---

## Endpoints essentiels pour l'analyse réseau

| Endpoint | Taille typique | Données |
|----------|---------------|---------|
| `{SystemGlobalSetting}` | ~1.6 KB | hostname, firmware, MAC, serial, modèle |
| `{Ports}` | ~20 KB | statut (up/down), vitesse, PoE supporté par port |
| `{PoEPSEInterfaceList}` | ~52 KB | statut PoE, puissance délivrée, statistiques |
| `{VLANList}` | ~2.5 KB | liste des VLANs avec ID et nom |
| `{VLANInterfaceMembershipTable}` | ~5.5 KB | ports tagged/untagged par VLAN |
| `{LLDPMEDNeighborList}` | variable | **voisins LLDP-MED** : IP, MAC, nom, modèle, fabricant, VLAN voix |
| `{ForwardingTable}` | ~14 KB | **table MAC** : MAC → port + VLAN |
| `{ARPList}` | variable | **table ARP** : IP → MAC → interface VLAN |

---

## Carte complète par section UI

### Dashboard / Post-login (chargement automatique)

| Endpoint | Données |
|----------|---------|
| `{EncryptionSetting}` | clé RSA publique pour le login |
| `{ConnectedUserList}{EncryptionSetting}` | sessions admin actives |
| `{Units}` | infos stack/unit |
| `{Ports}` | statut de tous les ports |
| `{PoEPSEInterfaceList}` | statut PoE tous les ports |
| `{DiagnosticsUnitList}` | informations matérielles |
| `{BoardProfileList}` | profil hardware |
| `{SyslogSeverityCounters}` | compteurs d'alertes par sévérité |
| `{SystemGlobalSetting}{TimeSetting}{LocateUnit}{DiagnosticsUnitList}{VLANCurrentStatus}{ComponentMapperTable}{UnexpectedRestart}{AdminUserSetting}{PasswordComplexity}{ManagementIpv4AddressTable}{SNTPServerTable}{SNTPGlobalSetting}{ManagementInterfaceGlobalSetting}{VLANList}{VLANInterfaceMembershipTable}{VLANInterfaceISList}{FWManagementTable}` | **tout le setup réseau** en une requête groupée (99 KB) |
| `{Ports&UnitID=0&interfaceType=1}{LocateUnit}{DiagnosticsUnitList}{StackTopologyTable}{PoEPSEInterfaceList}{PoEPSEUnitList}` | ports + PoE complet (70 KB) |

### Setup Network

| Endpoint | Données |
|----------|---------|
| `{VLANGlobalSetting}{EWSServiceTable}{DHCPv6GlobalSetting}{VLANList}{ManagementInterfaceGlobalSetting}{ManagementIpv4AddressTable}{ManagementIpv6InterfaceSetting}{ManagementIpv6AddressTable}` | config IP management (IPv4 + IPv6) |

### Switching (Port Configuration)

| Endpoint | Données |
|----------|---------|
| `{Standard802_3List&entryCount=en&Count=10}{StormControlTable}{STP}{SpanSourceTable}{SpanDestinationTable}{TimeBasedPortTable}` | config ports, storm control, port mirroring |
| `{StatisticsList&entryCount=en&Count=10}{EtherlikeStatisticsList&entryCount=en&Count=10}` | statistiques traffic par port |

### IGMP Snooping

| Endpoint | Données |
|----------|---------|
| `{MulticastGlobalSetting}{IGMPMLDSnoopVLANList&addrType=1}` | config IGMP globale |
| `{IGMPMLDSnoopRouterPortList&addrType=1}` | ports routeurs multicast |
| `{IGMPMLDSnoopGroupList&filter=(addrType=1)}` | groupes multicast appris |

### SNMP

| Endpoint | Données |
|----------|---------|
| `{SNMPGlobalSetting}{ViewOIDList}{SNMPGroupList}{SNMPRemoteEngineIDList}` | config SNMP globale |
| `{CommunityList&filter=(communityString!='innerFromLinux')}` | communautés SNMP |
| `{SNMPUserISList}` | utilisateurs SNMPv3 |
| `{SNMPTrap}` | config trap |
| `{NotificationReceiverList}` | destinataires des traps |

### Interface Auto Recovery

| Endpoint | Données |
|----------|---------|
| `{InterfaceRecoveryGlobalSetting}{ErrorRecoveryTable}` | config reprise auto sur erreur |
| `{ErrorRecoveryInterfaceTable}` | état par port |

### Spanning Tree

| Endpoint | Données |
|----------|---------|
| `{SpanningTreeGlobalParam}{STP}{RSTP}{MSTPGlobalSetting}` | config STP/RSTP/MSTP globale |
| `{STPInterfaceCountersList}` | compteurs STP par port |

### VLAN

| Endpoint | Données |
|----------|---------|
| `{VLANCurrentStatus}{VLANList}` | VLANs actifs |
| `{VLANInterfaceMembershipTable}` | tagged/untagged par VLAN |
| `{VLANInterfaceList&UnitID=0&entryCount=en&Count=10}{VLANInterfaceISList}` | config VLAN par port (mode access/trunk, PVID) |
| `{VLANInterfaceList&UnitID=0}{LACPPortList&entryCount=en&Count=10}` | ports LAG associés par VLAN |

### Voice VLAN

| Endpoint | Données |
|----------|---------|
| `{VoiceVLANGlobalSetting}{VLANCurrentStatus}{VLANGlobalSetting}` | config Voice VLAN globale |
| `{VoiceVLANOUIList}` | OUI des téléphones (Cisco, Avaya, Mitel...) |
| `{VoiceVLANInterfaceList}` | activation Voice VLAN par port, VLAN affecté |

### Trunk Configuration (LAG/LACP)

| Endpoint | Données |
|----------|---------|
| `{VLANInterfaceList&UnitID=0}{LACPPortList}` | membership LACP par port |
| `{VLANInterfaceList&UnitID=0}{VLANInterfaceISList}` | config VLAN + trunk |

### Neighbor Discovery / LLDP

| Endpoint | Données |
|----------|---------|
| `{LLDPGlobalSetting}{LLDPGlobalAdvertisementStatus}` | config LLDP globale |
| `{LLDPInterfaceList}{Standard802_3List&interfaceType=1}` | LLDP par port (config d'envoi/réception) |
| `{LLDPStatisticsInterfaceList}` | compteurs LLDP (paquets envoyés/reçus) |
| `{LLDPMEDNeighborList}` | **voisins LLDP-MED** — téléphones IP, APs, etc. |
| `{LLDPMEDAdvertisementInterfaceList&interfaceType=1}` | config LLDP-MED par port |

### PoE Configuration

| Endpoint | Données |
|----------|---------|
| `{SystemGlobalSetting}{TimeRangeList}{PoEPSEUnitList}{PoEStatisticsTable}{DiagnosticsUnitList}{PoEPSEInterfaceList}` | config PoE complète + budget |
| `{PoEPSEUnitList}` | budget PoE total/consommé par unité |
| `{PoEStatisticsTable}` | statistiques PoE |

### Routing / ARP

| Endpoint | Données |
|----------|---------|
| `{IPv4GlobalSetting}{IPv4GatewayList}{InetStaticRouteTable}{IPv4Statistics}{ICMPv4Counters}{ManagementInterfaceGlobalSetting}` | config routage IPv4 |
| `{IPv4InterfaceList&filter=(owner!=3)}{VLANCurrentStatus}{ARPInterfaceSettingTable}{VLANInterfaceMembershipTable}` | interfaces IPv4 L3 |
| `{InetStaticRouteTable}` | routes statiques |
| `{IPv4RouteList}` | table de routage complète |
| `{ARPGlobalSetting}{IPv4InterfaceList&filter=(owner!=3)}{VLANCurrentStatus}` | config ARP |
| `{ARPList}` | **table ARP** : IP → MAC → VLAN interface |

### MAC Table

| Endpoint | Données |
|----------|---------|
| `{ForwardingGlobalSetting}` | config globale de la table MAC (aging time...) |
| `{ForwardingTable}` | **table MAC complète** : MAC → port + VLAN |
| `{ForwardingStaticTable&entryCount=en&Count=10}` | entrées MAC statiques |

### QoS / ACL

| Endpoint | Données |
|----------|---------|
| `{ACLList}{TimeRangeList}{VLANList}{DOSGlobalSettings}{ACEList}` | listes ACL + ACE |
| `{ClassMapList}{PolicyMapList}{PolicyMapBindingList}{ACLBindingList}{ACLList}` | policy maps QoS |

### Security

| Endpoint | Données |
|----------|---------|
| `{Standard_802_1xGlobalSetting}{RadiusDefaultParam}{AAAGlobalSetting}{AuthenticationMethodList}` | config 802.1x/RADIUS |
| `{RadiusServerList}` | serveurs RADIUS configurés |
| `{InterfaceSecurityTable}` | port security par interface |
| `{DHCPSnoopingGlobalSetting}` | config DHCP snooping |
| `{DHCPSnoopingVLANList}{VLANCurrentStatus}` | DHCP snooping par VLAN |
| `{DHCPSnoopingInterfaceList}` | DHCP snooping par port (trusted/untrusted) |
| `{DHCPSnoopingBindingList}` | table DHCP snooping (MAC → IP → port) |

### Logging / Diagnostics

| Endpoint | Données |
|----------|---------|
| `{SyslogGlobalSetting}{LogGlobalSetting}{SyslogServerList}{UnexpectedRestart}{UnexpectedRestartLogTable}` | config syslog |
| `{MemoryLogTable}` | logs en mémoire (buffer) — peut être très volumineux (~200 KB) |
| `{FlashLogTable}` | logs persistants flash |

### Administration

| Endpoint | Données |
|----------|---------|
| `{PasswordComplexity}{PasswordGlobalParam}{PasswordComplexityExcludeKeywordList}{AAAGlobalSetting}` | politique mots de passe |
| `{ConnectedUserList}` | sessions admin actives |
| `{AdminUserSetting}` | comptes admin configurés |

---

## Format XML — Endpoints clés

### `{LLDPMEDNeighborList}` (LLDP-MED voisins)

```xml
<LLDPMEDNeighborList type="section">
  <NeighborEntry>
    <interfaceName>8</interfaceName>           <!-- port du switch -->
    <deviceID>192.168.210.34</deviceID>        <!-- IP du device (subtype=5 = IP address) -->
    <advertisedPortID>08:00:0f:4b:2c:e6</advertisedPortID>  <!-- MAC du device -->
    <systemName>regDN 102,MITEL 5320 IP</systemName>
    <systemDescription>regDN 102,MITEL 5320 IP,h/w rev 0,...,f/w Main 06.05.00.18</systemDescription>
    <MEDDeviceType>3</MEDDeviceType>           <!-- 1=Network Connectivity, 2=Media Endpoint class II, 3=IP phone/endpoint class III -->
    <InvntryMfrName>Mitel Corporation</InvntryMfrName>
    <InvntryModelName>MITEL 5320 IP</InvntryModelName>
    <InvntryFWRev>Boot 06.04.01.02</InvntryFWRev>
    <InvntrySWRev>Main 06.05.00.18</InvntrySWRev>
    <PDPowerRequired>47</PDPowerRequired>      <!-- puissance PoE demandée en 100mW (47 = 4.7W) -->
    <PDPowerSource>1</PDPowerSource>           <!-- 1=primary PSE -->
    <PDPowerPriority>3</PDPowerPriority>       <!-- 1=critical, 2=high, 3=low -->
    <NetworkPolicyList>
      <NetworkPolicyEntry>
        <application>001000000</application>   <!-- bit 3 = Voice -->
        <VLANID>100</VLANID>                   <!-- VLAN voix configuré sur le phone -->
        <userPriority>3</userPriority>
        <DSCP>26</DSCP>
      </NetworkPolicyEntry>
    </NetworkPolicyList>
    <MngAddrList>
      <AddrEntry>
        <addrSubtype>1</addrSubtype>           <!-- 1=IPv4 -->
        <addr>192.168.210.34</addr>
      </AddrEntry>
    </MngAddrList>
  </NeighborEntry>
```

**`MEDDeviceType` :** 1=Network Connectivity Device (switch, routeur), 2=Media Endpoint class II, 3=Media Endpoint class III (téléphone IP, softphone).

### `{ForwardingTable}` (table MAC)

```xml
<ForwardingTable type="section">
  <Entry>
    <VLANID>1</VLANID>
    <MACAddress>00:13:b0:05:d0:ed</MACAddress>
    <interfaceType>1</interfaceType>
    <interfaceName>39</interfaceName>          <!-- numéro de port -->
    <addressType>3</addressType>               <!-- 3=dynamic, 2=static -->
  </Entry>
```

### `{ARPList}` (table ARP)

```xml
<ARPList type="section">
  <ARPEntry>
    <interfaceName>VLAN90</interfaceName>      <!-- interface L3 -->
    <IPAddress>10.10.90.251</IPAddress>
    <physicalAddress>94:f3:92:43:0d:57</physicalAddress>
    <status>3</status>                         <!-- 3=dynamic -->
  </ARPEntry>
```

---

## Endpoints non disponibles (statusCode=-1)

Ces endpoints existent dans d'autres versions firmware mais retournent "Cannot find the section" sur 2.6.0.0 :

- `{LldpRemoteSystemsData}`, `{LldpPortConfig}`, `{LldpConfig}`, `{LldpNeighbor}` — ancienne API LLDP
- `{LldpNeighborList}`, `{LldpNeighborInfo}`, `{LldpLocalSystemData}` — ancienne API LLDP
- Note : utiliser `{LLDPMEDNeighborList}` (majuscules) qui fonctionne sur 2.6.x

---

## Recommandations collecte complète

Pour une analyse réseau complète, collecter en priorité :

```javascript
// Endpoints essentiels (à collecter systématiquement)
'{SystemGlobalSetting}'
'{Ports&UnitID=0&interfaceType=1}{PoEPSEInterfaceList}'
'{VLANList}{VLANInterfaceMembershipTable}{VLANInterfaceList&UnitID=0}{VLANInterfaceISList}'
'{LLDPMEDNeighborList}'        // voisins avec nom/modèle/IP
'{ForwardingTable}'             // table MAC (MAC → port)
'{ARPList}'                     // table ARP (IP → MAC)

// Endpoints complémentaires
'{VoiceVLANGlobalSetting}{VoiceVLANInterfaceList}{VoiceVLANOUIList}'
'{DHCPSnoopingBindingList}'     // DHCP snooping : IP→MAC→port
'{SpanningTreeGlobalParam}{STP}' // config STP
```
