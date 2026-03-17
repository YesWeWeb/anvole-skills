# Outlook — Operations Reference

Tous les exemples supposent le boilerplate suivant deja execute :

```python
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import win32com.client
from datetime import datetime, timedelta

outlook = win32com.client.Dispatch('Outlook.Application')
mapi = outlook.GetNamespace('MAPI')
```

---

## Lister les mails recents

```python
folder = mapi.GetDefaultFolder(6)  # ou un sous-dossier
messages = folder.Items
messages.Sort('[ReceivedTime]', True)  # True = descending

for i in range(1, min(21, messages.Count + 1)):
    msg = messages.Item(i)
    try:
        received = msg.ReceivedTime.strftime('%Y-%m-%d %H:%M')
        sender = msg.SenderName or '?'
        subject = msg.Subject or '(sans objet)'
        print(f"{received} | {sender[:35]:35s} | {subject[:70]}")
    except Exception as e:
        print(f"  [erreur: {e}]")
```

---

## Lire un mail specifique

Apres avoir identifie un mail (par index dans une liste, ou via recherche) :

```python
msg = messages.Item(index)  # index base 1

print(f"De:      {msg.SenderName} <{msg.SenderEmailAddress}>")
print(f"A:       {msg.To}")
print(f"CC:      {msg.CC}")
print(f"Date:    {msg.ReceivedTime.strftime('%Y-%m-%d %H:%M')}")
print(f"Sujet:   {msg.Subject}")
print(f"Lu:      {'Oui' if not msg.UnRead else 'Non'}")
print("---")
print(msg.Body[:3000])  # Limiter le corps a 3000 chars
```

Pour le corps HTML : `msg.HTMLBody`

### Pieces jointes

```python
if msg.Attachments.Count > 0:
    print(f"\nPieces jointes ({msg.Attachments.Count}):")
    for j in range(1, msg.Attachments.Count + 1):
        att = msg.Attachments.Item(j)
        print(f"  - {att.FileName} ({att.Size} bytes)")
        # Pour sauvegarder :
        # att.SaveAsFile(r"C:\tmp\" + att.FileName)
```

---

## Chercher des mails

### Par expediteur

```python
folder = mapi.GetDefaultFolder(6)
messages = folder.Items
# Restrict avec DASL ou JET query
filtered = messages.Restrict("[SenderName] = 'Jean-Yves Moschetto (Anvole)'")
filtered.Sort('[ReceivedTime]', True)
print(f"{filtered.Count} resultats")
```

### Par sujet (contient)

```python
filtered = messages.Restrict("@SQL=\"urn:schemas:httpmail:subject\" LIKE '%SYVADE%'")
```

### Par date

```python
# Mails recus apres une date
filtered = messages.Restrict("[ReceivedTime] >= '2026-03-01 00:00'")

# Mails recus entre deux dates
filtered = messages.Restrict("[ReceivedTime] >= '2026-03-01' AND [ReceivedTime] <= '2026-03-15'")
```

### Par statut non lu

```python
filtered = messages.Restrict("[UnRead] = True")
filtered.Sort('[ReceivedTime]', True)
```

### Combinaison de filtres

```python
filtered = messages.Restrict(
    "@SQL=\"urn:schemas:httpmail:subject\" LIKE '%Fortinet%' "
    "AND \"urn:schemas:httpmail:datereceived\" >= '2026-03-01'"
)
```

### Recherche dans tous les sous-dossiers (recursive)

```python
def search_recursive(folder, restriction, results, max_depth=3, depth=0):
    if depth > max_depth:
        return
    try:
        items = folder.Items.Restrict(restriction)
        for i in range(1, min(items.Count + 1, 50)):
            results.append(items.Item(i))
    except:
        pass
    for i in range(1, folder.Folders.Count + 1):
        search_recursive(folder.Folders.Item(i), restriction, results, max_depth, depth + 1)

results = []
search_recursive(mapi.GetDefaultFolder(6), "[UnRead] = True", results)
print(f"{len(results)} mails non lus au total")
```

---

## Non lus

```python
folder = mapi.GetDefaultFolder(6)
unread = folder.Items.Restrict("[UnRead] = True")
unread.Sort('[ReceivedTime]', True)
print(f"{unread.Count} mails non lus")
```

### Marquer comme lu

```python
msg.UnRead = False
msg.Save()
```

### Marquer comme non lu

```python
msg.UnRead = True
msg.Save()
```

---

## Deplacer un mail

```python
# Obtenir le dossier cible
target = mapi.GetDefaultFolder(6).Folders("Traité").Folders("SYVADE Migration")

# Deplacer le message
msg.Move(target)
```

