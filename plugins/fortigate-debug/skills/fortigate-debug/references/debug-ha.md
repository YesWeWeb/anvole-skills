# ha — Haute Disponibilite

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `get system ha status` | Mode HA, membres, serial, priorite, sync |
| `diagnose sys ha status` | Stats heartbeat, uptime |
| `diagnose sys ha checksum cluster` | Checksums config par membre (sync ?) |
| `diagnose sys ha dump-by group` | Info detaillee par groupe |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose sys ha checksum show <vdom>` | Checksums par VDOM |
| `diagnose sys ha checksum show <vdom> <setting>` | Checksum config specifique |
| `diagnose sys ha history read` | Historique HA (failovers, sync) |
| `get system interface physical` | Etat interfaces heartbeat |
| `diagnose sys ha checksum recalculate` | Forcer recalcul checksums |

## Actions manuelles HA

```
execute ha manage ?                        # Lister les index membres
execute ha manage <id> <username>          # Se connecter au membre secondaire
execute ha synchronize stop                # Arreter la synchro (pour debug)
execute ha synchronize start               # Relancer la synchro
diagnose sys ha reset-uptime               # Forcer failover temporaire (ATTENTION)
```

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application hatalk -1    # Communication HA
diagnose debug application hasync -1    # Synchronisation HA
diagnose debug application harelay -1   # Relay HA
diagnose debug enable
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| Checksum mismatch entre membres | Config desynchronisee |
| Interface heartbeat `link: down` | Lien physique entre unites coupe |
| Failovers frequents dans history | Cluster instable (lien flapping, priorite) |
| `standalone` alors que HA attendu | HA non configure ou heartbeat perdu |
| Uptime tres different entre membres | Failover recent ou membre reboot |
