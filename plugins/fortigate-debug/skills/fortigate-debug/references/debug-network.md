# network — Connectivite / Routage / Interfaces

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `get system interface physical` | Link up/down, vitesse, IP |
| `get router info routing-table all` | Table de routage complete |
| `get system arp` | Table ARP (next-hop joignable ?) |
| `get system session-info statistics` | Sante table sessions |
| `diagnose ip address list` | Toutes les IP sur les interfaces |
| `diagnose netlink aggregate list` | Etat des agregats LACP |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `get router info routing-table details <prefix>` | Lookup route specifique |
| `get router info kernel` | FIB kernel IPv4 |
| `get router info6 kernel` | FIB kernel IPv6 |
| `diagnose ip route list` | Routes IPv4 |
| `diagnose ip rtcache list` | Cache de routes |
| `diagnose netlink interface list` | Stats NIC (drops, erreurs) |
| `get system interface transceiver` | Status modules SFP |
| `diagnose hardware deviceinfo nic <port>` | Compteurs NIC bas niveau |
| `get hardware nic <interface>` | Specs NIC |
| `diagnose sys gre list` | Tunnels GRE |
| `diagnose sys waninfo` | IP publique WAN et menaces |
| `get firewall proute` | Routes policy-based |
| `fnsysctl cat /proc/net/dev` | Erreurs et stats paquets par interface |

## Live debug [LIVE] — Packet capture (manuel uniquement)

```
# Verbosity : 1=header, 2=+data, 3=+ether, 4=+intf, 5=+data-hex, 6=+ether+data-hex
diagnose sniffer packet <interface> '<filter>' <verbosity> <count> <a|l>
# Exemples :
diagnose sniffer packet any 'host 10.0.0.1 and icmp' 4 100 a
diagnose sniffer packet wan1 'port 443' 4 50 l
```

## Live debug [LIVE] — Debug flow (manuel uniquement)

```
diagnose debug flow filter clear
diagnose debug flow filter addr <IP>
diagnose debug flow filter proto <num>       # 1=ICMP, 6=TCP, 17=UDP
diagnose debug flow show function-name enable
diagnose debug flow show iprope enable       # Afficher le match policy
diagnose debug flow trace start <count>      # Ex: 100
diagnose debug enable
# Montre : policy match, NAT, routing decision, session creation/denial
diagnose debug disable
diagnose debug reset
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| `link: down` sur interface | Couche physique (cable, SFP, port) |
| Pas de route vers destination | Route statique manquante ou routage dynamique casse |
| `id=0` dans debug flow (implicit deny) | Aucune policy ne matche — policy manquante |
| `may_dirty` dans session list | Session reevaluee apres changement policy |
| `Allowed by Policy-xxx: SNAT` vs `Denied` | Confirme pass ou block + quelle policy |
| ARP incomplet pour next-hop | Next-hop injoignable (mauvais VLAN, interface down) |
