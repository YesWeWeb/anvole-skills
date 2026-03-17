# security — IPS / Web Filter / DNS Filter

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose test application ipsmonitor 1` | Info engine IPS (running ?) |
| `diagnose ips session list` | Sessions IPS actives |
| `diagnose webfilter fortiguard statistics` | Stats cache web filter |
| `diagnose debug rating` | Etat FortiGuard web filtering |
| `diagnose autoupdate versions` | Versions bases signatures + licences |
| `get system fortiguard-service status` | Connectivite FortiGuard |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `show ips sensor` | Config sensor IPS |
| `show webfilter profile` | Config profil web filter |
| `diagnose test application urlfilter 99` | Redemarrer URL filter |
| `diagnose test application dnsproxy 2` | Stats DNS + latence serveur |
| `diagnose test application dnsproxy 7` | Cache DNS |
| `diagnose test application dnsproxy 10` | Policy DNS Filter active |
| `diagnose test application dnsproxy 15` | Cache DNS Filter + ratings |
| `execute update-now` | Forcer mise a jour signatures |

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application ipsmonitor -1     # Debug engine IPS
diagnose debug application urlfilter -1      # Debug URL filter
diagnose debug application dnsproxy -1       # Debug DNS proxy
diagnose debug enable
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| IPS engine `not running` | Engine crashe ou desactive |
| FortiGuard `unreachable` | DNS ou firewall bloque acces update |
| URL rating retourne `0` | URL pas dans la DB ou FortiGuard injoignable |
| `diagnose ips anomaly status` montre anomalie | Attaque detectee ou faux positif |
