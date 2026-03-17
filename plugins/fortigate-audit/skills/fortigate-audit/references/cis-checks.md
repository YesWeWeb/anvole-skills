# Controles CIS Benchmark FortiGate 7.4.x

40 controles automatisables. Pour chaque controle :
- **Source** : cle dans `audit-data.json` (collecte SSH) ou champ `get system global`
- **Critere** : condition PASS
- **Severite** : critical, high ou medium (poids dans le score et tri des priorites)
- **Recommandation** : commande corrective si FAIL

---

## 1. Parametres Reseau (Network Settings)

### 1.1 — Serveur DNS configure
- **Source** : `system_dns` > `primary`
- **Critere** : `primary != "0.0.0.0"`
- **Attendu** : Un serveur DNS primaire configure (different de 0.0.0.0)
- **Severite** : medium
- **Recommandation** : `config system dns` > `set primary <IP_DNS>` > `set secondary <IP_DNS>`

### 1.2 — Trafic intra-zone bloque par defaut
- **Source** : `system_zone` > chaque zone > `intrazone`
- **Critere** : Toutes les zones ont `intrazone = deny`
- **Attendu** : Aucune zone avec `intrazone != deny`
- **Severite** : high
- **Recommandation** : `config system zone` > `edit <zone>` > `set intrazone deny`

### 1.3 — Services de gestion desactives sur WAN
- **Source** : `system_interface` > interfaces WAN > `allowaccess`
- **Critere** : Aucun service d'administration (https, ssh, ping, snmp) sur les interfaces WAN
- **Severite** : medium
- **Recommandation** : `config system interface` > `edit <wan>` > `set allowaccess` (vide)
- **Note** : Si `allowaccess` n'apparait pas dans `show full-configuration`, verifier dans la sortie `system_interface` les interfaces dont le nom contient "wan"

---

## 2. Parametres Systeme (System Settings)

### 2.1.1 — Banniere Pre-Login definie
- **Source** : `system_global` > `pre-login-banner`
- **Critere** : `pre-login-banner = enable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set pre-login-banner enable`

### 2.1.2 — Banniere Post-Login definie
- **Source** : `system_global` > `post-login-banner`
- **Critere** : `post-login-banner = enable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set post-login-banner enable`

### 2.1.3 — Fuseau horaire configure [MANUAL]
- **Source** : `system_global` > `timezone`
- **Critere** : Fuseau coherent avec la localisation geographique du site
- **Severite** : medium
- **Verification** : Comparer le timezone avec la localisation reelle

### 2.1.4 — Heure systeme configuree via NTP
- **Source** : `system_ntp` > `ntpsync`
- **Critere** : `ntpsync = enable`
- **Severite** : high
- **Recommandation** : `config system ntp` > `set ntpsync enable`

### 2.1.5 — Hostname defini
- **Source** : `system_global` > `hostname`
- **Critere** : `hostname != ""` ET `hostname != "FortiGate"`
- **Severite** : high
- **Recommandation** : `config system global` > `set hostname <nom_significatif>`

### 2.1.6 — Dernier firmware installe [MANUAL]
- **Source** : `system_status` > `Version`
- **Severite** : medium
- **Verification** : Comparer la version firmware avec le portail de support Fortinet

### 2.1.7 — Installation firmware/config via USB desactivee
- **Source** : `system_global` > `auto-install-config` et `auto-install-image`
- **Critere** : Les deux a `disable`
- **Severite** : high
- **Recommandation** : `config system global` > `set auto-install-config disable` > `set auto-install-image disable`

### 2.1.8 — Cles statiques TLS desactivees
- **Source** : `system_global` > `ssl-static-key-ciphers`
- **Critere** : `ssl-static-key-ciphers = disable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set ssl-static-key-ciphers disable`

### 2.1.9 — Chiffrement fort global active
- **Source** : `system_global` > `strong-crypto`
- **Critere** : `strong-crypto = enable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set strong-crypto enable`

