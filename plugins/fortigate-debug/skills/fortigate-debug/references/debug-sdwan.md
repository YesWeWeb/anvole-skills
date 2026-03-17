# sdwan — SD-WAN SLA et Routage

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose sys sdwan health-check` | Status health-check par membre (v6.4+) |
| `diagnose sys sdwan member` | Membres SD-WAN (interface, gateway, cost) |
| `diagnose sys sdwan service4` | Regles SD-WAN IPv4 et decisions routage |
| `diagnose sys sdwan service6` | Regles SD-WAN IPv6 |
| `get router info routing-table all` | Routes SD-WAN dans la table |
| `diagnose firewall proute list` | Routes policy-based (incl. SD-WAN) |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose sys sdwan intf-sla-log <interface>` | Historique SLA par interface |
| `show system sdwan` | Config SD-WAN complete |
| `diagnose sys link-monitor status` | Stats link monitor |
| `diagnose netlink interface list` | Compteurs interfaces (drops) |

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application link-monitor -1
diagnose debug enable
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| Health-check `state: dead` | Cible SLA injoignable sur ce lien |
| Tous les membres `dead` | Panne WAN totale ou health-check mal configure |
| Service montre `member: 0` | Aucun membre satisfait le SLA, fallback |
| Latence/jitter eleve | Probleme qualite lien (saturation, erreurs) |

## Note version

- FortiOS < 6.4 : utiliser `diagnose sys virtual-wan-link` au lieu de `diagnose sys sdwan`
- FortiOS 7.4.x : `get system sdwan health-check` peut retourner "command parse error" → utiliser `diagnose sys sdwan health-check`
