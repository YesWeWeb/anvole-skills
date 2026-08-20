---
name: itop-tickets
description: >
  Gestion des tickets et incidents iTop via le serveur MCP local `itop-tickets`
  (outils `mcp__itop-tickets__*`). Consulter, rechercher, commenter, assigner,
  résoudre, pointer du temps et créer des tickets/incidents dans l'ITSM Anvole
  (itsm.cloud.anvole.com).
  Triggers : ticket, incident, iTop, ITSM, SLA, support, R-XXXX, I-XXXX,
  "mes tickets", "tickets ouverts/en retard", "créer un ticket",
  "pointer du temps", "résoudre le ticket", "assigner", "tickets du client X",
  "combien de tickets", "suivi support", "traiter mes tickets", ou toute demande
  liée aux tickets IT Anvole.
  Se déclenche aussi pour le Morning Briefing (volume tickets/SLA) et quand Greg
  parle d'un problème client.
---

# iTop Tickets — Skill Anvole

## Contexte

iTop est l'ITSM d'Anvole (itsm.cloud.anvole.com). L'accès se fait via le serveur MCP
local **`itop-tickets`** (stdio), qui appelle **l'API REST iTop en direct** — il n'y a
plus de bridge n8n dans le chemin depuis le 2026-08-12. L'authentification (Application
Token iTop) vit dans les variables d'environnement du serveur : aucune clé à manipuler
depuis ce skill, et aucun appel HTTP à monter à la main.

Les outils sont préfixés **`mcp__itop-tickets__`** — pas `mcp__itop__`.

```
mcp__itop-tickets__itop_get_my_tickets({ agent_name: "Lauretta" })
mcp__itop-tickets__itop_get_ticket_details({ ref: "R-260318-034592" })
```

## Outils disponibles

### Lecture — Tickets (UserRequest)

| Outil | Description | Params requis | Params optionnels |
|---|---|---|---|
| `itop_get_tickets` | Tickets ouverts | — | `oql_filter`, `include_details` |
| `itop_get_ticket_details` | Détail complet d'un ticket | `ticket_id` OU `ref` | — |
| `itop_get_my_tickets` | Tickets assignés à un agent | — | `agent_name` (défaut : "Lauretta") |
| `itop_search_tickets` | Recherche titre / description / ref | `keyword` | — |
| `itop_get_tickets_by_org` | Tickets ouverts d'un client | `org_name` | — |
| `itop_get_tickets_by_status` | Tickets par statut | `status` | — |
| `itop_get_tickets_by_priority` | Tickets ouverts par priorité | `priority` | — |
| `itop_get_overdue_tickets` | Tickets ouverts en dépassement SLA | — | — |

### Lecture — Incidents

Mêmes outils, `tickets` → `incidents` : `itop_get_incidents`, `itop_get_incident_details`,
`itop_get_my_incidents`, `itop_search_incidents`, `itop_get_incidents_by_org`,
`itop_get_incidents_by_status`, `itop_get_incidents_by_priority`,
`itop_get_overdue_incidents`. Le param des détails reste `ticket_id` / `ref`.

### Lecture — Référentiel

| Outil | Description | Params |
|---|---|---|
| `itop_get_organizations` | Organisations clients | — |
| `itop_get_contacts` | Contacts (+ filtre org) | `org_name?` |
| `itop_get_services` | Catalogue de services + sous-catégories | — |
| `itop_get_teams` | Équipes support | — |

### Écriture

