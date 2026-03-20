---
name: itop-tickets
description: >
  Gestion des tickets et incidents iTop via le MCP itop (serveur MCP local stdio).
  Consulter, rechercher, commenter, assigner, résoudre, pointer du temps et créer
  des tickets/incidents dans l'ITSM Anvole (itsm.cloud.anvole.com).
  Triggers : ticket, incident, iTop, ITSM, SLA, support, R-XXXX, I-XXXX,
  "mes tickets", "tickets ouverts/en retard", "créer un ticket",
  "pointer du temps", "résoudre le ticket", "assigner", "tickets du client X",
  "combien de tickets", "suivi support", ou toute demande liée aux tickets IT Anvole.
  Se déclenche aussi pour le Morning Briefing (volume tickets/SLA) et quand Greg
  parle d'un problème client.
---

# iTop Tickets — Skill Anvole

## Contexte

iTop est l'ITSM d'Anvole (itsm.cloud.anvole.com). L'accès se fait via le **MCP itop**
(`mcp__itop__`), un serveur MCP local (stdio) qui appelle le bridge n8n `claude-itop`.
L'authentification est gérée par les variables d'environnement du MCP — aucune clé
API à manipuler dans ce skill.

## Comment appeler iTop

Utiliser directement les outils MCP `mcp__itop__*`. Exemples :

```
mcp__itop__itop_get_my_tickets({ agent_name: "Lauretta" })
mcp__itop__itop_search_incidents({ keyword: "I-260318-034592" })
mcp__itop__itop_get_incident_details({ ref: "I-260318-034592" })
```

## Outils disponibles (28)

### Lecture — Tickets (UserRequest) — 8 outils

| Outil MCP | Description | Params requis | Params optionnels |
|---|---|---|---|
| `itop_get_tickets` | Tickets ouverts (non closed/resolved) | — | `oql_filter`, `include_details` |
| `itop_get_ticket_details` | Détail complet d'un ticket | `ticket_id` OU `ref` | — |
| `itop_get_my_tickets` | Tickets assignés à un agent | — | `agent_name` (défaut: "Lauretta") |
| `itop_search_tickets` | Recherche par mot-clé (titre, description, ref) | `keyword` | — |
| `itop_get_tickets_by_org` | Tickets d'un client | `org_name` | — |
| `itop_get_tickets_by_status` | Tickets par statut | `status` | — |
| `itop_get_tickets_by_priority` | Tickets par priorité | `priority` | — |
| `itop_get_overdue_tickets` | Tickets en dépassement SLA | — | — |

### Lecture — Incidents — 8 outils

| Outil MCP | Description | Params requis | Params optionnels |
|---|---|---|---|
| `itop_get_incidents` | Incidents ouverts | — | `oql_filter`, `include_details` |
| `itop_get_incident_details` | Détail complet d'un incident | `ticket_id` OU `ref` | — |
| `itop_get_my_incidents` | Incidents assignés à un agent | — | `agent_name` (défaut: "Lauretta") |
| `itop_search_incidents` | Recherche par mot-clé (titre, description, ref) | `keyword` | — |
| `itop_get_incidents_by_org` | Incidents d'un client | `org_name` | — |
| `itop_get_incidents_by_status` | Incidents par statut | `status` | — |
| `itop_get_incidents_by_priority` | Incidents par priorité | `priority` | — |
| `itop_get_overdue_incidents` | Incidents en dépassement SLA | — | — |

### Lecture — Référentiel — 4 outils

| Outil MCP | Description | Params |
|---|---|---|
| `itop_get_organizations` | Organisations clients | — |
| `itop_get_contacts` | Contacts (+ filtre org) | `org_name?` |
| `itop_get_services` | Catalogue de services + sous-catégories | — |
| `itop_get_teams` | Équipes support | — |

### Écriture — 7 outils

