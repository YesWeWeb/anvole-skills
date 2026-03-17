# performance — CPU / Memoire / Sessions

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `get system performance status` | CPU par core, memoire %, conserve mode, sessions |
| `get system status` | Uptime, firmware, mode |
| `diagnose sys top 2 20` | Top 20 process par CPU (refresh 2s, 1 iteration) |
| `get system session-info statistics` | Compteurs sessions, max, clash |
| `execute sensor list` | Capteurs hardware (temperature, ventilateurs) |
| `diagnose hardware sysinfo conserve` | Seuils conserve mode et etat |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose sys session stat` | Stats sessions par protocole |
| `diagnose sys session full-stat` | Stats sessions detaillees |
| `diagnose sys session exp-stat` | Stats sessions expectation |
| `diagnose hardware sysinfo memory` | Decomposition memoire |
| `get hardware memory` | Allocation memoire |
| `diagnose sys flash list` | Usage disque/flash |
| `diagnose hardware deviceinfo disk` | Info stockage |
| `diagnose sys mpstat 2` | Usage CPU par core (1 iteration) |
| `diagnose firewall packet distribution` | Distribution paquets |
| `diagnose sys process dump <PID>` | Info process specifique |
| `diagnose autoupdate status` | Process de mise a jour |
| `fnsysctl df -h` | Usage filesystem |

## Live debug [LIVE] (manuel uniquement)

```
# CPU profiling (attention : impact performance)
diagnose sys profile cpumask <cpu_id>
diagnose sys profile start
# Attendre 10-30 secondes
diagnose sys profile stop
diagnose sys profile show detail
diagnose sys profile show order
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| `Memory: ... conserve mode` | Memoire critique — features desactivees |
| CPU > 80% soutenu | Identifier top process (ipsengine, wad, miglogd, proxy) |
| `ipsengine` haute CPU | IPS surcharge — verifier signatures/traffic |
| `wad` haute CPU | Inspection proxy — trop de sessions deep inspection |
| `miglogd` haute CPU | Logging surcharge — verifier FAZ/syslog |
| `clash: <valeur elevee>` | Contention table sessions |
| Session count proche `max` | Table sessions saturee — augmenter max ou investiguer |
| Temperature > seuil | Probleme refroidissement |
