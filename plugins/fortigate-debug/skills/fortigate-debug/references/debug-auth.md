# auth — Authentification (LDAP/RADIUS/FSSO/SAML)

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose firewall auth list` | Utilisateurs actuellement authentifies |
| `diagnose test authserver ldap <server> <user> <pass>` | Test bind LDAP |
| `diagnose test authserver radius <server> <scheme> <user> <pass>` | Test RADIUS |
| `get user fsso` | Etat collecteur FSSO |
| `diagnose debug authd fsso server-status` | Connectivite serveur FSSO |
| `diagnose debug authd fsso list` | Utilisateurs FSSO connectes |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `show user ldap` | Config serveur LDAP (IP, DN, type) |
| `show user radius` | Config serveur RADIUS |
| `show user fsso-polling` | Config polling FSSO |
| `show user group` | Definition groupes utilisateurs |
| `show user saml` | Config IdP SAML (7.0+) |
| `diagnose debug fsso-polling detail` | Details polling FSSO |
| `diagnose debug fsso-polling summary` | Resume FSSO |
| `diagnose debug fsso-polling user` | Utilisateurs FSSO |
| `diagnose wad user list` | Utilisateurs proxy-auth |

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application fnbamd -1    # Daemon auth (LDAP/RADIUS)
diagnose debug application fssod -1     # Daemon FSSO
diagnose debug application authd -1     # Daemon auth general
diagnose debug application samld -1     # Daemon SAML
diagnose debug application smbcd -1     # Daemon SMB (DC polling)
diagnose debug enable
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| `ret=-1` dans test LDAP | Serveur LDAP injoignable (DNS/reseau) |
| `ret=1` dans test LDAP | Bind reussi |
| FSSO server-status `not connected` | Agent collecteur FSSO injoignable |
| `failed to match` dans fnbamd | Utilisateur pas dans le groupe attendu |
| `Authentication failed` dans debug | Mauvais credentials ou serveur refuse |
