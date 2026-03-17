# vpn-ipsec — IPsec VPN Troubleshooting

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `get vpn ipsec tunnel summary` | Etat up/down par tunnel, selectors(total,up), rx/tx pkt |
| `get vpn ipsec tunnel details` | Details par tunnel : SPI, lifetime, bytes |
| `diagnose vpn ike gateway list` | Phase 1 SA : remote IP, algo, etat |
| `diagnose vpn tunnel list` | Phase 2 SA : SPI, proxy-id, lifetime |
| `get router info routing-table all` | Verifier que les routes pointent vers le bon tunnel |
| `get vpn ipsec stats tunnel` | Statistiques generales tunnels |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose vpn ike gateway list name <tunnel>` | Filtrer par tunnel specifique |
| `diagnose vpn tunnel list name <phase1>` | Phase 2 d'un tunnel specifique |
| `diagnose vpn ike status` | Resume global IKE |
| `diagnose vpn ike counts` | Compteurs de negociation IKE |
| `diagnose vpn ike errors` | Erreurs IKE |
| `diagnose vpn ike stats` | Statistiques IKE |
| `diagnose vpn ike crypto` | Info crypto IKE |
| `diagnose vpn ike routes` | Routes IKE |
| `diagnose vpn ipsec status` | Compteurs chiffrement |
| `get vpn ipsec stats crypto` | Stats composants crypto |
| `show vpn ipsec phase1-interface` | Config phase 1 (PSK, proposals) |
| `show vpn ipsec phase2-interface` | Config phase 2 (selectors, PFS) |
| `diagnose firewall iprope lookup <srcIP> <srcPort> <dstIP> <dstPort> <proto> <intf>` | Verifier policy autorise le trafic |

## Live debug [LIVE] (manuel uniquement)

```
diagnose vpn ike log filter dst-addr4 <remote-gw-ip>
diagnose debug application ike -1
diagnose debug enable
# Observer la negociation IKE en temps reel
# Chercher : "negotiation failure", "no proposal chosen", "AUTH_FAILED", "id mismatch"
diagnose debug disable
diagnose debug reset
```

## Signatures de panne

| Pattern dans l'output | Cause probable |
|-----------------------|----------------|
| `selectors(total,up): N/0` | Phase 2 down — mismatch proposals/selectors |
| Gateway absente de `ike gateway list` | Phase 1 jamais etablie — verifier remote-gw/PSK/connectivity |
| `no matching phase1` | Config phase1 introuvable pour le peer |
| `received AUTH_FAILED` | PSK mismatch ou probleme certificat |
| `no proposal chosen` | Mismatch algorithmes chiffrement/hash |
| `negotiation timeout` | Peer injoignable (firewall/NAT bloque UDP 500/4500) |

## Actions correctives courantes

```
diagnose vpn tunnel up <phase2> <phase1>     # Remonter un tunnel
diagnose vpn tunnel shut <phase2> <phase1>   # Couper un tunnel
diagnose vpn ike gateway flush name <name>   # Purger les SA phase 1
diagnose vpn tunnel flush <name>             # Purger les SA phase 2
```
