---
name: network-switch-analysis
description: >
  Use this skill for multi-switch network analysis, audits, and inventory across multiple vendors.
  ALWAYS trigger when the user wants to analyze, audit, or inventory MULTIPLE switches or an entire
  site's network — especially when switches are from different vendors (HP, Cisco, Aruba mix).
  Orchestrates vendor-specific collection skills and produces comprehensive reports: equipment
  identification per port (PCs, IP phones, APs, cascaded switches), cross-switch VLAN analysis,
  topology mapping, segmentation recommendations, anomaly detection.
  French triggers: "etat des lieux reseau", "audit reseau", "inventaire multi-switches",
  "analyse des switches", "ce qui est branche sur chaque port", "cartographie reseau",
  "rapport reseau du site", "segmentation VLAN", "topologie switches".
  Do NOT use when the user wants to collect from a SINGLE switch of a known vendor —
  use the vendor-specific skill directly (cisco-sb, hp-procurve, hp-officeconnect, aruba-instant-on).
---

# Network Switch Analysis

Expert reseau. Analyser les donnees d'un ou plusieurs switches pour produire un inventaire detaille des ports, un etat des lieux VLAN, et des recommandations de segmentation.

## Workflow

```
Step 0 : Guided Onboarding → collecte des donnees
        |
Etape 1 : Analyse (detection vendor + parsing + identification + classification + anomalies)
        |
Etape 2 : Rapport HTML (references/report-template.md)
```

---

## Lazy loading des references

Ne lire QUE les fichiers necessaires a l'etape en cours. Ne JAMAIS charger toutes les references d'un coup.

| Etape | Fichier(s) a charger |
|-------|---------------------|
| Step 0 — Onboarding | Aucun (dialogue utilisateur) |
| Step 0 — CLI vendor | `references/<vendor>.md` (UN seul selon le vendor detecte) |
| Step 0 — Skill delegue | Le skill charge ses propres references |
| Etape 1 — Analyse | `references/best-practices.md` + `references/oui-vendors.md` |
| Etape 2 — Rapport | `references/report-template.md` |

---

## Step 0 — Guided Onboarding (OBLIGATOIRE)

Ne jamais sauter cette etape.

### 0a. Inventaire des switches

Demander : **"Combien de switches souhaites-tu analyser ?"**
Creer une liste numerotee : SW1, SW2, SW3, ...

### 0b. Identification vendor/modele

Pour chaque switch : **"Quel est le vendor et modele de SW[N] ?"**
Si inconnu : *"L'administration se fait en CLI (SSH) ou via une interface web ?"*

### 0c. Matrice vendor → mode d'acces

**ATTENTION :** Cisco SG300/SG500 (Small Business) != Netgear GS3xx (Smart Switch). Lettres inversees (SG vs GS).

| Vendor / Modele | Mode d'acces | Reference |
|----------------|-------------|-----------|
| Cisco IOS / IOS-XE (Catalyst 2xxx, 3xxx, 9xxx) | CLI SSH | `references/cisco-ios.md` |
| **Cisco Small Business (SG300, SG500, SG350, CBS)** | **Skill `cisco-sb`** | skill `cisco-sb` |
| Aruba AOS-CX (CX 6200, 6300, 6400, 8320, 8360) | CLI SSH | `references/aruba-aos-cx.md` |
| **HP ProCurve / Aruba ProVision (2620, 2530, 2920, 3800)** | **Skill `hp-procurve`** | skill `hp-procurve` |
| **Aruba Instant On (1930, 1960)** | **Skill `aruba-instant-on`** | skill `aruba-instant-on` |
| **HP OfficeConnect (1920S, 1920)** | **Skill `hp-officeconnect`** | skill `hp-officeconnect` |
| Netgear ProSafe Fully Managed (GS7xx, M4xxx) | CLI SSH | `references/netgear.md` |
| Netgear Smart / Plus (GS1xx, GS3xx) | Web uniquement | mode guide manuel |
| Inconnu / autre | Demander a l'utilisateur | — |

### 0d. Collecte guidee

**Mode CLI** (Cisco IOS, Aruba AOS-CX, Netgear ProSafe) :
Lire `references/<vendor>.md` pour les commandes exactes a copier-coller.
Attendre que l'utilisateur colle les resultats.

**Mode Skill** (vendor skills dedies) :

| Vendor | Skill | Protocole |
|--------|-------|-----------|
| Aruba Instant On | `aruba-instant-on` | Playwright + WCD XML |
| HP OfficeConnect | `hp-officeconnect` | Playwright + LSP |
| HP ProCurve | `hp-procurve` | SSH ProVision |
| Cisco SB | `cisco-sb` | SSH |

Deleguer entierement au skill. Il gere ses propres references, scripts et parsing.

### 0e. Confirmation plan

Afficher le plan et attendre confirmation :
```
Voici comment je vais collecter les donnees :
- SW1 [modele] → [mode d'acces]
- SW2 [modele] → [mode d'acces]
C'est correct ?
```

---

## Etape 1 — Analyse

### Donnees essentielles
- Table MAC (`show mac address-table` ou equivalent)
- Configuration interfaces (`show running-config` ou `show interfaces`)

### Donnees enrichissantes
- Voisins LLDP/CDP → identifie phones IP, APs, switches aval
- Statut interfaces → detecte ports inactifs
- VLANs cibles de l'utilisateur (demander si recommandations d'assignation)

### Detection vendor

