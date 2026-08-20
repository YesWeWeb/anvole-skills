# iTop — Référence API (serveur MCP `itop-tickets`)

## Transport

- **Serveur MCP** : `itop-tickets`, local, stdio. Outils préfixés `mcp__itop-tickets__`.
- **Backend** : `https://itsm.cloud.anvole.com/itop/webservices/rest.php`, API REST **1.3**,
  appelée **en direct**. Aucun bridge n8n dans le chemin depuis le 2026-08-12.
- **Auth** : Application Token iTop (header `Auth-Token` + champ POST `auth_token`), porté
  par les variables d'environnement du serveur MCP.
  Prérequis serveur : `allowed_login_types` inclut `token`,
  `allow_rest_services_via_tokens => true`, et le token porte le profil « REST Services User ».
- **Troncature** : les réponses sont coupées à 25 000 caractères, avec un
  `⚠️ Réponse tronquée` en fin de sortie. Voir la section dédiée plus bas.

iTop rend ses **erreurs applicatives en HTTP 200**, avec un `code != 0` dans le corps. Le
client MCP les convertit en erreur — une réponse « réussie » n'est donc jamais silencieusement
fausse, mais un `Unknown class 'X'` signifie que la classe n'existe pas sur cette instance,
pas que la requête était malformée.

## Champs retournés par type d'objet

### Tickets (UserRequest) — champs standard
`ref`, `id`, `title`, `org_id`, `org_id_friendlyname`, `caller_id_friendlyname`,
`agent_id_friendlyname`, `team_id_friendlyname`, `priority`, `urgency`, `impact`,
`status`, `start_date`, `last_update`, `close_date`, `service_name`,
`servicesubcategory_name`, `description`, `resolution_code`,
`sla_tto_passed`, `sla_ttr_passed`, `tto`, `ttr`

### Tickets — champs détaillés (`include_details`, ou `get_ticket_details`)
Tous les champs standard + `public_log`, `private_log`, `solution`, `time_spent`

### Incidents
Mêmes champs que les tickets + `operational_status`

### Organisations
`id`, `name`, `status`, `parent_id_friendlyname`

### Contacts
`id`, `name`, `first_name`, `email`, `phone`, `mobile_phone`,
`org_id_friendlyname`, `status`, `friendlyname`

### Services / sous-catégories / équipes
`id`, `name`, `description`, `status` (+ `service_id_friendlyname` pour les
sous-catégories, `org_id_friendlyname` pour les services et les équipes)

## Valeurs de référence

### Statuts (lifecycle UserRequest et Incident)
`new` · `assigned` · `pending` (attente retour client) · `resolved` · `closed` ·
`escalated_tto` · `escalated_ttr`

### Priorités
`1` Critique · `2` Haute · `3` Moyenne (défaut) · `4` Basse

### Stimulus (`update_status`)
`ev_assign` · `ev_reassign` · `ev_resolve` · `ev_close` · `ev_reopen` ·
`ev_pending` · `ev_timeout`

### Codes de résolution
`fixed` · `duplicate` · `not_a_bug` · `wont_fix` · `assistance`

## Le filtre « ouvert » implicite

`OPEN_ONLY` = `status NOT IN ('closed', 'resolved')`.

| Action | Filtre appliqué |
|---|---|
| `get_tickets` / `get_incidents` **sans** `oql_filter` | OPEN_ONLY |
| `get_tickets` / `get_incidents` **avec** `oql_filter` | celui que vous fournissez, entièrement |
| `get_my_*` | OPEN_ONLY + `agent_id_friendlyname LIKE '%agent%'` |
| `get_*_by_org` | OPEN_ONLY + `org_id_friendlyname LIKE '%org%'` |
| `get_*_by_priority` | OPEN_ONLY + priorité |
| `get_overdue_*` | OPEN_ONLY + (`sla_tto_passed = 'yes'` OR `sla_ttr_passed = 'yes'`) |
| `get_*_by_status` | **aucun** — le statut demandé, exactement |
| `search_*` | **aucun** — titre / description / ref, tous statuts |

Un ticket `resolved` non encore `closed` n'apparaît donc dans aucune vue « par client »
ni « mes tickets ». Pour le voir : `get_*_by_status({ status: "resolved" })`, ou
`get_tickets({ oql_filter: "WHERE ..." })`.

`oql_filter` est concaténé brut derrière `SELECT UserRequest` — il doit donc commencer par
`WHERE`, et il remplace le filtre par défaut au lieu de s'y ajouter.

## Troncature — le piège du fil de discussion

