---
name: fortigate-doc
description: >
  Use this skill to generate operational documentation (DOE — Dossier d'Exploitation) for a FortiGate firewall.
  ALWAYS trigger when the user wants to create, generate, or export documentation for a FortiGate: DOE,
  technical documentation, operational handbook, network documentation, configuration summary, handover document.
  French triggers: "DOE FortiGate", "documentation operationnelle forti", "generer la doc du firewall",
  "dossier d'exploitation FortiGate", "doc technique forti", "exporter la doc FortiGate", "fiche technique
  FortiGate", "documentation de mise en service", "recap config forti", "document de passage en exploitation".
  Do NOT use for troubleshooting (use fortigate-debug) or compliance audit (use fortigate-audit).
  Do NOT use for raw data collection without formatting (use fortigate skill).
---

# FortiGate Doc — Generation de DOE via MCP

Ce skill genere un Dossier d'Exploitation (DOE) complet pour un FortiGate, structure en 10 sections,
a partir des donnees collectees via les outils MCP.

## Prerequis

Le serveur MCP FortiGate doit etre demarre et le device enregistre.

Si le device n'est pas enregistre, utiliser `add_device` avec au minimum `host` + `ssh_password` + `ssh_port`.

---

## Workflow en 4 etapes

### Etape 1 — Informations contextuelles

Demander a l'utilisateur :
1. **Device ID** dans le MCP (ou IP + port SSH + password si pas encore enregistre)
2. **Nom du client / site** (pour l'en-tete du document)
3. **Auteur du document** (nom de l'ingenieur)
4. **Format souhaite** : Markdown (defaut) ou HTML self-contained
5. **Sections a inclure** : toutes (defaut) ou selection specifique

Verifier la connectivite avec `test_device_transports(device_id)`.

### Etape 2 — Collecte des donnees (via MCP)

Collecter les 13 categories standard :
```
collect_all_categories(device_id)
```

Ou, pour un DOE partiel, collecter uniquement les categories necessaires :

| Section DOE | Categories MCP |
|-------------|---------------|
| 1. Identite | `collect_category(device_id, "system")` |
| 2. Reseau | `collect_category(device_id, "interfaces")` + `collect_category(device_id, "zones")` |
| 3. Routage | `collect_category(device_id, "routing")` |
| 4. Flux | `collect_category(device_id, "policies")` + `collect_category(device_id, "objects")` + `collect_category(device_id, "services")` |
| 5. VPN | `collect_category(device_id, "vpn")` |
| 6. Securite | `collect_category(device_id, "security")` |
| 7. Services | `collect_category(device_id, "dhcp_dns")` |
| 8. Administration | `collect_category(device_id, "admin")` |
| 9. HA | `collect_category(device_id, "network")` |
| 10. Recommandations | Analyse transversale des donnees collectees |

Completer avec des donnees temps reel si necessaire :
- `get_arp_table(device_id)` — pour la section reseau
- `get_session_stats(device_id)` — pour la section performance
- `get_vpn_ipsec_status(device_id)` — pour la section VPN

Pour le parsing des outputs FortiOS, consulter `references/fortigate.md` du skill `fortigate`.

### Etape 3 — Structuration du document

Utiliser le template `references/doc-template.md` pour structurer le DOE en 10 sections.

**Regles de structuration :**

1. **Tableaux** : Presenter les donnees repetitives (interfaces, routes, policies) sous forme de tableaux Markdown
2. **Hierarchie** : Utiliser les niveaux de titre H1 > H2 > H3 de maniere coherente
3. **Contexte** : Ajouter des commentaires explicatifs, pas juste un dump de config
4. **Recommandations** : La section 10 doit contenir des recommandations basees sur l'analyse des donnees

**Contenu par section :**

| # | Section | Contenu attendu |
|---|---------|----------------|
| 1 | Identite | Hostname, modele, serial, firmware, uptime, licence |
| 2 | Reseau | Tableau des interfaces (nom, IP, VLAN, type, status), zones |
| 3 | Routage | Table de routage, routes statiques, routage dynamique si present |
| 4 | Flux | Tableau des policies (ID, nom, src, dst, service, action, profils, log), objets et services references |
| 5 | VPN | Tunnels IPsec (nom, peer, phase1, phase2, status), SSL VPN (portail, realms, users) |
| 6 | Securite | Profils AV, IPS, webfilter, app control, DNS filter — resume des parametres cles |
| 7 | Services | Serveurs DHCP (scope, bail, options), DNS, NTP |
| 8 | Administration | Comptes admin, logging (syslog/FAZ), SNMP, acces management |
| 9 | HA | Mode, membres du cluster, heartbeat, monitoring, sync status |
| 10 | Recommandations | Points d'attention identifies pendant l'analyse, suggestions d'amelioration |

### Etape 4 — Generation du document

**Format Markdown (defaut) :**
Generer le document directement en sortie texte.

**Format HTML self-contained :**
Si l'utilisateur demande du HTML, utiliser le template CSS du fichier `references/doc-template.md` (section HTML)
pour generer un fichier HTML autonome avec le CSS inline.

Ecrire le fichier dans le repertoire de travail :
- `DOE_<hostname>_<date>.md` pour le Markdown
- `DOE_<hostname>_<date>.html` pour le HTML

---

## References

- `references/doc-template.md` — template de structure DOE + CSS HTML
- Skill `fortigate` > `references/fortigate.md` — guide de parsing des outputs FortiOS
