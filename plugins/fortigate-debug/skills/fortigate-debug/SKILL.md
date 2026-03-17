---
name: fortigate-debug
description: >
  Use this skill to troubleshoot, diagnose, and debug any incident or problem on a FortiGate firewall.
  ALWAYS trigger when something is broken, down, slow, or malfunctioning on a FortiGate. Covers: VPN
  IPsec/SSL-VPN down, high CPU/memory, authentication failures (LDAP, RADIUS), HA failover issues,
  SD-WAN SLA problems, web filter/IPS false positives, DHCP/DNS failures, FortiAnalyzer disconnected,
  network slowness. French triggers: "le VPN est down", "le forti rame", "CPU a 95%", "panne FortiGate",
  "probleme VPN", "debug FortiGate", "SSL-VPN marche plus", "diagnostiquer le firewall", "HA failover",
  "SD-WAN route par la backup", "auth LDAP marche plus", "FortiAnalyzer deconnecte".
  Do NOT use for config export/inventory (use fortigate skill) or non-FortiGate firewalls.
---

# FortiGate Debug — Troubleshooting d'incidents via MCP

Ce skill diagnostique les incidents sur FortiGate (FortiOS) via les outils MCP du serveur FortiGate.
**12 categories d'incidents**, **3 niveaux de profondeur** (triage / deep-dive / live debug).

## Prerequis

Le serveur MCP FortiGate doit etre demarre et le device enregistre.

Si le device n'est pas enregistre, utiliser `add_device` avec au minimum `host` + `ssh_password` + `ssh_port`.

---

## Workflow en 6 etapes

### Etape 0 — Intake (OBLIGATOIRE)

Demander a l'utilisateur :
1. **Description de l'incident** en langage naturel
2. **Device ID** dans le MCP (ou IP + port SSH + password si pas encore enregistre)
3. **HA cluster ?** (oui/non)
4. **Multi-VDOM ?** (si oui, quel VDOM ?)

Verifier la connectivite avec `test_device_transports(device_id)`.

### Etape 1 — Classification de l'incident

Mapper la description sur 1 ou plusieurs categories :

| Categorie | Keywords declencheurs | Outil MCP diagnostic |
|-----------|----------------------|---------------------|
| `vpn-ipsec` | VPN down, tunnel, IPsec, phase1, phase2, IKE | `diagnose_vpn_ipsec` |
| `vpn-ssl` | SSL VPN, remote access, FortiClient, portail VPN | `diagnose_vpn_ssl` |
| `network` | connectivite, routage, packet loss, interface down | `diagnose_network` |
| `auth` | LDAP, RADIUS, FSSO, login echoue, SAML | `collect_category(device_id, "users")` |
| `performance` | CPU, memoire, lent, session table, conserve mode | `diagnose_performance` |
| `ha` | failover, cluster, sync, split-brain, heartbeat | `diagnose_ha` |
| `security` | IPS, web filter, bloque, faux positif, DNS filter | `collect_category(device_id, "security")` |
| `sdwan` | SD-WAN, SLA, health check, qualite lien | `execute_ssh_command(device_id, "diagnose sys sdwan ...")` |
| `services` | DHCP, DNS, NTP, logging, FortiAnalyzer, syslog | `collect_category(device_id, "dhcp_dns")` |
| `admin` | acces admin, GUI, API, session admin | `collect_category(device_id, "admin")` |
| `wireless` | WiFi, FortiAP, AP, SSID | `execute_ssh_command` avec commandes wireless |
| `managed-switches` | FortiSwitch, PoE switch, 802.1X | `execute_ssh_command` avec commandes switches |

### Etape 2 — Triage (automatise via MCP)

Pour chaque categorie identifiee, utiliser les outils MCP correspondants :

**VPN IPsec :**
```
diagnose_vpn_ipsec(device_id)
collect_category(device_id, "vpn")
```

**VPN SSL :**
```
diagnose_vpn_ssl(device_id)
execute_ssh_command(device_id, "get vpn ssl monitor")
```

**Network :**
```
diagnose_network(device_id)
collect_category(device_id, "routing")
get_arp_table(device_id)
```

**Performance :**
```
diagnose_performance(device_id)
get_performance_top(device_id)
get_memory_info(device_id)
get_session_stats(device_id)
```

**HA :**
```
diagnose_ha(device_id)
collect_category(device_id, "network")
```

**Autres categories :** utiliser `collect_category` + `execute_ssh_command` avec les commandes appropriees.

### Etape 3 — Analyse du triage

Interpreter les resultats des outils MCP.

**IMPORTANT — Lazy loading des references :**
Ne lire QUE les fichiers de reference correspondant aux categories identifiees a l'etape 1 :
- `references/debug-<categorie>.md` — commandes, signatures de panne, actions correctives
- `references/debug-common.md` — regles de securite (lire seulement si live debug envisage)

Exemple : pour `vpn-ipsec` + `performance`, lire uniquement :
- `references/debug-vpn-ipsec.md`
- `references/debug-performance.md`

**Ne JAMAIS charger toutes les references d'un coup.**

### Etape 4 — Deep-dive (si triage non concluant)

Utiliser `execute_ssh_command` pour des commandes specifiques supplementaires.
Consulter les sections `[DEEP]` des fichiers de reference correspondants.

Exemples de commandes deep-dive :
```
execute_ssh_command(device_id, "diagnose vpn ike gateway list name <tunnel>")
execute_ssh_command(device_id, "diagnose sys session filter ...")
execute_ssh_command(device_id, "diagnose sys ha checksum cluster")
```

### Etape 5 — Live debug (si necessaire, MANUEL uniquement)

Les commandes de debug en direct ne sont JAMAIS executees automatiquement.
Guider l'utilisateur pour executer manuellement. Consulter `references/debug-common.md` + `references/debug-<categorie>.md` sections `[LIVE]`.

**Procedure standard :**
```
diagnose debug duration 30
diagnose debug console timestamp enable
[commande de filtre]
[commande debug]
diagnose debug enable
# observer ...
diagnose debug disable
diagnose debug reset
```

### Etape 6 — Rapport et recommandations

Produire un rapport structure :
```markdown
## Rapport d'incident : [Categorie] sur [Hostname]

### Resume
[Description courte]

### Constatations
[Faits observes]

### Cause racine
[Si identifiee, sinon "A confirmer avec live debug / escalade"]

### Actions recommandees
1. [Action prioritaire]
2. [Action secondaire]

### Commandes correctives
[Commandes FortiOS — utiliser `generate_cli_commands` si modification de config necessaire]

### Verification post-correction
[Commandes de validation via `execute_ssh_command`]
```

---

## References

- `references/debug-common.md` — regles de securite du debug
- `references/debug-<categorie>.md` — commandes et signatures par categorie :
  vpn-ipsec, vpn-ssl, network, auth, performance, ha, security, sdwan, services, admin, wireless, managed-switches