| Indice dans l'output | Vendor/OS probable |
|---------------------|-------------------|
| `Cisco IOS Software` ou prompt `Switch#` | Cisco IOS/IOS-XE |
| `ArubaOS-CX` | Aruba AOS-CX |
| `HP ProCurve` ou `ProVision` | Aruba ProVision (legacy) |
| `(C)opyright.*NETGEAR` | Netgear ProSafe |
| Donnees interface web Aruba | Aruba Instant On |

Apres detection, lire `references/<vendor>.md` pour les formats de parsing.

### Identification, classification, anomalies et correlation

**Lire `references/best-practices.md`** (sections 9 a 12) pour les regles completes :
- Section 9 : Identification des equipements (LLDP, CDP, OUI, heuristiques, PC derriere phone)
- Section 10 : Classification et % de confiance (scoring, types)
- Section 11 : Detection d'anomalies (12 regles, 3 niveaux severite)
- Section 12 : Correlation multi-switch (VLAN croise, LLDP bilateral, VMs, VRRP)

**Lire `references/oui-vendors.md`** pour le lookup OUI → type d'equipement.

### Regles cles (resume)
- LLDP = 95% confiance (gold standard). CDP = 90%.
- Source web uniquement → plafonner a 70%.
- % final = min(score, 99%). Jamais 100%.
- Phone IP sans voice VLAN = anomalie ATTENTION.
- VLAN 1 en production = anomalie a signaler.
- En multi-switch : UNE seule table VLAN croisee, jamais des tables separees.

---

## Convention de sortie

Le rapport est **TOUJOURS un fichier HTML autonome** (self-contained avec CSS inline). Ne JAMAIS produire de Markdown.

Fichier : `<repertoire courant>/switch-reports/<site-ou-hostname>-<YYYY-MM-DD>.html`

Ne jamais ecrire dans `workspace/` (reserve aux evaluations).

---

## Etape 2 — Rapport HTML

**AVANT de generer, LIRE `references/report-template.md`** pour le CSS, le squelette HTML et les regles visuelles.

### 8 sections obligatoires (dans cet ordre)

1. **Header** (`div.header`) — bandeau sombre : titre site, date, nb switches, sources, confiance max
2. **KPIs** (`div.summary-grid`) — 6+ cartes : switches, ports actifs, phones, APs, VLANs, anomalies (`.kpi.warn`)
3. **Topologie** (`div.topo > pre`) — ASCII art avec box-drawing, liens port-a-port, VMs, anomalies inline
4. **Anomalies** — 3 boites severite : `.anomaly-box.crit` (CRITIQUE) + `.anomaly-box` (ATTENTION) + `.rec-box` (AMELIORATION)
5. **VLANs** — table croisee multi-switch (ID, Nom SW1, Nom SW2, Role, Ports SW1, Ports SW2, Statut badge)
6. **Inventaire par switch** — switch-card (`.cisco`/`.hp`/`.fortinet`) + table ports (badges, PoE bars, confiance, ports DOWN groupes)
7. **Recap equipements** — table agregee par type sur tous les switches
8. **Footer** — date, skill, sources, confiance max

---

## Regles importantes

1. **Ne jamais inventer de VLAN IDs** — demander a l'utilisateur ses VLANs cibles
2. **Toujours afficher % confiance et source** (LLDP, CDP, OUI, Web, heuristique)
3. **Anomalies par severite** — 3 boites distinctes, jamais de liste plate
4. **Ports DOWN groupes** — 3+ consecutifs → "Port X-Y" en un seul `<tr class="port-inactive">`
5. **HTML obligatoire** — toujours `.html` autonome, jamais Markdown
6. **KPIs en premier** — header sombre + grille KPIs avant tout contenu
7. **Table VLAN cross-switch** — en multi-switch, UNE seule table, jamais separee par switch
8. **Web = 70% max** — confiance plafonnee si source interface web uniquement
9. **Lazy loading** — ne charger que les references de l'etape en cours
10. **Ne jamais inventer de donnees** — si une info manque, l'indiquer comme "non disponible"

---

## References disponibles

| Fichier | Usage | Quand charger |
|---------|-------|---------------|
| `references/cisco-ios.md` | Cisco IOS/IOS-XE Catalyst — formats CLI | Step 0 (si Cisco IOS) |
| `references/aruba-aos-cx.md` | Aruba AOS-CX 6xxx/8xxx — formats CLI | Step 0 (si AOS-CX) |
| `references/aruba-provision.md` | HP/Aruba ProVision 2530/2920/3800 — formats CLI | Step 0 (si ProVision) |
| `references/netgear.md` | Netgear ProSafe — formats CLI | Step 0 (si Netgear) |
| `references/oui-vendors.md` | Lookup OUI → type equipement | Etape 1 (analyse) |
| `references/best-practices.md` | Segmentation, identification, classification, anomalies, correlation | Etape 1 (analyse) |
| `references/report-template.md` | CSS, squelette HTML, regles visuelles (badges, PoE, groupement) | Etape 2 (rapport) |

## Scripts disponibles

| Script | Usage |
|--------|-------|
| `scripts/oui_lookup.py` | `python scripts/oui_lookup.py <MAC>` — vendor + type hint |
| `scripts/analyze_switch.py` | `python scripts/analyze_switch.py <fichier>` — analyse complete |

**Note Windows :** `python3` peut etre indisponible. Utiliser **Node.js** pour le scripting.
