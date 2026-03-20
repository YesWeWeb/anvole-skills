# Claude Bridge — iTop Tickets v2 — Référence API

## Informations de connexion

- **Workflow ID** : `HWjhsTJpR6VikRur`
- **Instance n8n** : n8n-anvole (MCP `mcp__n8n-anvole__n8n_test_workflow`)
- **Trigger type** : webhook (POST)
- **iTop backend** : https://itsm.cloud.anvole.com/itop/webservices/rest.php
- **API version** : 1.3

## Appel type

```json
{
  "workflowId": "HWjhsTJpR6VikRur",
  "triggerType": "webhook",
  "httpMethod": "POST",
  "headers": {"X-API-Key": "<ITOP_BRIDGE_API_KEY>"},
  "data": {
    "action": "get_tickets",
    "oql_filter": "WHERE priority = 1"
  }
}
```

⚠️ Le header `X-API-Key` est obligatoire (401 sans). La clé vient du contexte de session.

## Champs retournés par type d'objet

### Tickets (UserRequest) — champs standard
ref, id, title, org_id, org_id_friendlyname, caller_id_friendlyname,
agent_id_friendlyname, team_id_friendlyname, priority, urgency, impact,
status, start_date, last_update, close_date, service_name,
servicesubcategory_name, description, resolution_code,
sla_tto_passed, sla_ttr_passed, tto, ttr

### Tickets — champs détaillés (include_details ou get_ticket_details)
Tous les champs standard + public_log, private_log, solution, time_spent

### Incidents
Mêmes champs que tickets + operational_status

### Organisations
id, name, status, parent_id_friendlyname

### Contacts
id, name, first_name, email, phone, mobile_phone,
org_id_friendlyname, status, friendlyname

### Services
id, name, description, org_id_friendlyname, status

### Sous-catégories de service
id, name, description, service_id_friendlyname, status

### Équipes
id, name, org_id_friendlyname, status

## Valeurs de référence

### Statuts de ticket (lifecycle UserRequest)
- `new` — Nouveau
- `assigned` — Assigné
- `pending` — En attente (retour client)
- `resolved` — Résolu
- `closed` — Clôturé
- `escalated_tto` — Escaladé TTO
- `escalated_ttr` — Escaladé TTR

### Priorités
- `1` — Critique
- `2` — Haute
- `3` — Moyenne (défaut)
- `4` — Basse

### Stimulus (pour update_status)
- `ev_assign` — Assigner
- `ev_reassign` — Réassigner
- `ev_resolve` — Résoudre
- `ev_close` — Clôturer
- `ev_reopen` — Réouvrir
- `ev_pending` — Mettre en attente
- `ev_timeout` — Timeout

### Resolution codes
- `fixed` — Corrigé
- `duplicate` — Doublon
- `not_a_bug` — Pas un bug
- `wont_fix` — Ne sera pas corrigé
- `assistance` — Assistance fournie

## Format de réponse du bridge

### Succès — Lecture
```json
{
  "success": true,
  "action": "get_tickets",
  "count": 12,
  "tickets": [
    {
      "id": "1234",
      "ref": "R-001234",
      "title": "Problème imprimante",
      "org": "Pharmacie Montebello",
      "caller": "Jean Dupont",
      "agent": "Gregory Lauretta",
      "team": "Support N2",
      "priority": "3",
      "status": "assigned",
      "start_date": "2026-03-15 09:00:00",
      "last_update": "2026-03-16 14:30:00",
      "sla_tto_passed": "no",
      "sla_ttr_passed": "no"
    }
  ],
  "warnings": [],
  "timestamp": "2026-03-17T10:00:00.000Z"
}
```

### Succès — Écriture
```json
{
  "success": true,
  "action": "resolve_ticket",
  "message": "Ticket R-001234 resolved successfully",
  "ticket_id": "1234",
  "warnings": ["Ce ticket n'a pas de timesheet"],
  "timestamp": "2026-03-17T10:05:00.000Z"
}
```

### Erreur
```json
{
  "success": false,
  "action": "unknown",
  "error": "Action inconnue: get_tockets",
  "available_actions": {
    "read_tickets": [...],
    "read_incidents": [...],
    "read_referentiel": [...],
    "write": [...]
  },
  "timestamp": "2026-03-17T10:00:00.000Z"
}
```

## Actions détaillées

