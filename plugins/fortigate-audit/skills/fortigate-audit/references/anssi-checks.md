# Controles ANSSI — Recommandations de securite FortiGate

10 controles supplementaires bases sur les guides ANSSI (PA-023, PA-044).
Ces controles completent les 40 controles CIS et couvrent des points specifiques au referentiel francais.

---

## A.1 — Protocoles d'administration securises uniquement
- **Source** : `system_global` > `admin-telnet` + `system_interface` > `allowaccess` sur chaque interface
- **Critere** : `admin-telnet = disable` ET aucune interface avec `http` ou `telnet` dans `allowaccess`
- **Attendu** : Seuls `https` et `ssh` sont autorises pour l'administration
- **Severite** : critical
- **Recommandation** : `config system global` > `set admin-telnet disable` + sur chaque interface : `set allowaccess https ssh`
- **Ref ANSSI** : PA-023 R1

## A.2 — Durcissement SSH (algorithmes)
- **Source** : `system_global` > `ssh-enc-algo` et `ssh-mac-algo`
- **Critere** : Pas d'algorithmes faibles (arcfour, 3des-cbc, hmac-md5)
- **Attendu** : Uniquement aes128-ctr, aes256-ctr, aes128-gcm, aes256-gcm pour le chiffrement ; hmac-sha2-256, hmac-sha2-512 pour le MAC
- **Severite** : medium
- **Recommandation** : `config system global` > `set ssh-enc-algo aes128-ctr aes256-ctr aes128-gcm@openssh.com aes256-gcm@openssh.com`
- **Ref ANSSI** : PA-023 R2
- **Note** : Si `ssh-enc-algo` et `ssh-mac-algo` n'apparaissent pas dans `get system global`, verifier avec `show full-configuration system global | grep ssh`

## A.3 — Separation des flux d'administration [MANUAL]
- **Source** : `system_interface` et `system_zone` — rechercher une interface/zone dediee a l'administration
- **Critere** : L'administration ne se fait pas via une interface de production
- **Attendu** : Interface de management dediee (MGMT, loopback, ou VLAN d'administration)
- **Severite** : medium
- **Verification** : Chercher des zones nommees MGMT, OOB, ou des interfaces dediees admin
- **Ref ANSSI** : PA-023 R3

## A.4 — Journalisation vers un serveur externe
- **Source** : `log_syslogd` et `log_fortianalyzer`
- **Critere** : Au moins un des deux contient `set status enable` (section non vide avec une configuration reelle)
- **Attendu** : Un serveur de log externe configure (syslog ou FortiAnalyzer)
- **Severite** : high
- **Recommandation** : Configurer un serveur syslog ou FortiAnalyzer pour la centralisation des logs
- **Ref ANSSI** : PA-023 R7

## A.5 — Chiffrement des logs en transit
- **Source** : `log_fortianalyzer` > `enc-algorithm`
- **Critere** : `enc-algorithm = high` si FortiAnalyzer est configure
- **Attendu** : Chiffrement fort des logs en transit
- **Severite** : medium
- **Verdict** : MANUAL si seulement syslog (verifier TLS sur le transport) ; PASS si FortiAnalyzer avec enc-algorithm=high ; N/A si aucun serveur externe (conditionnel a A.4)
- **Verdict N/A si** : Controle A.4 est FAIL (aucun serveur de log externe configure)
- **Ref ANSSI** : PA-023 R8

## A.6 — Pas de regles trop permissives (any/any/any/accept)
- **Source** : `firewall_policy` — chercher les regles avec `srcaddr "all"` + `dstaddr "all"` + `service "ALL"` + `action accept`
- **Critere** : Aucune politique avec les 3 criteres a "all/ALL"
- **Attendu** : Toutes les regles accept ont au minimum un critere restrictif (source, destination ou service)
- **Severite** : critical
- **Recommandation** : Decouper les regles trop larges en regles specifiques
- **Ref ANSSI** : PA-044 R1

## A.7 — Politique de deny explicite en fin de table
- **Source** : `firewall_policy` — analyser la derniere politique
- **Critere** : La derniere politique est une regle `deny` ou FortiOS implicit deny est suffisant si logtraffic=all partout
- **Attendu** : Regle implicite ou explicite de deny en fin avec logging
- **Severite** : high
- **Recommandation** : Ajouter une politique deny-all en dernier avec `set logtraffic all`
- **Ref ANSSI** : PA-044 R2

## A.8 — Profils de securite appliques sur toutes les regles accept
- **Source** : `firewall_policy` > chercher `utm-status enable` sur chaque regle `action accept`
- **Critere** : Toutes les regles `accept` ont `utm-status = enable` avec au moins un profil (AV, IPS, webfilter)
- **Attendu** : Chaque regle accept a des profils de securite actifs
- **Severite** : high
- **Recommandation** : Appliquer un profil-group ou des profils individuels sur chaque regle accept
- **Ref ANSSI** : PA-044 R5

## A.9 — Mise a jour automatique des signatures IPS et AV
- **Source** : `system_autoupdate`
- **Critere** : `Scheduled update: enable` ET `Virus definitions update: enable` ET `IPS definitions update: enable`
- **Attendu** : Mises a jour regulieres des bases de signatures
- **Severite** : high
- **Recommandation** : Verifier la connectivite FortiGuard et activer les mises a jour
- **Ref ANSSI** : PA-044 R6

## A.10 — IPsec VPN avec algorithmes forts uniquement
- **Source** : `vpn_ipsec_phase1` et `vpn_ipsec_phase2`
- **Critere** : Phase1 : pas de 3des, pas de sha1 (seul), pas de DH group 1/2/5. Phase2 : pas de 3des, pas de sha1 (seul)
- **Attendu** : AES-256 + SHA-256 minimum pour phase1 et phase2, DH group >= 14
- **Severite** : critical
- **Recommandation** : `config vpn ipsec phase1-interface` > `set proposal aes256-sha256` > `set dhgrp 14 20`
- **Ref ANSSI** : PA-023 R12
