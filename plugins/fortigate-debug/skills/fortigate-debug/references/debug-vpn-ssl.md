# vpn-ssl — SSL VPN Troubleshooting

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `get vpn ssl monitor` | Utilisateurs connectes, IP tunnel, duree |
| `diagnose vpn ssl list` | Sessions actives avec details |
| `show vpn ssl settings` | Config portail, interface source, pool IP |
| `get system performance status` | Verifier conserve mode (bloque nouvelles sessions SSL) |
| `diagnose vpn ssl statistics` | Compteurs connexion/authentification |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose vpn ssl mux-stat` | Stats multiplexage |
| `execute vpn sslvpn list` | Liste connexions SSL VPN |
| `show user group` | Verifier appartenance groupes |
| `show user ldap` | Config serveur LDAP |
| `show user radius` | Config serveur RADIUS |
| `diagnose firewall auth list` | Utilisateurs authentifies |
| `show firewall policy` | Verifier policies SSL VPN existent |

## Live debug [LIVE] (manuel uniquement)

```
diagnose vpn ssl debug-filter src-addr4 <client-ip>
diagnose debug application sslvpn -1
diagnose debug enable
# Observer la negociation SSL et l'authentification
diagnose debug disable
diagnose debug reset
```

## Signatures de panne

| Pattern | Cause probable |
|---------|----------------|
| `get vpn ssl monitor` vide + users se plaignent | Probleme service SSL VPN |
| `conserve mode` dans perf status | Memoire critique — SSL VPN refuse nouvelles connexions |
| `SSL VPN login failed` dans debug | Auth echouee (creds, LDAP down) |
| Pas de pool IP disponible | Pool d'adresses tunnel epuise |

## Actions correctives

```
execute vpn sslvpn del-tunnel    # Deconnecter utilisateurs tunnel
execute vpn sslvpn del-web       # Deconnecter utilisateurs web
```
