# Best Practices — Segmentation réseau & organisation des ports switch

Référence pour la génération de recommandations lors de l'analyse d'un switch.

---

## 1. Segmentation VLAN recommandée

### VLANs types à définir

| VLAN | Usage | Remarques |
|------|-------|-----------|
| **DATA** | PCs, workstations, laptops | VLAN principal utilisateurs |
| **VOIX** | Phones IP | Séparé du data pour QoS |
| **MGMT** | Management des équipements réseau | Accès restreint, switch management IP |
| **SERVEURS** | Serveurs d'infrastructure | Isolé des VLANs utilisateurs |
| **DMZ** | Serveurs exposés / accès externe | Isolé du LAN interne |
| **IoT** | Caméras, badgeuses, imprimantes IP | Isolé — appareils non maîtrisés |
| **INVITES** | Réseau invité WiFi | Isolation totale du LAN |
| **PARKING** | Ports désactivés / non utilisés | VLAN fictif pour ports shutdown |

**Règle principale :** Ne jamais laisser des équipements de types différents sur le même VLAN sans analyse de sécurité.

---

## 2. Configuration des ports selon le type d'équipement

### Port PC seul
```
switchport mode access
switchport access vlan [VLAN_DATA]
spanning-tree portfast
```

### Port Phone IP seul (sans PC derrière)
```
switchport mode access
switchport access vlan [VLAN_DATA]    ← VLAN data pour trafic PC-like du phone (si besoin)
switchport voice vlan [VLAN_VOIX]
spanning-tree portfast
```
**Note :** Sur certains déploiements, le phone est uniquement sur le VLAN voix (pas de VLAN data si pas de PC derrière).

### Port Phone IP + PC (le cas le plus courant)
```
switchport mode access
switchport access vlan [VLAN_DATA]    ← Le PC recevra ce VLAN non-taggé
switchport voice vlan [VLAN_VOIX]     ← Le phone utilisera ce VLAN taggé
spanning-tree portfast
```
**Fonctionnement :** Le phone reçoit la trame non-taggée (VLAN data) et la passe au PC. Il envoie son propre trafic sur le VLAN voix taggé. Le switch voit les 2 MACs sur le même port.

### Port AP WiFi
```
switchport mode trunk
switchport trunk native vlan [VLAN_MGMT_AP]
switchport trunk allowed vlan [VLAN_DATA],[VLAN_VOIX],[VLAN_INVITES],[VLAN_MGMT_AP]
spanning-tree portfast trunk   ← ou portfast si AP ne propage pas STP
```
**Note :** Un AP WiFi gérant plusieurs SSIDs a besoin d'un port trunk.

### Port trunk (liaison inter-switches)
```
switchport mode trunk
switchport trunk native vlan [VLAN_NATIF]   ← souvent VLAN 1 ou VLAN MGMT
switchport trunk allowed vlan [liste_complete]
```
**Bonne pratique :** Éviter le VLAN 1 comme VLAN natif. Utiliser un VLAN dédié.

### Port uplink vers routeur / pare-feu
```
switchport mode trunk
switchport trunk native vlan 1
switchport trunk allowed vlan [tous les VLANs routés]
```
Ou en mode routed (L3) si le switch est L3 :
```
no switchport
ip address [IP] [MASQUE]
```

---

## 3. Organisation physique des ports (layout)

### Convention recommandée (gauche → droite)

```
Ports 1 à N-4 : Endpoints (PCs, phones, imprimantes)
Ports N-3 à N-2 : Réservés / Expansion
Ports N-1 à N   : Uplinks / Trunks / Liaisons inter-switches
```

**Exemple sur un switch 24 ports :**
```
Ports 1–20  : Endpoints
Ports 21–22 : Réservés
Ports 23–24 : Uplinks / Trunks
```

**Pourquoi ?**
- Facilite la gestion physique : les câbles de liaison sont à droite / en haut
- Les techniciens savent immédiatement que les ports hauts numérotés sont critiques
- Réduit les erreurs lors du câblage (moins de risque de débrancher un trunk)

### Ports SFP / Fibre
Toujours réservés aux uplinks. Ne jamais connecter un endpoint sur un port SFP.

---

## 4. Ports non utilisés

### Bonne pratique obligatoire
```
interface GigabitEthernet1/0/X
 shutdown
 switchport access vlan [VLAN_PARKING]
 description UNUSED
```
- **Shutdown** : désactiver le port évite qu'un équipement non autorisé puisse se connecter
- **VLAN parking** : si le port est accidentellement activé, l'équipement se retrouve dans un VLAN isolé sans accès
- **Description UNUSED** : facilite l'audit