| Outil MCP | Description | Params requis | Params optionnels |
|---|---|---|---|
| `itop_add_comment` | Commentaire public/privé | `ticket_id`, `comment` | `private` (bool), `class` |
| `itop_assign_ticket` | Assigner à un agent | `ticket_id`, `agent_name` | `class` |
| `itop_resolve_ticket` | Résoudre (+ solution + time_spent) | `ticket_id`, `solution` | `resolution_code`, `time_spent`, `agent_name`, `class` |
| `itop_update_status` | Transition par stimulus | `ticket_id`, `stimulus` | `class`, `fields` |
| `itop_create_ticket` | Créer un UserRequest | `title`, `org_name`, `description` | `caller`, `priority`, `service`, `subcategory` |
| `itop_create_incident` | Créer un Incident | `title`, `org_name`, `description` | `caller`, `priority`, `service`, `subcategory` |
| `itop_add_timesheet` | Pointer du temps (en secondes) | `ticket_id`, `time_spent` | `agent_name`, `comment`, `class` |

### Statistiques — 1 outil

| Outil MCP | Description | Params optionnels |
|---|---|---|
| `itop_get_ticket_stats` | Volumes, SLA, distribution | `org_name`, `days` |

## Règles CRITIQUES

### "Mes tickets" = TOUJOURS tickets + incidents

Quand Greg dit "mes tickets", "montre-moi mes tickets", "quoi de neuf côté support",
ou toute demande qui implique de voir ses tâches iTop, il faut **TOUJOURS** lancer
les deux appels en parallèle :
- `itop_get_my_tickets` (UserRequests)
- `itop_get_my_incidents` (Incidents)

Puis fusionner les résultats dans une vue unifiée. Ne jamais oublier les incidents.
Même logique pour "tickets du client X" → `get_tickets_by_org` + `get_incidents_by_org`.

### Recherche par ref

- Si l'utilisateur donne une ref type `R-XXXXXX-XXXXXX` ou `I-XXXXXX-XXXXXX`, utiliser
  directement `itop_search_tickets` ou `itop_search_incidents` — le bridge détecte le
  pattern et fait un `WHERE ref = '...'` automatiquement.
- Pour les détails, utiliser `itop_get_ticket_details({ ref: "R-..." })` ou
  `itop_get_incident_details({ ref: "I-..." })` — pas besoin de résoudre l'ID d'abord.
- Préfixe `R-` = UserRequest, préfixe `I-` = Incident.

### Confirmation obligatoire

Toujours demander confirmation avant une action d'écriture (create, resolve, assign,
update_status, add_comment, add_timesheet).

### Valeurs par défaut

- **agent_name** : "Lauretta" (Greg) sauf indication contraire
- **class** : "UserRequest" pour les tickets, "Incident" pour les incidents
- **response_format** : "markdown" pour l'affichage, "json" si besoin de post-traitement

## Workflows par cas d'usage

### "Montre-moi mes tickets"
1. Appeler EN PARALLÈLE `itop_get_my_tickets` + `itop_get_my_incidents`
2. Fusionner les résultats
3. Présenter en tableau unifié : ref, titre, client, priorité, statut, date

### "Tickets du client SYVADE"
1. Appeler EN PARALLÈLE `itop_get_tickets_by_org` + `itop_get_incidents_by_org` avec `org_name: "SYVADE"`
2. Fusionner, trier par priorité

### "C'est quoi le ticket I-260318-034592 ?"
1. Préfixe `I-` → c'est un incident
2. Appeler `itop_get_incident_details({ ref: "I-260318-034592" })`
3. Présenter les détails complets (logs, solution, time_spent)

### "Résous le ticket R-001234"
1. Appeler `itop_get_ticket_details({ ref: "R-001234" })` pour vérifier le contexte
2. Demander la solution si non fournie
3. Appeler `itop_resolve_ticket` avec le `ticket_id` numérique
4. Confirmer

### "Pointe 30 minutes sur R-001234"
1. Appeler `itop_add_timesheet` avec `ticket_id` et `time_spent: 1800` (en secondes)
   → Pointe le temps sans résoudre ni changer le statut

### "Combien de tickets en cours ?"
1. Appeler `itop_get_ticket_stats`
2. Résumer les chiffres clés (volumes, SLA, distribution)

## Référence détaillée

Pour le schéma complet des réponses, les champs disponibles par type d'objet, et les
valeurs possibles pour les statuts/priorités/stimulus, consulter :
→ `references/bridge-api.md`