### get_tickets
Retourne tous les tickets non closed/resolved par défaut.
- `oql_filter` (string) : filtre OQL additionnel, ex: `"WHERE priority = 1 AND org_id_friendlyname LIKE '%SYVADE%'"`
- `include_details` (bool) : inclure public_log, private_log, solution, time_spent

### get_ticket_details
Retourne le détail complet d'un ticket unique.
- `ticket_id` (int, requis) : ID numérique iTop

### get_my_tickets
Retourne les tickets assignés à un agent spécifique.
- `agent_name` (string, défaut "Lauretta") : nom partiel de l'agent (LIKE match)

### search_tickets
Recherche dans titre ET description.
- `keyword` (string, requis) : terme de recherche

### get_tickets_by_org
Filtre par nom d'organisation (LIKE match).
- `org_name` (string, requis) : nom partiel du client

### get_tickets_by_status
Filtre par statut exact.
- `status` (string, requis) : un des statuts listés ci-dessus

### get_tickets_by_priority
Filtre par priorité.
- `priority` (string, requis) : "1", "2", "3" ou "4"

### get_overdue_tickets
Retourne les tickets ayant dépassé leur SLA (TTO ou TTR passed = yes).
Aucun paramètre requis.

### add_comment
Ajoute un log entry sur un ticket.
- `ticket_id` (int, requis)
- `comment` (string, requis)
- `private` (bool, défaut false) : true = private_log, false = public_log
- `class` (string, défaut "UserRequest") : "UserRequest" ou "Incident"

### assign_ticket
Assigne un ticket à un agent via stimulus ev_assign.
- `ticket_id` (int, requis)
- `agent_name` (string, requis) : nom de l'agent à assigner
- `class` (string, défaut "UserRequest")

### resolve_ticket
Résout un ticket via stimulus ev_resolve.
- `ticket_id` (int, requis)
- `solution` (string, requis) : texte de la solution
- `resolution_code` (string, défaut "fixed")
- `time_spent` (int) : temps en minutes à pointer
- `agent_name` (string) : agent ayant résolu
- `class` (string, défaut "UserRequest")

⚠️ Le bridge émet un warning si le ticket n'a pas de timesheet — penser à inclure `time_spent`.

### update_status
Change le statut via un stimulus iTop.
- `ticket_id` (int, requis)
- `stimulus` (string, requis) : un des stimulus listés ci-dessus
- `class` (string, défaut "UserRequest")
- `fields` (object) : champs additionnels à mettre à jour

### create_ticket
Crée une nouvelle UserRequest.
- `title` (string, requis)
- `org_name` (string, requis) : nom de l'organisation (résolu par OQL)
- `description` (string, requis)
- `caller` (string) : nom du demandeur (défaut: "Monitoring ANVOLE")
- `priority` (string) : "1"-"4" (défaut: "3")
- `service` (string) : nom du service
- `subcategory` (string) : nom de la sous-catégorie

### create_incident
Identique à create_ticket mais crée un Incident.

### add_timesheet
Pointe du temps sur un ticket sans changer son statut.
- `ticket_id` (int, requis) : ID numérique iTop
- `time_spent` (int, requis) : durée en **secondes** (ex: 1800 = 30 min)
- `agent_name` (string) : agent ayant travaillé (défaut: "Lauretta")
- `comment` (string) : description du travail effectué
- `class` (string, défaut "UserRequest") : "UserRequest" ou "Incident"

### get_ticket_stats
Statistiques agrégées : volumes par statut, par priorité, par organisation, SLA compliance.
- `org_name` (string, optionnel) : filtrer les stats pour un client spécifique
- `days` (int, optionnel) : limiter la période (ex: 30 = dernier mois)

## Workflows n8n associés (pour référence)

| Workflow | ID | Rôle |
|---|---|---|
| Claude Bridge — iTop Tickets v2 | HWjhsTJpR6VikRur | Bridge principal (ce skill) |
| TOOLS_itop | Zt6snP1hvovjL706 | Sub-workflow legacy (pointer/assigner/résoudre/créer) |
| API ITOP | 4FgAxC2xQk2wLrNT | Synchro licences/contacts (datawarehouse) |
| DATAWAREHOUSE_iTop | mEvqVCpwL3Eecfgi | ETL iTop → datawarehouse |
| DATA_SYNCHRO_iTop | rwZOYXUQ1v3sNGYz | Synchro bidirectionnelle |
| AGENT_itop | LgwosyMKQg9SjwET | Agent IA iTop (legacy) |