| Outil | Description | Params requis | Params optionnels |
|---|---|---|---|
| `itop_add_comment` | Commentaire public ou privé | `ticket_id`, `comment` | `private` (bool), `class` |
| `itop_assign_ticket` | Assigner à un agent | `ticket_id`, `agent_name` | `class` |
| `itop_resolve_ticket` | Résoudre (solution obligatoire) | `ticket_id`, `solution` | `resolution_code`, `time_spent` (**minutes**), `agent_name`, `class` |
| `itop_update_status` | Transition par stimulus | `ticket_id`, `stimulus` | `class`, `fields` |
| `itop_create_ticket` | Créer un UserRequest | `title`, `org_name`, `description` | `caller`, `priority`, `service`, `subcategory` |
| `itop_create_incident` | Créer un Incident | idem `create_ticket` | idem |
| `itop_add_timesheet` | Pointer du temps sans changer le statut | `ticket_id`, `time_spent` (**secondes**) | `agent_name`, `comment`, `start_date`, `class` |

### Statistiques

`itop_get_ticket_stats` — volumes, SLA, distribution. Optionnels : `org_name`, `days`.

## Règles CRITIQUES

### « Mes tickets » = TOUJOURS tickets + incidents

Quand Greg dit « mes tickets », « quoi de neuf côté support », ou toute demande qui
implique de voir ses tâches iTop, lancer **les deux appels en parallèle** :
`itop_get_my_tickets` **et** `itop_get_my_incidents`, puis fusionner en une vue unique.
Même logique pour « tickets du client X » → `get_tickets_by_org` + `get_incidents_by_org`.
Ne jamais oublier les incidents.

### « Ouvert » veut dire non clos ET non résolu

Presque toutes les lectures filtrent implicitement sur `status NOT IN ('closed','resolved')` :
`get_tickets` (sans `oql_filter`), `get_my_*`, `get_*_by_org`, `get_*_by_priority`,
`get_overdue_*`. **Conséquence : un ticket résolu mais pas encore clos est invisible.**

Seul `get_*_by_status` ne filtre pas — c'est la porte d'entrée pour voir les `resolved`
et les `closed`. `get_tickets` avec un `oql_filter` explicite contourne aussi le filtre.

Donc quand quelqu'un dit « le client n'a que 2 tickets », vérifier ce que ça compte avant
de le répéter.

### La troncature coupe la FIN, donc les entrées les plus récentes

Les réponses sont tronquées à 25 000 caractères côté serveur MCP, avec un
`⚠️ Réponse tronquée` en fin de sortie. Sur `get_ticket_details` d'un ticket portant un
long fil de mails, le `public_log` est rendu **du plus ancien au plus récent** : ce qui
saute, c'est le dernier échange — précisément celui qui dit où en est le dossier.

Le réflexe : comparer `last_update` à la date de la dernière entrée de log visible. S'il y
a un écart, la fin manque. Recours — `response_format: "json"`, ou croiser avec la boîte
mail (skill `outlook`), ou lire `warehouse.itop_tickets` sur Supabase ANVL.

### Recherche par ref

- Ref `R-XXXXXX-XXXXXX` ou `I-XXXXXX-XXXXXX` → `itop_search_tickets` / `itop_search_incidents`
  détectent le pattern et font un `WHERE ref = '...'` exact.
- Pour les détails, `itop_get_ticket_details({ ref: "R-..." })` accepte la ref directement,
  pas besoin de résoudre l'ID d'abord.
- Préfixe `R-` = UserRequest, `I-` = Incident.
- **Toutes les écritures exigent l'`ticket_id` numérique**, jamais la ref.

### Confirmation obligatoire

Toujours faire valider avant toute écriture : `create`, `resolve`, `assign`,
`update_status`, `add_comment`, `add_timesheet`. Pour les commentaires publics, soumettre
le texte à Greg avant de poster — ils notifient le demandeur côté client.

### Valeurs par défaut

- `agent_name` : "Lauretta" (Greg) sauf indication contraire
- `class` : "UserRequest" pour les tickets, "Incident" pour les incidents
- `response_format` : "markdown" pour l'affichage, "json" pour post-traiter

## Pointer du temps

`itop_add_timesheet` prend **des secondes** (1800 = 30 min, 3600 = 1 h), là où le
`time_spent` de `itop_resolve_ticket` prend **des minutes**. C'est le piège le plus facile
à faire.

