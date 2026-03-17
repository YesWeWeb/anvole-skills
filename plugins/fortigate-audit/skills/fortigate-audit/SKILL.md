---
name: fortigate-audit
description: >
  Use this skill to audit a FortiGate firewall against CIS Benchmark 7.4.x and ANSSI security recommendations.
  ALWAYS trigger when the user wants a compliance audit, security assessment, hardening check, or conformity
  report on a FortiGate. Covers: CIS controls (network, system, password, SNMP, admin, HA, policies, security
  profiles, VPN, logging), ANSSI recommendations (chiffrement, durcissement, journalisation, administration).
  French triggers: "audit FortiGate", "conformite CIS", "audit securite forti", "check ANSSI", "durcissement
  FortiGate", "rapport conformite", "audit CIS forti", "verifier la securite du firewall", "hardening forti",
  "score de conformite FortiGate".
  Do NOT use for data collection without audit (use fortigate skill) or for troubleshooting (use fortigate-debug).
---

# FortiGate Audit — Conformite CIS / ANSSI

Ce skill audite un FortiGate contre les referentiels CIS Benchmark 7.4.x et ANSSI.
**50 controles** (40 CIS + 10 ANSSI), **4 verdicts** (PASS / FAIL / MANUAL / N/A), **rapport HTML structure**.

---

## Contraintes d'execution

L'ensemble de l'audit doit se derouler en **3 etapes** (1 bash + 1 read/write + 1 bash), sans tatonnement.

**Chemins** : Toujours utiliser `C:/tmp/...` (pas `/c/tmp/...`) dans les arguments de scripts Node.js sur Windows.

**Dependance ssh2** : Si `require('ssh2')` echoue, installer avec :
```bash
npm install --prefix C:/tmp ssh2
```
Puis executer le collecteur avec `NODE_PATH=C:/tmp/node_modules`.

**Interdictions** :
- Ne JAMAIS lire `audit-data.json` directement — ce fichier fait 200KB+ avec des lignes de 100K+ caracteres. Utiliser `audit-extract.json` (8-10KB) produit automatiquement par le collecteur.
- Ne JAMAIS utiliser `python3` ou `python` — ce systeme n'a pas Python. Utiliser `node` pour tous les scripts.
- Ne JAMAIS deleguer l'analyse a un sub-agent. Lire `audit-extract.json` et les references, puis generer le rapport directement.
- Ne JAMAIS essayer de parser les donnees FortiOS manuellement avec des commandes bash/node ad-hoc. Le script d'extraction fait tout le travail.

---

## Workflow en 3 etapes

### Etape 1 — Collecte SSH + Extraction (1 commande bash)

Le script de collecte se connecte en SSH, execute 25 commandes FortiOS, et produit automatiquement 3 fichiers :
- `audit-data.json` — donnees brutes (ne pas lire ce fichier)
- `audit-extract.json` — extrait compact avec uniquement les champs necessaires aux 50 controles (~8KB)
- `raw_output.txt` — sortie brute complete (backup)

```bash
NODE_PATH=C:/tmp/node_modules node "<skill_path>/scripts/collect-audit-data.js" <host> <port> <user> <password> C:/tmp/fortigate-audit-output
```

Si l'extraction automatique echoue (message "Warning: extraction failed"), lancer manuellement :
```bash
node "<skill_path>/scripts/extract-audit-fields.js" C:/tmp/fortigate-audit-output/audit-data.json C:/tmp/fortigate-audit-output/audit-extract.json
```

**Points importants sur FortiOS et SSH :**
- FortiOS ne supporte PAS la commande `echo` — ne jamais utiliser de markers echo
- FortiOS peut bloquer les connexions SSH rapides (rate-limiting) — attendre 30s entre les tentatives si "Connection reset"
- Le script desactive la pagination automatiquement
- L'algorithme `curve25519-sha256@libssh.org` est inclus dans les algorithmes supportes

**Fallback MCP** : Si le serveur MCP FortiGate est disponible, utiliser `collect_all_categories(device_id)` au lieu du script SSH. Dans ce cas, lancer manuellement le script d'extraction sur le JSON obtenu.

### Etape 2 — Analyse et rapport markdown (Read + Write)

Lire ces 3 fichiers en parallele :
1. `C:/tmp/fortigate-audit-output/audit-extract.json` — donnees du FortiGate (compact, ~8KB)
2. `references/cis-checks.md` — 40 controles CIS avec criteres PASS/FAIL et sources
3. `references/anssi-checks.md` — 10 controles ANSSI supplementaires

Puis appliquer les 50 controles en utilisant les donnees de `audit-extract.json`. Le JSON d'extraction est structure ainsi :

| Section extract | Controles couverts |
|---|---|
| `device` | En-tete du rapport (hostname, model, firmware, serial) |
| `system_global` | 2.1.1 a 2.1.18, 2.2.2, 2.4.4, 2.4.5, 2.4.7, A.1, A.2 |
| `dns` | 1.1 |
| `ntp` | 2.1.4 |
| `password_policy` | 2.2.1 |
| `ha` | 2.6.1, 2.6.2 |
| `zones` | 1.2 |
| `admins` | 2.4.1, 2.4.2, 2.4.3 |
| `wan_interfaces` | 1.3, A.1 |
| `snmp` | 2.3.1, 2.3.2 |
| `local_in_policy_count` | 2.4.6 |
| `policies` | 3.1, 3.2, 3.4, A.6, A.7, A.8 |
| `log` | 7.1.1, A.4, A.5 |
| `vpn` | 6.1.1, 6.1.2, A.10 |
| `security_profiles` | 4.1.1, 4.2.4, 4.2.5, 4.3.2, 5.1, 5.2 |
| `autoupdate` | A.9 |