---

## 5. Sécurité des ports access

### Port security (optionnel mais recommandé)
```
switchport port-security maximum 2   ← 1 phone + 1 PC max
switchport port-security violation restrict
switchport port-security
```

### BPDU Guard (obligatoire sur ports endpoints)
```
spanning-tree bpduguard enable   ← (ou portfast bpduguard)
```
Empêche un switch non autorisé de se connecter sur un port access.

### DHCP Snooping (recommandé)
Activé globalement + trusted uniquement sur les uplinks. Empêche les serveurs DHCP pirates.

---

## 6. VLANs — règles supplémentaires

### VLAN 1 — À éviter comme VLAN de production
- VLAN 1 est le VLAN par défaut sur tous les équipements
- Il doit exister mais ne pas transporter de trafic utilisateur
- Désactiver tous les ports dans VLAN 1 et les déplacer vers des VLANs dédiés

### Native VLAN sur les trunks
- Ne jamais utiliser le VLAN 1 comme native VLAN sur les trunks (protection contre VLAN hopping)
- Utiliser un VLAN dédié (ex: VLAN 999 "NATIVE") non utilisé ailleurs

### VLANs non utilisés
- Créer uniquement les VLANs nécessaires
- Supprimer les VLANs créés par défaut non utilisés

---

## 7. QoS pour la voix

Si des phones IP sont présents, la QoS est indispensable :
```
mls qos                              ← activer QoS globalement (Cisco IOS)
interface GigabitEthernet1/0/5
 mls qos trust cos                   ← faire confiance au CoS du phone
 auto qos voip cisco-phone           ← ou utiliser le template auto QoS
```

**Priorité voix :** DSCP EF (46) / CoS 5 pour le trafic voix.

---

## 8. Signaux d'alerte à reporter dans le rapport

| Anomalie | Gravité | Description |
|----------|---------|-------------|
| Phone IP sans voice VLAN | Haute | Trafic voix et data mélangés → problèmes QoS |
| Port en VLAN 1 avec équipement | Haute | VLAN par défaut, pas de segmentation |
| Port trunk connecté à un PC | Haute | Possible exfiltration / mauvaise config |
| Port non utilisé sans shutdown | Moyenne | Risque de connexion non autorisée |
| 2 MACs sur port access non-phone | Moyenne | Mini-switch non autorisé ? |
| VLAN voix = VLAN data | Haute | Pas de séparation voix/données |
| Uplink en port access | Haute | Le trunk est configuré en access |

---

## 9. Identification des equipements par port

Pour chaque port, collecter tous les signaux disponibles et construire un profil.

### Sources d'identification (par ordre de fiabilite)

**1. LLDP Capabilities (le plus fiable)**
- `T` = Telephone (Phone IP)
- `B` = Bridge (switch/AP avec pont)
- `W` = WLAN Access Point
- `S` = Station (PC/serveur)
- `R` = Router

**2. CDP Device Type (Cisco uniquement)**
- "IP Phone" → Phone IP
- "Access Point" ou "AIR-" → AP Cisco
- "Catalyst" ou "C9xxx" → Switch Cisco

**3. OUI de la MAC address (fiabilite moyenne)**
Consulter `references/oui-vendors.md` :
- OUI vendor phone IP → phone probable
- OUI vendor AP → AP probable
- OUI Dell, HP, Lenovo, Apple → PC/workstation probable

**4. Type device interface web (Aruba Instant On)**
L'interface Instant On classe parfois les devices (PC, Phone, Printer). Confiance 60-70%.

**5. Heuristiques (fiabilite faible)**
- Port `trunk` avec 1 seule MAC → switch ou routeur aval
- Port avec 2+ MACs dont une OUI=phone → PC derriere phone IP
- Port avec 1 MAC OUI=inconnu → endpoint non identifie

### Cas particulier : PC derriere phone IP

Indices :
- 2 MACs visibles sur le meme port — une du phone (OUI phone), une du PC
- La MAC du phone est sur le VLAN voix, la MAC du PC sur le VLAN data
- Si LLDP montre uniquement le phone mais qu'il y a 2 MACs → PC derriere phone

---

## 10. Classification et pourcentage de confiance

### Calcul du % de confiance