Par défaut la saisie se termine à l'instant de l'appel. `start_date`
(`"YYYY-MM-DD HH:MM:SS"`) la cale sur l'heure réelle de l'intervention — à utiliser dès
qu'on pointe après coup, sinon les saisies s'empilent à des horaires absurdes.

Côté iTop, la classe est **`TimeSpent`**, accrochée à un objet pivot **`Activity`** qui
référence le ticket par `(obj_class, obj_id)`. Ce pivot n'existe pas d'office et le MCP le
crée au besoin — transparent à l'usage, mais c'est ce qui explique qu'un pointage fasse
plusieurs allers-retours. Détail dans `references/itop-api.md`.

## Ce que le MCP ne sait PAS faire

À orienter vers l'interface iTop, sans tourner autour :

- **Modifier ou supprimer une saisie de temps** — seule la création existe.
- **Changer le service ou la sous-catégorie** d'un ticket (beaucoup arrivent en `_Default`).
- **Fusionner deux tickets**, changer le demandeur, changer l'organisation.
- **Lire les pièces jointes.**

## Workflows par cas d'usage

### « Montre-moi mes tickets »
1. `itop_get_my_tickets` + `itop_get_my_incidents` **en parallèle**
2. Fusionner, présenter : ref, titre, client, priorité, statut, date, SLA

### « Tickets du client X »
1. `itop_get_tickets_by_org` + `itop_get_incidents_by_org` **en parallèle**
2. Fusionner, trier par priorité
3. Si le compte paraît bas, penser au filtre « ouvert » ci-dessus

### « C'est quoi le ticket I-260318-034592 ? »
1. Préfixe `I-` → incident → `itop_get_incident_details({ ref: "..." })`
2. Vérifier que le log n'est pas tronqué avant de conclure sur l'état du dossier

### « Traiter mes tickets » — la routine

C'est l'usage le plus fréquent. L'ordre compte : **on établit l'état avant de proposer**.

1. **Charger** — tickets + incidents du périmètre demandé, en parallèle.
2. **Lire le fil** — `get_ticket_details` sur chacun, et vérifier la fraîcheur du log
   (cf. troncature). Le dernier message dit de quel côté est la balle.
3. **Croiser le terrain si la suite en dépend** — un déploiement ne part pas sur un poste
   éteint : le RMM (skill `andy-rmm`) dit qui a checké-in récemment. Un mail parti hier
   soir ne se voit pas forcément dans le ticket : croiser avec `outlook`.
4. **Restituer l'état**, puis proposer. Signaler les doublons, les tickets sans temps
   pointé, ceux restés en `_Default`, et les SLA dépassés.
5. **Écrire** après validation : commentaire privé pour le CR technique, commentaire
   public pour le client, timesheet, puis résolution.

Découper le CR en plusieurs commentaires par étape plutôt qu'un pavé — ça se relit dans
six mois. Et **ce qui vit dans une conversation ne vit nulle part** : si le travail réel
s'est fait ailleurs, le ticket doit en porter la trace.

### « Résous le ticket R-XXXXXX-XXXXXX »
1. `itop_get_ticket_details({ ref: ... })` pour le contexte et l'`id` numérique
2. Demander la solution si elle n'est pas fournie
3. `itop_resolve_ticket` avec l'`id`, et `time_spent` **en minutes**
4. Confirmer

### « Pointe 30 minutes sur R-XXXXXX-XXXXXX »
1. Résoudre l'`id` numérique depuis la ref
2. `itop_add_timesheet({ ticket_id, time_spent: 1800 })` — **secondes**, sans toucher au statut
3. Ajouter `start_date` si l'intervention n'est pas celle qui vient de finir

### « Combien de tickets en cours ? »
`itop_get_ticket_stats`, puis résumer volumes, SLA, distribution.

## Référence détaillée

Champs par type d'objet, valeurs de statuts / priorités / stimulus, forme des réponses,
et modèle de données de la saisie de temps :
→ `references/itop-api.md`
