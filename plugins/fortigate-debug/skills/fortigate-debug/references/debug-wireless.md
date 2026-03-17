# wireless — FortiAP et controleur WiFi

## Triage (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose wireless-controller wlac -c ap-status` | Liste APs avec status |
| `diagnose wireless-controller wlac -c sta` | Info clients WiFi |
| `diagnose wireless-controller wlac -c vap` | Virtual APs (SSID, IP) |

## Deep-dive (automatise)

| Commande | Donnees |
|----------|---------|
| `diagnose wireless-controller wlac -d wtp` | Details FortiAP |
| `diagnose wireless-controller wlac -d sta` | Details clients |
| `show wireless-controller wtp-profile` | Profils AP |
| `show wireless-controller wtp` | Config AP individuels |

## Live debug [LIVE] (manuel uniquement)

```
diagnose debug application cw_acd 0x7ff   # Debug controleur WiFi
diagnose debug enable
```