**Verdicts :**
- **PASS** : la valeur constatee correspond au critere
- **FAIL** : la valeur ne correspond pas (risque de securite) — inclure la commande corrective FortiOS
- **MANUAL** : verification automatique impossible (donnees insuffisantes ou contexte specifique)
- **N/A** : le controle ne s'applique pas au contexte de l'equipement

**Regles N/A automatiques :**
- `ha.mode == "standalone"` → controles 2.6.1 et 2.6.2 sont **N/A**
- Controle A.4 en FAIL (aucun serveur de log externe) → controle A.5 est **N/A**

**Reduire les MANUAL au minimum.** La plupart des controles peuvent etre evalues automatiquement depuis `audit-extract.json`. Utiliser MANUAL uniquement quand la donnee est reellement absente ou quand le verdict depend du contexte metier.

**Controles partiellement automatisables (eviter MANUAL si possible) :**
- **1.3 (Services WAN)** : Verifier `wan_interfaces[].allowaccess` — pas de https/ssh/ping/snmp sur les interfaces WAN
- **2.1.12 (CPU logging)** : `system_global["log-single-cpu-high"]` — si present et `= enable` → PASS, `= disable` → FAIL
- **A.2 (SSH algorithms)** : `system_global["ssh-enc-algo"]` et `system_global["ssh-mac-algo"]` — si presents, evaluer
- **3.1 (Politiques inutilisees)** : `policies.disabled_count` — si > 0 → FAIL avec nombre
- **4.2.5 (Grayware)** : `security_profiles.av_profiles[].grayware` — si `= enable` → PASS

**Score de conformite** = PASS / (PASS + FAIL) x 100 (les MANUAL et N/A sont exclus du calcul)

Generer le rapport en utilisant le template `references/audit-report-template.md` et le sauvegarder dans `C:/tmp/fortigate-audit-output/audit-report.md`.

### Etape 3 — Conversion en HTML (1 commande bash)

```bash
node "<skill_path>/scripts/generate-html-report.js" C:/tmp/fortigate-audit-output/audit-report.md C:/tmp/fortigate-audit-output/audit-report.html
```

**Architecture** : Le rapport HTML est genere via un pipeline React+Vite+vite-plugin-singlefile (identique a Maester). Le template pre-compile (`report/dist/index.html`) est commite dans le repo. Le script Node.js parse le markdown, enrichit avec les references, et injecte le JSON dans le template. Seul Node.js est necessaire a l'execution (pas de npm/vite).

Le HTML produit est autonome (standalone) avec :
- Panneau lateral Radix UI (Sheet) avec details complets au clic sur un controle
- Navigation clavier (Echap pour fermer, fleches pour parcourir les controles)
- Navigation Previous/Next avec compteur tabular-nums
- Recherche textuelle et filtres multi-criteres (statut, severite, categorie)
- Tri par colonne (ID, severite, statut) avec ordres custom
- Badges colores PASS (vert), FAIL (rouge), MANUAL (gris), N/A (slate) avec icones
- Badges de severite (critical/high/medium) avec opacity hover
- Table 4 colonnes (ID, Titre, Severite, Statut)
- Cartes colorees dans le panel (resultat, remediation, referentiel)
- Donut chart SVG + barres horizontales par categorie
- Summary cards avec progress bars
- Code blocks styles pour les commandes correctives
- Bouton "Exporter PDF" via window.print()
- Mode sombre / clair (toggle avec Tailwind dark class)
- ID rapport unique (SHA256) et empreinte source pour tracabilite
- Layout print-friendly

Ouvrir le HTML dans le navigateur pour l'utilisateur a la fin.

**Modification du template React** (rare) : Si l'UI du rapport doit etre modifiee :
```bash
cd "<skill_path>/report" && npm install && npm run build
```
Puis commiter le nouveau `report/dist/index.html`.

---

## Scripts embarques

| Script | Role | Entree | Sortie |
|--------|------|--------|--------|
| `scripts/collect-audit-data.js` | Collecte SSH + extraction auto | host, port, user, pass, output_dir | audit-data.json, audit-extract.json, raw_output.txt |
| `scripts/extract-audit-fields.js` | Extraction des champs d'audit | audit-data.json | audit-extract.json (~8KB) |
| `scripts/generate-html-report.js` | Parse MD + inject JSON dans template React | audit-report.md | audit-report.html |

## App React (report/)

Le dossier `report/` contient l'application React+Vite qui genere le template HTML standalone :
- `report/src/` — composants React (App, Header, SummaryCards, DonutChart, BarChart, FilterBar, ResultsTable, DetailPanel, ResultInfo, etc.)
- `report/dist/index.html` — template pre-compile (commite, ~320KB standalone)
- Le template contient `window.__AUDIT_DATA__={"__PLACEHOLDER__":true}` que le script Node.js remplace par le JSON reel

---

## References

- `references/cis-checks.md` — 40 controles CIS Benchmark 7.4.x (avec severite et sources dans audit-extract.json)
- `references/anssi-checks.md` — 10 controles ANSSI supplementaires
- `references/audit-report-template.md` — template du rapport d'audit
