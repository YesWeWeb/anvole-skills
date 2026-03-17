# admin — Acces administrateur et API

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `get sys info admin status` | Admins connectes avec session ID |
| `show system admin` | Comptes admin configures |
| `diagnose debug config-error-log read` | Erreurs de configuration recentes |

## Actions manuelles

```
execute disconnect-admin-session <INDEX>    # Deconnecter un admin
```

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application httpsd -1    # Debug GUI/REST API
diagnose debug application sshd -1      # Debug sessions SSH
diagnose debug cli 8                    # Commandes CLI executees par le GUI
diagnose debug enable
```
