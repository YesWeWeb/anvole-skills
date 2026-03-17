---
name: fortigate
description: >
  Use this skill to collect, export, or inventory the full configuration of a Fortinet FortiGate firewall.
  ALWAYS trigger when the user wants to retrieve, dump, or document FortiGate config — policies, VPN,
  interfaces, routes, DHCP, SD-WAN, security profiles, objects, users, HA status. This is a DATA
  COLLECTION skill, not a troubleshooting skill. Covers any FortiGate model (40F, 60E, 60F, 100E, 100F,
  200F, 300E, 400E, etc.) and FortiOS version. Also invoked programmatically by analysis skills.
  French user triggers: "inventaire FortiGate", "exporter la conf du forti", "collecter le FortiGate",
  "recuperer les policies", "audit firewall Fortinet", "config FGT", "export forti".
  Do NOT use for troubleshooting/debugging incidents (VPN down, CPU high, auth failure) — use
  fortigate-debug instead. Do NOT use for configuring or modifying the FortiGate.
---

# FortiGate — Collecte via MCP Server

Collecte 38 commandes FortiOS via le serveur MCP FortiGate (dual-transport : REST API ou SSH automatique).

## Prerequis

Le serveur MCP FortiGate doit etre demarre et le device configure dans `config.json`.

Si le device n'est pas encore enregistre dans le MCP, utiliser l'outil `add_device` :
- Avec API token : `add_device(device_id, host, api_token=...)`
- Avec SSH seulement : `add_device(device_id, host, ssh_port=48022, ssh_password=...)`

## Etape 1 : Verifier la connectivite

Utiliser l'outil MCP `test_device_transports` pour verifier les transports disponibles (API et/ou SSH).

Si le device n'est pas encore enregistre, demander a l'utilisateur :
1. **IP** du FortiGate
2. **Port SSH** — **souvent non-standard (ex: 48022), toujours demander**
3. **Mot de passe SSH**
4. **Utilisateur** (defaut : `admin`)
5. **API token** (optionnel — si disponible, les lectures seront plus rapides)
6. **VDOM** (si multi-VDOM)

Puis enregistrer le device via l'outil MCP `add_device`.

## Etape 2 : Collecte

### Option A — Collecte complete (13 categories)

Utiliser l'outil MCP `collect_all_categories(device_id)`.

Cela execute 38 commandes groupees en 13 categories et retourne le tout consolide.

### Option B — Collecte ciblee (par categorie)

Utiliser l'outil MCP `collect_category(device_id, category)`.

Categories disponibles :

| Categorie | Contenu | Quand l'utiliser |
|-----------|---------|------------------|
| `system` | Hostname, firmware, CPU, RAM, NICs | Etat du FortiGate |
| `interfaces` | Interfaces physiques + VLANs, alias, IP | Inventaire interfaces |
| `routing` | Table de routage + routes statiques | Analyse routage |
| `policies` | Firewall policies | Audit securite |
| `objects` | Adresses, groupes, VIP, IP pools | Resoudre noms des policies |
| `services` | Services custom + groupes | Resoudre services des policies |
| `zones` | Zones de securite | Matrice zones-interfaces |
| `dhcp_dns` | DHCP + DNS | Infra DHCP/DNS |
| `vpn` | IPSec + SSL VPN | Config et etat VPN |
| `users` | Users, groupes, LDAP | Authentification |
| `network` | HA, ARP, sessions, SD-WAN | Etat reseau |
| `security` | Profils AV, webfilter, IPS, app control | Audit profils securite |
| `admin` | Logging, SNMP, NTP, admin, VDOM | Administration |

### Option C — Commande SSH individuelle

Utiliser `execute_ssh_command(device_id, command)` pour une commande specifique.

## Etape 3 : Routing par question

| Question | Outil(s) MCP a utiliser |
|----------|------------------------|
| Interfaces / VLANs | `collect_category(device_id, "interfaces")` + `collect_category(device_id, "zones")` |
| Policies / flux | `collect_category(device_id, "policies")` (+ `objects` + `services` si noms a resoudre) |
| VPN | `collect_category(device_id, "vpn")` |
| Etat systeme | `collect_category(device_id, "system")` |
| DHCP / DNS | `collect_category(device_id, "dhcp_dns")` |
| ARP / SD-WAN / HA | `collect_category(device_id, "network")` |
| Audit securite complet | `collect_all_categories(device_id)` |
| Vue d'ensemble | `collect_category(device_id, "system")` + `interfaces` + `zones` |

## Etape 4 : Outils MCP additionnels utiles

Pour des donnees specifiques en temps reel (SSH-only) :
- `get_arp_table(device_id)` — table ARP
- `get_session_stats(device_id)` — statistiques sessions
- `get_vpn_ipsec_status(device_id)` — etat tunnels VPN IPsec
- `get_performance_top(device_id)` — top processus CPU
- `get_memory_info(device_id)` — memoire

Pour le parsing FortiOS (format get/show, config/edit/set/next/end), lire `references/fortigate.md`.

## References

- `references/fortigate.md` — format CLI FortiOS, parsing guidance, exemples