### 2.1.10 — Interface GUI ecoute sur TLS securise
- **Source** : `system_global` > `admin-https-ssl-versions`
- **Critere** : Contient `tlsv1-2` ou `tlsv1-3` (pas de tlsv1-0 ni tlsv1-1)
- **Severite** : medium
- **Recommandation** : `config system global` > `set admin-https-ssl-versions tlsv1-2 tlsv1-3`

### 2.1.11 — CLI audit log active
- **Source** : `system_global` > `cli-audit-log`
- **Critere** : `cli-audit-log = enable`
- **Severite** : high
- **Recommandation** : `config system global` > `set cli-audit-log enable`

### 2.1.12 — Evenement de surcharge CPU mono-coeur loggue [MANUAL]
- **Source** : `system_global` > `log-single-cpu-high`
- **Severite** : medium
- **Verification** : Verifier si le logging des evenements CPU est actif

### 2.1.13 — Hostname masque sur la mire de login
- **Source** : `system_global` > `gui-display-hostname`
- **Critere** : `gui-display-hostname = disable`
- **Severite** : high
- **Recommandation** : `config system global` > `set gui-display-hostname disable`

### 2.1.14 — Certificat d'administration personnalise
- **Source** : `system_global` > `admin-server-cert`
- **Critere** : `admin-server-cert != "Fortinet_Factory"` ET `admin-server-cert != "self-sign"`
- **Severite** : medium
- **Recommandation** : `config system global` > `set admin-server-cert <certificat_personnalise>`

### 2.1.15 — Chiffrement des donnees privees
- **Source** : `system_global` > `private-data-encryption`
- **Critere** : `private-data-encryption = enable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set private-data-encryption enable`

### 2.1.16 — Bouton reset physique desactive
- **Source** : `system_global` > `admin-reset-button`
- **Critere** : `admin-reset-button = disable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set admin-reset-button disable`

### 2.1.17 — Timeout de console serie configure
- **Source** : `system_global` > `admin-console-timeout`
- **Critere** : `admin-console-timeout > 0` (idealement 5 minutes)
- **Severite** : medium
- **Recommandation** : `config system global` > `set admin-console-timeout 5`

### 2.1.18 — Horodatage des connexions admin
- **Source** : `system_global` > `login-timestamp`
- **Critere** : `login-timestamp = enable`
- **Severite** : medium
- **Recommandation** : `config system global` > `set login-timestamp enable`

---

## 2.2 Politique de Mots de Passe

### 2.2.1 — Politique de mots de passe activee
- **Source** : `system_password_policy` > `status` et `min-length`
- **Critere** : `status = enable` ET `min-length >= 14`
- **Severite** : critical
- **Recommandation** : `config system password-policy` > `set status enable` > `set min-length 14`

### 2.2.2 — Verrouillage admin configure
- **Source** : `system_global` > `admin-lockout-threshold` et `admin-lockout-duration`
- **Critere** : `admin-lockout-threshold <= 3` ET `admin-lockout-duration >= 300`
- **Severite** : critical
- **Recommandation** : `config system global` > `set admin-lockout-threshold 3` > `set admin-lockout-duration 300`

---

## 2.3 SNMP

### 2.3.1 — Seul SNMPv3 est active
- **Source** : `snmp_community` — chercher si des communities SNMPv1/v2c sont configurees
- **Critere** : Aucune community SNMPv1/v2c active (seulement SNMPv3 via `snmp_user`)
- **Severite** : critical
- **Recommandation** : Supprimer les communities v1/v2c, migrer vers SNMPv3

### 2.3.2 — Trusted Hosts configures pour SNMPv3
- **Source** : `snmp_user` > champ `notify-hosts` ou `hosts`
- **Critere** : Chaque utilisateur SNMPv3 a un acces restreint par IP (pas 0.0.0.0)
- **Severite** : medium
- **Recommandation** : Configurer des trusted hosts pour chaque utilisateur SNMPv3

### 2.3.3 — Requetes SNMPv3 non necessaires desactivees [MANUAL]
- **Severite** : medium
- **Verification** : Desactiver les requetes dynamiques non necessaires

