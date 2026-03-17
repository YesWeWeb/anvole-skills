---
name: outlook
description: >
  Read, search, move, delete, draft, reply, forward, and send emails from the local Outlook
  desktop application via Python win32com COM API. This skill ONLY works on Greg's Windows PC
  where Outlook is installed locally (no cloud API, no IMAP — direct COM automation).
  Mailbox: gregory.lauretta@anvole.com.
  ALWAYS trigger when the user mentions Outlook, emails, mails, boite de reception, inbox,
  courrier, envoyer un mail, lire mes mails, chercher un mail, deplacer un mail, supprimer
  un mail, brouillon, draft, repondre, transférer, forwarding, or any email management task
  that targets the local Outlook installation.
  French triggers: "mes mails", "boite mail", "boite de reception", "mails Outlook",
  "chercher un mail", "envoyer un mail", "repondre au mail", "transferer le mail",
  "supprimer le mail", "deplacer le mail", "creer un brouillon", "mes mails recents",
  "mails non lus", "mails de [expediteur]", "mails du [date]", "dossier Outlook".
  English triggers: "my emails", "Outlook inbox", "search email", "send email",
  "reply to email", "forward email", "delete email", "move email", "create draft",
  "unread emails", "recent emails", "emails from [sender]".
tools: Bash
---

# Outlook — Local Desktop Email Access

Acces direct a Outlook via l'API COM Windows (`win32com.client`).
Fonctionne UNIQUEMENT sur ce PC Windows ou Outlook est installe en local.

## Prerequis techniques

- Python 3.13+ avec `pywin32` (`win32com.client`)
- Outlook desktop doit etre en cours d'execution
- Mailbox par defaut : `gregory.lauretta@anvole.com`

## Pattern Python de base

Tous les scripts doivent commencer par ce boilerplate pour eviter les erreurs d'encodage :

```python
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import win32com.client

outlook = win32com.client.Dispatch('Outlook.Application')
mapi = outlook.GetNamespace('MAPI')
```

**Indexation COM** : les collections COM utilisent un index base 1 (pas 0).
Utiliser `collection.Item(i)` avec `i` de 1 a `collection.Count`.

## References (charger selon le besoin)

| Fichier | Contenu | Quand le lire |
|---------|---------|---------------|
| `references/folder-ids.md` | IDs des dossiers par defaut et arborescence connue | Avant toute operation sur un dossier specifique |
| `references/operations.md` | Code Python pour chaque operation (lire, chercher, deplacer, supprimer, brouillon, repondre, envoyer) | Avant d'executer une operation |

## Step 1 — Verifier la connexion

Avant toute operation, verifier qu'Outlook repond :

```python
outlook = win32com.client.Dispatch('Outlook.Application')
mapi = outlook.GetNamespace('MAPI')
inbox = mapi.GetDefaultFolder(6)
print(f"Connecte : {inbox.Items.Count} messages dans la boite de reception")
```

Si erreur COM → Outlook n'est probablement pas lance. Demander a l'utilisateur de l'ouvrir.

## Step 2 — Identifier l'operation demandee

| Intention utilisateur | Operation | Reference |
|----------------------|-----------|-----------|
| Lire les derniers mails | `list_recent` | `references/operations.md` § Lister |
| Lire un mail specifique | `read_message` | `references/operations.md` § Lire |
| Chercher par expediteur/sujet/date | `search` | `references/operations.md` § Chercher |
| Deplacer un mail | `move` | `references/operations.md` § Deplacer |
| Supprimer un mail | `delete` | `references/operations.md` § Supprimer |
| Creer un brouillon | `create_draft` | `references/operations.md` § Brouillon |
| Repondre a un mail | `reply` | `references/operations.md` § Repondre |
| Transferer un mail | `forward` | `references/operations.md` § Transferer |
| Envoyer un mail | `send` | `references/operations.md` § Envoyer |
| Lister les dossiers | `list_folders` | `references/folder-ids.md` |
| Mails non lus | `unread` | `references/operations.md` § Non lus |

Charger `references/operations.md` pour obtenir le code Python exact de l'operation.

## Step 3 — Executer et presenter les resultats

- Toujours afficher les resultats dans un format lisible (tableau, liste)
- Pour les listes de mails : afficher date, expediteur, sujet (tronque si necessaire)
- Pour un mail individuel : afficher expediteur, destinataires, date, sujet, corps (texte)
- Limiter les resultats a 20 mails par defaut sauf si l'utilisateur demande plus

## Regles de securite

- **Jamais envoyer un mail sans confirmation explicite de l'utilisateur**
- **Jamais supprimer definitivement** (utiliser `.Delete()` qui envoie a la corbeille)
- Pour les deplacements en masse (>10 mails), demander confirmation avant d'executer
- Afficher un resume avant toute action destructive ou d'envoi