| Signal | Points |
|--------|--------|
| LLDP capability confirmee (T, W, B...) | 95 pts base |
| CDP device type confirme | 90 pts base |
| OUI dans base connue phone/AP/camera | +20 pts |
| OUI generique PC (Dell, HP, Lenovo...) | 60 pts base |
| Type device web Aruba Instant On | 65 pts base |
| Description interface informative | +10 pts |
| Heuristique nombre de MACs | 40 pts base |
| OUI inconnu seul | 30 pts base |
| **Source = interface web uniquement** | **Plafonner a 70%** |

Le % final = min(score_cumule, 99%). Ne jamais afficher 100%.

### Types de classification

| Type | Description |
|------|-------------|
| `PC` | Endpoint informatique (workstation, laptop, serveur) |
| `Phone IP` | Telephone IP (Cisco, Yealink, Poly, Snom, etc.) |
| `Phone IP + PC` | Phone IP avec PC branche sur son port PC integre |
| `AP` | Point d'acces WiFi |
| `Switch aval` | Switch en cascade en aval |
| `Switch amont` | Switch ou routeur en amont (uplink) |
| `Inconnu` | Equipement non identifiable |
| `Port libre` | Aucune MAC detectee, port inactif |

---

## 11. Detection d'anomalies

Appliquer systematiquement ces regles sur les donnees collectees. Chaque anomalie detectee doit apparaitre dans le rapport.

### CRITIQUES — intervention immediate

| Regle | Pattern de detection |
|-------|---------------------|
| VLAN natif isolation sur port actif | Port UP avec PVID dans un VLAN d'isolation connu (666, parking, quarantaine, blackhole) |
| Half-duplex ou 10 Mbps | Vitesse 10Mbps ou duplex Half-Duplex sur port actif |
| Firmware obsolete | Date firmware > 3 ans ou version connue en fin de vie / fin de support |

### ATTENTION — a corriger a court terme

| Regle | Pattern de detection |
|-------|---------------------|
| PoE sur lien inter-switch | Port delivering PoE alors que LLDP montre un switch voisin |
| Nommage VLAN incoherent | Meme VLAN ID avec noms differents sur 2 switches (ex: INTERCO_DATA vs INTERCO) |
| VLAN absent d'un switch | VLAN configure sur SW1 mais pas SW2 (ou inverse) alors qu'un trunk les relie |
| Phones sur VLAN 1 natif | Phones IP PoE avec PVID=1 et VLAN voix disponible en tagged mais non confirme |
| Port UP sans MAC | Port physiquement UP mais aucune MAC apprise dans la table de forwarding |

### AMELIORATION — organisation et securisation

| Regle | Pattern de detection |
|-------|---------------------|
| VLAN inutilise | VLAN configure avec 0 port access assigne |
| Native VLAN 1 sur trunks | Lien trunk inter-switch avec PVID=1 (risque VLAN hopping) |
| Ports inactifs en VLAN 1 | Ports DOWN encore dans le VLAN par defaut au lieu d'un VLAN de quarantaine |
| Ports SFP inutilises | Ports SFP/SFP+ DOWN non desactives administrativement |

### Detections informatives

| Detection | Pattern |
|-----------|---------|
| VRRP | MAC 00:00:5e:00:01:xx = routeur virtuel VRRP (groupe = dernier octet en decimal) |
| VMs Hyper-V | MAC 00:15:5d:xx:xx:xx = VM Microsoft Hyper-V |
| LAG/Port-Channel | Ports membres d'un LAG, actifs ou inactifs |

---

## 12. Correlation multi-switch

Quand 2+ switches sont analyses, appliquer ces regles :

1. **Table VLAN croisee** : UNE seule table VLAN avec colonnes par switch. Comparer les noms, detecter les absences et incoherences.
2. **Detection liens inter-switches** : Croiser les voisins LLDP des deux cotes. Marquer principal (1G+) vs secondaire (100Mbps).
3. **Tracage VMs** : MACs Hyper-V (00:15:5d) sur trunk → identifier les VMs par VLAN, lister dans la topologie.
4. **Detection VRRP** : MAC 00:00:5e:00:01:xx → identifier le groupe ID (dernier octet).
5. **Agregation equipements** : Compter par type sur TOUS les switches (ex: "12 Phones IP" total).
6. **Equipements multi-interface** : Meme OUI + MACs consecutives sur plusieurs ports → regrouper (ex: NAS Synology iface DATA + BACKUP).