### 2.3.4 — Traps SNMP pour l'usage memoire [MANUAL]
- **Severite** : medium
- **Verification** : Verifier les seuils d'alerte SNMP pour la memoire

---

## 2.4 Administrateurs et Profils

### 2.4.1 — Compte 'admin' par defaut supprime ou desactive
- **Source** : `system_admin` > liste des comptes
- **Critere** : Aucun compte nomme `admin` actif ou avec profil super_admin
- **Severite** : critical
- **Recommandation** : Creer un nouveau compte admin, puis desactiver le compte `admin` par defaut

### 2.4.2 — Trusted Hosts actives pour tous les comptes
- **Source** : `system_admin` > champ `trusthost1` de chaque admin
- **Critere** : Chaque admin a `trusthost1` different de `0.0.0.0 0.0.0.0`
- **Severite** : high
- **Recommandation** : Configurer des trusted hosts pour chaque compte admin

### 2.4.3 — Profils d'administration restreints (moindre privilege)
- **Source** : `system_admin` > champ `accprofile` de chaque admin
- **Critere** : Pas tous les comptes avec `accprofile = super_admin` ; au moins un profil restreint
- **Severite** : critical
- **Recommandation** : Creer des profils d'administration avec droits limites selon les roles

### 2.4.4 — Delai d'expiration (idle timeout) configure
- **Source** : `system_global` > `admintimeout`
- **Critere** : `admintimeout <= 15` (minutes), idealement 5
- **Severite** : high
- **Recommandation** : `config system global` > `set admintimeout 5`

### 2.4.5 — Telnet desactive globalement
- **Source** : `system_global` > `admin-telnet`
- **Critere** : `admin-telnet = disable`
- **Severite** : high
- **Recommandation** : `config system global` > `set admin-telnet disable`

### 2.4.6 — Politiques Local-in appliquees
- **Source** : `firewall_local_in_policy` — verifier le contenu
- **Critere** : Au moins une politique local-in existe (section non vide)
- **Severite** : high
- **Recommandation** : Configurer des local-in-policy pour restreindre l'acces aux services d'administration

### 2.4.7 — MFA obligatoire pour les administrateurs
- **Source** : `system_global` > `two-factor-authentication` ou `multi-factor-authentication`
- **Critere** : MFA en mode `enforced` (pas `optional`)
- **Severite** : critical
- **Recommandation** : `config system global` > `set two-factor-authentication enforced`

### 2.4.8 — Virtual patching sur l'interface de gestion [MANUAL]
- **Severite** : medium
- **Verification** : Verifier qu'un profil IPS est applique sur les flux d'administration

---

## 2.6 Haute Disponibilite (HA)

### 2.6.1 — Configuration HA activee
- **Source** : `system_ha` > `mode`
- **Critere** : `mode != standalone` (ex: `a-p` ou `a-a`)
- **Severite** : medium
- **Recommandation** : `config system ha` > `set mode a-p`
- **Note** : Ce controle peut etre N/A si le FortiGate n'est pas prevu en HA (equipement unique sur site)
- **Verdict N/A si** : `system_ha > mode == "standalone"` et l'architecture ne prevoit pas de cluster

### 2.6.2 — Monitoring d'interfaces HA active
- **Source** : `system_ha` > `monitor`
- **Critere** : `monitor != ""` (au moins une interface surveillee)
- **Severite** : medium
- **Recommandation** : `config system ha` > `set monitor <interfaces>`
- **Note** : Conditionnel a 2.6.1 — si standalone est justifie, ce controle est aussi N/A
- **Verdict N/A si** : Controle 2.6.1 est N/A

---

## 3. Politiques et Objets (Policy and Objects)

### 3.1 — Politiques inutilisees revues regulierement [MANUAL]
- **Source** : `firewall_policy` — politiques avec `set status disable`
- **Critere** : Aucune politique desactivee ou avec 0 hits encore presente
- **Severite** : medium
- **Recommandation** : Desactiver puis supprimer les regles identifiees apres validation

