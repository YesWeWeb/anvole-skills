# Outlook — Dossiers par defaut et arborescence

## IDs des dossiers par defaut (GetDefaultFolder)

| ID | Dossier |
|----|---------|
| 3  | Elements supprimes (Deleted Items) |
| 4  | Boite d'envoi (Outbox) |
| 5  | Elements envoyes (Sent Items) |
| 6  | Boite de reception (Inbox) |
| 9  | Calendrier (Calendar) |
| 10 | Contacts |
| 11 | Journal |
| 12 | Notes |
| 13 | Taches (Tasks) |
| 16 | Brouillons (Drafts) |
| 23 | Courrier indesirable (Junk) |

## Acceder a un dossier par defaut

```python
inbox = mapi.GetDefaultFolder(6)        # Boite de reception
sent = mapi.GetDefaultFolder(5)         # Envoyes
drafts = mapi.GetDefaultFolder(16)      # Brouillons
deleted = mapi.GetDefaultFolder(3)      # Corbeille
junk = mapi.GetDefaultFolder(23)        # Spam
```

## Acceder a un sous-dossier par nom

```python
inbox = mapi.GetDefaultFolder(6)
# Sous-dossier direct
subfolder = inbox.Folders("Informatique")
# Sous-sous-dossier
deep = inbox.Folders("Traité").Folders("CBTP VM W11")
```

## Lister les sous-dossiers d'un dossier

```python
folder = mapi.GetDefaultFolder(6)  # Inbox
for i in range(1, folder.Folders.Count + 1):
    sub = folder.Folders.Item(i)
    print(f"  {sub.Name} ({sub.Items.Count} items)")
```

## Arborescence connue (gregory.lauretta@anvole.com)

```
Boite de reception (Inbox)
├── ANVL Datacenter
├── From rapport
├── CBTP
├── Consignes
├── Anvole AG
├── DirOps
├── FB Telecom
├── Operationnel
├── Migration M365 Gourbeyre
├── Informatique
├── Traité
│   ├── CBTP VM W11
│   ├── CBTP Azure AD
│   ├── CBTP Bug SQL 972
│   ├── CBTP Migration flux DSN
│   ├── SYVADE Migration
│   ├── SYVADE Hadening M365
│   ├── SYVADE Hadening ADDS
│   ├── SYVADE Deploiement OBS
│   ├── STEP
│   ├── SOPA Renfo Sécu
│   ├── SOPA Gestion Domaines
│   ├── MSP RES SOPA
│   ├── Excelcia
│   ├── N-Central SQL
│   ├── CAP EXCEL FIrewalls
│   ├── SYVADE Rapport Hebdo
│   ├── CBTP PRI
│   ├── CBTP Evolution traitement DSN
│   └── CBTP EDFLEX
├── SYVADE AI
├── Reporting
├── Forti HS
├── RIPE
└── ZILEA Notifs

ACRONIS/
├── Rapports
└── Quota
```

## Acceder a une boite partagee (si montee dans le profil)

```python
# Lister tous les stores/comptes
for i in range(1, mapi.Folders.Count + 1):
    store = mapi.Folders.Item(i)
    print(store.Name)

# Acceder a un store specifique par nom
shared = mapi.Folders("support@anvole.com")
shared_inbox = shared.Folders("Boîte de réception")
```

## Acceder a un dossier par chemin complet

```python
def get_folder_by_path(mapi, path):
    """
    Navigue vers un dossier par chemin, ex: 'Boîte de réception/Informatique/Traité'
    Le premier segment peut etre un store name ou on utilise le store par defaut.
    """
    parts = path.strip('/').split('/')
    # Essayer d'abord comme sous-dossier de l'inbox
    folder = mapi.GetDefaultFolder(6)
    for part in parts:
        folder = folder.Folders(part)
    return folder
```
