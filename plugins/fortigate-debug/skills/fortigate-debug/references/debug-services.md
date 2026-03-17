# services — DHCP / DNS / NTP / Logging

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `execute dhcp lease-list` | Baux DHCP (si FGT est serveur DHCP) |
| `get system dns` | Config DNS |
| `diagnose test application dnsproxy 2` | Stats DNS + latence |
| `execute time` | Heure systeme (drift NTP ?) |
| `diagnose log test` | Envoyer log test vers toutes destinations (opt-in `--with-log-test`) |
| `get log setting` | Config logging (FAZ, syslog, disk) |
| `diagnose sys ntp status` | Etat synchro NTP, offset |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `show system dhcp server` | Config serveur DHCP |
| `show system dns-database` | Zones DNS locales |
| `diagnose test application dnsproxy 7` | Entrees cache DNS |
| `diagnose test application dnsproxy 6` | FQDN resolus actuellement |
| `diagnose test application dnsproxy 8` | Entrees DNS database locale |
| `execute log fortianalyzer test-connectivity` | Test connectivite FAZ |
| `get log fortianalyzer setting` | Config FAZ |
| `get log fortianalyzer filter` | Filtres envoi logs |
| `get system ntp` | Config serveur NTP |
| `show system snmp community` | Config SNMP |
| `diagnose snmp ip frags` | Fragmentation SNMP |

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application dhcps -1       # Debug serveur DHCP
diagnose debug application dhcprelay -1   # Debug relay DHCP
diagnose debug application dhcpc -1       # Debug client DHCP
diagnose debug application dnsproxy -1    # Debug DNS proxy
diagnose debug application miglogd -1     # Debug logging daemon
diagnose debug application snmpd -1       # Debug SNMP
diagnose debug enable
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| Pool DHCP epuise | Plus d'IP libres — `lease-list` montre tout alloue |
| DNS resolve retourne rien | DNS mal configure ou upstream DNS injoignable |
| FAZ test `connection refused` | Mauvaise IP/port ou FAZ injoignable |
| NTP offset > 10s | Derive horloge — impact certificats et logs |
| `miglogd` erreur dans log | Probleme ecriture logs (disque plein ?) |
