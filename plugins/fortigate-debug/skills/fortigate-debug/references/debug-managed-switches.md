# managed-switches — FortiSwitch geres

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose switch-controller switch-info mac-table` | Table MAC switch |
| `diagnose switch-controller switch-info port-stats` | Stats ports |
| `diagnose switch-controller switch-info trunk status` | Etat trunks |
| `diagnose switch-controller switch-info poe` | Info PoE |
| `diagnose switch-controller switch-info stp` | Etat STP |
| `diagnose switch-controller switch-info 802.1X` | Etat 802.1X |
| `diagnose switch-controller switch-info lldp` | Voisins LLDP |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose switch-controller switch-info port-properties` | Proprietes ports |
| `diagnose switch-controller switch-info acl-counters` | Compteurs ACL |
| `diagnose switch-controller switch-info dhcp-snooping` | DHCP snooping |
| `diagnose switch-controller switch-info igmp-snooping` | IGMP snooping |
| `diagnose switch-controller switch-info loop-guard` | Loop guard |
| `diagnose switch-controller switch-info flapguard` | Flap guard |
| `diagnose switch-controller switch-info modules` | Modules SFP |
| `execute switch-controller get-conn-status <SN>` | Etat connexion switch |
| `execute switch-controller diagnose-connection <SN>` | Diagnostics switch |
