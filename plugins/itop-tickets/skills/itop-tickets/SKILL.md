---
name: itop-tickets
description: >
  Gestion des tickets et incidents iTop via le bridge n8n-anvole. Consulter, rechercher,
  commenter, assigner, résoudre, pointer du temps et créer des tickets/incidents dans l'ITSM
  Anvole (itsm.cloud.anvole.com). Triggers : ticket, incident, iTop, ITSM, SLA, support,
  R-XXXX, I-XXXX, "mes tickets", "tickets ouverts/en retard", "créer un ticket",
  "pointer du temps", "résoudre le ticket", "assigner", "tickets du client X",
  "combien de tickets", "suivi support", ou toute demande liée aux tickets IT Anvole.
  Se déclenche aussi pour le Morning Briefing (volume tickets/SLA) et quand Greg parle
  d'un problème client. Utilise ce skill même pour les demandes simples — il connaît
  la bonne route vers iTop via n8n.
---

# iTop Tickets — Skill Anvole

## Contexte

iTop est l'ITSM d'Anvole (itsm.cloud.anvole.com). L'accès se fait exclusivement via le
**Claude Bridge — iTop Tickets v2**, un workflow n8n exposé en webhook sur l'instance
n8n-anvole. Ce bridge gère l'authentification, la construction des requêtes OQL, et le
parsing des réponses iTop.

Le bridge n'est PAS appelé via HTTP direct — il est déclenché via l'outil MCP
`mcp__n8n-anvole__n8n_test_workflow` avec le workflowId du bridge.

## Comment appeler le bridge

Toutes les opérations iTop passent par un seul appel :

```
mcp__n8n-anvole__n8n_test_workflow({
  workflowId: "HWjhsTJpR6VikRur",
  triggerType: "webhook",
  httpMethod: "POST",
  headers: {"X-API-Key": "<ITOP_BRIDGE_API_KEY>"},
  data: {
    action: "<action_name>",
    ...params
  }
})
```

⚠️ Le header `X-API-Key` est **obligatoire** — sans lui le bridge retourne 401.
La clé est injectée par le contexte de session (CLAUDE.md ou variables d'environnement).
Ne jamais la hardcoder dans ce skill.

Le bridge répond avec un objet JSON contenant `success`, `action`, et les données
(tickets, incidents, confirmation d'écriture, stats...).

## Actions disponibles

### Lecture — Tickets (UserRequest)

| Action | Description | Params requis | Params optionnels |
|---|---|---|---|
| `get_tickets` | Tickets ouverts (non closed/resolved) | — | `oql_filter`, `include_details` |
| `get_ticket_details` | Détail complet d'un ticket | `ticket_id` | — |
| `get_my_tickets` | Tickets assignés à un agent | — | `agent_name` (défaut: "Lauretta") |
| `search_tickets` | Recherche par mot-clé (titre + description) | `keyword` | — |
| `get_tickets_by_org` | Tickets d'un client | `org_name` | — |
| `get_tickets_by_status` | Tickets par statut | `status` | — |
| `get_tickets_by_priority` | Tickets par priorité | `priority` | — |
| `get_overdue_tickets` | Tickets en dépassement SLA | — | — |

### Lecture — Incidents

Mêmes patterns que les tickets, avec les actions :
`get_incidents`, `get_incident_details`, `get_my_incidents`, `search_incidents`,
`get_incidents_by_org`, `get_incidents_by_status`, `get_incidents_by_priority`,
`get_overdue_incidents`

Les params sont identiques — remplace juste "ticket" par "incident" dans le nom d'action.
Le `ticket_id` reste le param pour les détails d'un incident.

### Lecture — Référentiel

| Action | Description | Params |
|---|---|---|
| `get_organizations` | Liste des organisations clients | — |
| `get_contacts` | Contacts (+ audit qualité) | `org_name?` |
| `get_services` | Services + sous-catégories | — |
| `get_teams` | Équipes support | — |

### Écriture

| Action | Description | Params requis | Params optionnels |
|---|---|---|---|
| `add_comment` | Ajouter un commentaire à un ticket | `ticket_id`, `comment` | `private` (bool), `class` |
| `assign_ticket` | Assigner un ticket à un agent | `ticket_id`, `agent_name` | `class` |
| `resolve_ticket` | Résoudre un ticket | `ticket_id`, `solution` | `resolution_code`, `time_spent`, `agent_name`, `class` |
| `update_status` | Changer le statut via stimulus | `ticket_id`, `stimulus` | `class`, `fields` |
| `create_ticket` | Créer une UserRequest | `title`, `org_name`, `description` | `caller`, `priority`, `service`, `subcategory` |
| `create_incident` | Créer un Incident | `title`, `org_name`, `description` | `caller`, `priority`, `service`, `subcategory` |
| `add_timesheet` | Pointer du temps sur un ticket | `ticket_id`, `time_spent` (en secondes) | `agent_name`, `comment`, `class` |

### Statistiques

| Action | Description | Params requis | Params optionnels |
|---|---|---|---|
| `get_ticket_stats` | Volumes, répartition, SLA | — | `org_name` (filtrer par client), `days` (période en jours) |

## Workflow type par cas d'usage

### "Montre-moi mes tickets"
1. Appeler `get_my_tickets` (agent_name optionnel, défaut = Greg)
2. Présenter en tableau : ref, titre, client, priorité, statut, date

### "Tickets du client SYVADE"
1. Appeler `get_tickets_by_org` avec `org_name: "SYVADE"`
2. Présenter triés par priorité

### "Combien de tickets en cours ?"
1. Appeler `get_ticket_stats`
2. Résumer les chiffres clés

### "Crée un ticket pour Pharmacie Montebello"
1. Demander les infos manquantes (titre, description, priorité)
2. Appeler `create_ticket` avec les params
3. Confirmer la création avec la ref retournée

### "Résous le ticket R-001234"
1. Appeler `get_ticket_details` avec le ticket_id pour vérifier le contexte
2. Demander la solution si non fournie
3. Appeler `resolve_ticket`
4. Confirmer

### "Pointe 30 minutes sur R-001234"
1. Appeler `add_timesheet` avec `ticket_id` et `time_spent: 1800` (en secondes)
   → Pointe le temps sans résoudre ni changer le statut du ticket

## Règles importantes

- **Jamais d'appel HTTP direct** vers itsm.cloud.anvole.com — toujours passer par le bridge n8n
- **Confirmation obligatoire** avant toute action d'écriture (create, resolve, assign, update_status)
- **Le ticket_id** est l'ID numérique iTop, pas la ref (R-001234). Si l'utilisateur donne une ref,
  chercher d'abord avec `search_tickets` ou `get_ticket_details` pour obtenir l'ID
- **agent_name par défaut** : "Lauretta" (Greg) — sauf indication contraire
- **class par défaut** : "UserRequest" pour les tickets, "Incident" pour les incidents
- Les réponses du bridge sont déjà parsées et nettoyées — pas besoin de post-traitement

## Référence détaillée

Pour le schéma complet des réponses, les champs disponibles par type d'objet, et les
valeurs possibles pour les statuts/priorités/stimulus, consulter :
→ `references/bridge-api.md`

## Troubleshooting

Si le bridge retourne une erreur :
- `success: false` avec un message → afficher le message d'erreur à l'utilisateur
- Timeout → le bridge peut être surchargé, réessayer une fois
- `available_actions` dans la réponse d'erreur → le bridge liste les actions valides
