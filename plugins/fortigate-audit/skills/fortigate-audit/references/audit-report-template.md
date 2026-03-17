# Template de Rapport d'Audit FortiGate

Utiliser ce template pour generer le rapport final. Remplacer les variables entre `{{ }}`.

---

```markdown
# Rapport d'Audit de Conformite CIS / ANSSI — FortiGate

> **Appareil** : `{{ device_id }}` | **Hostname** : `{{ hostname }}` | **Modele** : `{{ model }}`
> **Firmware** : `{{ firmware }}` | **Serial** : `{{ serial }}` | **Date** : {{ date }}

---

## 1. Parametres Reseau (Network Settings)

{{ pour chaque controle 1.x }}

#### {{ cis_id }} — {{ titre }} [{{ PASS | FAIL | MANUAL | N/A }}]
- **Attendu** : {{ valeur_attendue }}
- **Constate** : {{ valeur_constatee }}
{{ si FAIL : }}
- **Recommandation** : {{ commande_corrective }}

{{ fin pour }}

---

## 2. Parametres Systeme (System Settings)

### 2.1 Parametres Globaux

{{ controles 2.1.x }}

### 2.2 Politique de Mots de Passe

{{ controles 2.2.x }}

### 2.3 SNMP

{{ controles 2.3.x }}

### 2.4 Administrateurs et Profils

{{ controles 2.4.x }}

### 2.6 Haute Disponibilite (HA)

{{ controles 2.6.x }}

---

## 3. Politiques et Objets (Policy and Objects)

{{ controles 3.x }}

---

## 4. Profils de Securite (Security Profiles)

{{ controles 4.x }}

---

## 5. Inspection et Filtrage Avance

{{ controles 5.x }}

---

## 6. VPN

{{ controles 6.x }}

---

## 7. Logs et Rapports

{{ controles 7.x }}

---

## A. Controles ANSSI Supplementaires

{{ controles A.x }}

---

## Synthese de l'Audit

| Resultat | Nombre | Pourcentage |
|----------|--------|-------------|
| PASS     | {{ pass_count }} | {{ pass_pct }}% |
| FAIL     | {{ fail_count }} | {{ fail_pct }}% |
| MANUAL   | {{ manual_count }} | {{ manual_pct }}% |
| N/A      | {{ na_count }} | {{ na_pct }}% |
| **Total** | **{{ total }}** | |

> **Score de conformite automatise** : {{ pass_count }}/{{ pass_count + fail_count }} controles automatises conformes ({{ score }}%) — MANUAL et N/A exclus du calcul

### Priorites de remédiation

1. **Critique** : controles FAIL de severite critical (chiffrement, mots de passe, acces admin, regles permissives)
2. **Important** : controles FAIL de severite high (durcissement, NTP, logging, VPN, profils de securite)
3. **Moyen** : controles FAIL de severite medium (bannieres, hygiene, policies inutilisees, services trop larges)
4. **A verifier** : controles MANUAL necessitant une validation humaine

### Commandes correctives

{{ liste des commandes FortiOS a executer pour corriger tous les FAIL, regroupees par section config }}
```

---

## Notes d'utilisation

- Le score exclut les controles MANUAL et N/A du calcul automatise
- Les controles marques [MANUAL] dans les references sont toujours en verdict MANUAL sauf si des donnees supplementaires permettent un verdict automatique
- Si un outil MCP retourne une erreur, le controle correspondant passe en MANUAL avec la mention "Donnee indisponible"
- Les commandes correctives doivent etre validees par l'ingenieur avant execution
- Pour les controles HA (2.6.x), adapter le verdict si le FortiGate n'est pas prevu en cluster (N/A au lieu de FAIL)
- Pour A.5 (chiffrement des logs), si A.4 est FAIL (aucun serveur externe), le verdict est N/A
- Chaque controle dans les references a un champ **Severite** (critical, high, medium) qui determine le tri des priorites de remediation