La coupe à 25 000 caractères s'applique à la sortie sérialisée, **par la fin**. Or
`public_log` est rendu du plus ancien au plus récent. Sur un ticket au long cours, ce qui
disparaît est donc le dernier échange — celui qui dit où en est réellement le dossier.

Contrôle : comparer `last_update` du ticket à la date de la dernière entrée de log lisible.
Un écart = il manque la fin.

Recours : `response_format: "json"`, croiser avec la boîte mail (skill `outlook`), ou lire
`warehouse.itop_tickets` / `warehouse.itop_timespent` sur Supabase ANVL.

## Saisie de temps — modèle de données

La classe est **`TimeSpent`**. `lnkTimesheetToTicket` **n'existe pas** sur cette instance :
tout `core/create` dessus remonte `Unknown class`.

`TimeSpent.activity_id` **ne pointe pas le ticket**. Il pointe un objet pivot **`Activity`**,
qui référence n'importe quel objet iTop par le couple `(obj_class, obj_id)` :

```
TimeSpent ──activity_id──▶ Activity { obj_class: "UserRequest", obj_id: 36040 } ──▶ le ticket
```

Ce pivot n'existe pas d'office — près d'un ticket ouvert sur deux n'en a pas. Le serveur MCP
le résout, le crée s'il manque, puis crée le `TimeSpent`. C'est pourquoi un pointage coûte
plusieurs allers-retours.

Champs de `TimeSpent` : `user_id` (→ `User`), `contact_id` (→ `Person`), `activity_id`,
`org_id`, `start_date`, `end_date`, `duration` (**secondes**), `title`, `description`,
`origin`.

Deux pièges :

- **Résoudre l'agent via `User`, jamais via `Person`.** C'est `User` qui porte `contactid`,
  et plusieurs homonymes cohabitent en base dont un seul est rattaché à un compte —
  `SELECT Person WHERE friendlyname LIKE '%Nom%'` est ambigu.
- **`origin`** vaut `calendar` pour les saisies faites depuis l'agenda iTop, et `manual`
  pour celles créées par le MCP (valeur par défaut d'iTop). Sans conséquence en aval : le
  connecteur `etl/vendors/itop.py` n'ingère pas ce champ.

Le lien ticket ↔ temps passé se relit en OQL par jointure :

```
SELECT TimeSpent AS ts JOIN Activity AS a ON ts.activity_id = a.id
WHERE a.obj_class = 'UserRequest' AND a.obj_id = <id>
```

## Unités de temps

| Outil | Unité |
|---|---|
| `itop_add_timesheet` → `time_spent` | **secondes** |
| `itop_resolve_ticket` → `time_spent` | **minutes** |

## Forme des réponses

### Lecture
```json
{
  "success": true,
  "action": "get_tickets_by_org",
  "count": 2,
  "tickets": [
    {
      "id": "36040", "ref": "R-260729-036072", "title": "…",
      "organization": "…", "caller": "…", "agent": "…", "team": "…",
      "priority": "4", "status": "assigned",
      "start_date": "…", "last_update": "…",
      "sla_tto_breached": false, "sla_ttr_breached": true
    }
  ],
  "warnings": [],
  "timestamp": "…"
}
```

### Écriture — pointage
```json
{
  "success": true,
  "action": "add_timesheet",
  "timesheet": {
    "id": "7398", "ticket": "R-260729-036072", "agent": "Gregory LAURETTA",
    "duration_seconds": "900",
    "start_date": "2026-08-20 03:37:46", "end_date": "2026-08-20 03:52:46"
  },
  "warnings": []
}
```

### Écriture — résolution
```json
{
  "success": true,
  "action": "resolve_ticket",
  "resolved": { "id": "…", "ref": "…", "status": "resolved", "resolution_code": "fixed", "solution": "…" },
  "timesheet": { "id": "…" }
}
```

Un échec du volet timesheet **ne fait pas échouer** la résolution : il remonte dans
`warnings` et `timesheet` reste `null`. Vérifier les warnings avant de considérer le
temps comme pointé.

## Fuseau horaire

iTop stocke et rend ses dates **sans fuseau**, en heure serveur (UTC−4). Le poste qui
exécute le MCP est sur le même fuseau, donc les dates envoyées en heure locale tombent
juste. `ITOP_TZ_OFFSET_MINUTES` force un décalage explicite si le serveur MCP venait à
tourner ailleurs.

Ne pas confondre avec les horodatages `timestamp` des réponses MCP, qui sont en **UTC**.

## Hors périmètre du MCP

Ces opérations n'ont pas d'outil et se font dans l'interface iTop :
modifier ou supprimer une saisie de temps, changer le service ou la sous-catégorie d'un
ticket, fusionner deux tickets, changer le demandeur ou l'organisation, lire les pièces
jointes.