### 3.2 — Politiques sans service 'ALL'
- **Source** : `firewall_policy` > chercher `set service "ALL"`
- **Critere** : Aucune politique `accept` avec le service `ALL`
- **Severite** : medium
- **Recommandation** : Remplacer `ALL` par les services specifiques necessaires

### 3.3 — Blocage Tor/Malicious/Scanners via ISDB [MANUAL]
- **Severite** : medium
- **Verification** : Verifier la presence d'une politique DENY en tete utilisant les ISDB

### 3.4 — Logging active sur toutes les regles
- **Source** : `firewall_policy` > `logtraffic` de chaque politique
- **Critere** : `logtraffic != disable` sur toutes les politiques actives
- **Severite** : medium
- **Recommandation** : `config firewall policy` > `edit <id>` > `set logtraffic all`

---

## 4. Profils de Securite (Security Profiles)

### 4.1.1 — Detection des connexions Botnet par l'IPS
- **Source** : `ips_sensor` > champ `scan-botnet-connections` de chaque capteur
- **Critere** : `scan-botnet-connections = block` sur tous les capteurs IPS actifs
- **Severite** : medium
- **Recommandation** : `config ips sensor` > `edit <nom>` > `set scan-botnet-connections block`

### 4.2.4 — Detection malware par IA/Heuristique (Machine Learning)
- **Source** : `antivirus_profile` > `machine-learning-detection`
- **Critere** : `machine-learning-detection = enable` sur tous les profils AV
- **Severite** : medium
- **Recommandation** : `config antivirus profile` > `edit <nom>` > `set machine-learning-detection enable`

### 4.2.5 — Detection de Grayware sur l'Antivirus [MANUAL]
- **Source** : `antivirus_profile` > champ `grayware`
- **Severite** : medium
- **Verification** : Verifier l'option grayware dans les profils antivirus

### 4.3.2 — Filtre DNS loggue toutes les requetes
- **Source** : `dnsfilter_profile` > `log-all-domain`
- **Critere** : `log-all-domain = enable`
- **Severite** : medium
- **Recommandation** : `config dnsfilter profile` > `edit <nom>` > `set log-all-domain enable`

---

## 5. Inspection et Filtrage Avance

### 5.1 — Profil d'inspection SSL/SSH en mode deep inspection
- **Source** : `ssl_ssh_profile` > chercher `set inspection-mode` ou profil `deep-inspection`
- **Critere** : Au moins un profil SSL/SSH en deep inspection actif
- **Severite** : high
- **Attendu** : Un profil deep-inspection configure et applique sur les politiques critiques
- **Recommandation** : Configurer un profil deep-inspection et l'appliquer sur les politiques internet

### 5.2 — Profil Web Filter configure
- **Source** : `webfilter_profile` — verifier la presence d'au moins un profil actif
- **Critere** : Au moins un profil webfilter configure (section non vide)
- **Severite** : medium
- **Attendu** : Un profil webfilter actif avec des categories bloquees
- **Recommandation** : Configurer un profil webfilter et l'appliquer sur les politiques internet

---

## 6. VPN

### 6.1.1 — Certificat VPN signe par une autorite de confiance
- **Source** : `vpn_ssl_settings` > `servercert`
- **Critere** : `servercert` n'est ni `self-sign` ni `Fortinet_Factory`
- **Severite** : high
- **Recommandation** : Configurer un certificat signe par une CA de confiance

### 6.1.2 — Versions TLS limitees pour le SSL VPN
- **Source** : `vpn_ssl_settings` > `ssl-min-proto-ver`
- **Critere** : `ssl-min-proto-ver = tls1-2` ou superieur (pas tls1-0 ni tls1-1)
- **Severite** : high
- **Recommandation** : `config vpn ssl settings` > `set ssl-min-proto-ver tls1-2`

---

## 7. Logs et Rapports

### 7.1.1 — Logging des evenements active
- **Source** : `log_eventfilter` > contenu
- **Critere** : Configuration active (pas de `set event disable`)
- **Severite** : medium
- **Note** : Par defaut sur FortiOS 7.4, event logging est enable. Si la section est vide ou par defaut, c'est PASS.