**Attention** : apres `.Move()`, la reference `msg` n'est plus valide dans le dossier source.

### Deplacer en masse

```python
# Collecter d'abord les EntryIDs (car Move invalide les references)
ids_to_move = []
filtered = folder.Items.Restrict("[SenderName] = 'ACRONIS'")
for i in range(1, filtered.Count + 1):
    ids_to_move.append(filtered.Item(i).EntryID)

target = mapi.GetDefaultFolder(6).Folders("ACRONIS").Folders("Rapports")
moved = 0
for eid in ids_to_move:
    try:
        msg = mapi.GetItemFromID(eid)
        msg.Move(target)
        moved += 1
    except Exception as e:
        print(f"Erreur: {e}")
print(f"{moved}/{len(ids_to_move)} mails deplaces")
```

---

## Supprimer un mail

```python
# Envoie le mail dans la corbeille (Elements supprimes)
msg.Delete()
```

**Note** : `.Delete()` deplace vers la corbeille, il ne supprime pas definitivement.
Pour supprimer definitivement (a eviter) : deplacer dans la corbeille puis `.Delete()` a nouveau.

---

## Brouillon (creer un nouveau mail sans l'envoyer)

```python
mail = outlook.CreateItem(0)  # 0 = olMailItem
mail.To = "destinataire@example.com"
mail.CC = "copie@example.com"          # optionnel
mail.BCC = "copie-cachee@example.com"  # optionnel
mail.Subject = "Mon sujet"
mail.Body = "Contenu en texte brut"
# ou pour du HTML :
# mail.HTMLBody = "<h1>Titre</h1><p>Contenu HTML</p>"

# Piece jointe (optionnel)
# mail.Attachments.Add(r"C:\tmp\fichier.pdf")

mail.Save()  # Sauvegarde dans les Brouillons
print(f"Brouillon cree : {mail.Subject}")
```

---

## Repondre a un mail

```python
reply = msg.Reply()       # Repondre a l'expediteur
# ou
reply = msg.ReplyAll()    # Repondre a tous

reply.Body = "Ma reponse ici.\n\n" + reply.Body  # Ajouter au-dessus du thread
# reply.HTMLBody = "<p>Ma reponse</p>" + reply.HTMLBody  # Version HTML

reply.Save()    # Sauvegarder comme brouillon
# reply.Send()  # Envoyer directement — DEMANDER CONFIRMATION AVANT
```

---

## Transferer un mail

```python
fwd = msg.Forward()
fwd.To = "collegue@anvole.com"
fwd.Body = "FYI, voir ci-dessous.\n\n" + fwd.Body

fwd.Save()    # Sauvegarder comme brouillon
# fwd.Send()  # Envoyer — DEMANDER CONFIRMATION AVANT
```

---

## Envoyer un mail

**TOUJOURS demander confirmation a l'utilisateur avant d'appeler `.Send()`.**

```python
mail = outlook.CreateItem(0)
mail.To = "destinataire@example.com"
mail.Subject = "Mon sujet"
mail.Body = "Contenu du mail"

# Afficher un resume avant envoi
print(f"ENVOI PREVU :")
print(f"  A:     {mail.To}")
print(f"  CC:    {mail.CC}")
print(f"  Sujet: {mail.Subject}")
print(f"  Corps: {mail.Body[:200]}...")

# Envoyer uniquement apres confirmation utilisateur
mail.Send()
print("Mail envoye.")
```

---

## Proprietes utiles d'un message

| Propriete | Type | Description |
|-----------|------|-------------|
| `Subject` | str | Sujet |
| `Body` | str | Corps texte brut |
| `HTMLBody` | str | Corps HTML |
| `SenderName` | str | Nom de l'expediteur |
| `SenderEmailAddress` | str | Email de l'expediteur |
| `To` | str | Destinataires (;-separated) |
| `CC` | str | Copies |
| `BCC` | str | Copies cachees |
| `ReceivedTime` | datetime | Date de reception |
| `SentOn` | datetime | Date d'envoi |
| `UnRead` | bool | Non lu ? |
| `Importance` | int | 0=Low, 1=Normal, 2=High |
| `Categories` | str | Categories (;-separated) |
| `EntryID` | str | ID unique du message |
| `Attachments` | collection | Pieces jointes |
| `Size` | int | Taille en bytes |
| `FlagRequest` | str | Flag/suivi |
| `ConversationTopic` | str | Sujet du thread |
| `ConversationIndex` | str | Index de conversation |
