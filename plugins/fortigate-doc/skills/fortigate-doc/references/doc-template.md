# Template DOE FortiGate

## Structure Markdown

```markdown
# Dossier d'Exploitation — {{ nom_client }}

> **Equipement** : FortiGate {{ modele }}
> **Hostname** : {{ hostname }}
> **Serial** : {{ serial }}
> **Firmware** : {{ firmware }}
> **Date du document** : {{ date }}
> **Auteur** : {{ auteur }}

---

## 1. Identite de l'equipement

| Parametre | Valeur |
|-----------|--------|
| Hostname | {{ hostname }} |
| Modele | {{ modele }} |
| Numero de serie | {{ serial }} |
| Firmware | {{ firmware }} |
| Uptime | {{ uptime }} |
| VDOM | {{ vdom }} |
| Mode d'operation | {{ operation_mode }} |
| Licence | {{ licence_status }} |

---

## 2. Interfaces reseau

### 2.1 Interfaces physiques et logiques

| Interface | Type | IP / Masque | VLAN | Status | Alias | Zone | Allow Access |
|-----------|------|-------------|------|--------|-------|------|-------------|
| {{ pour chaque interface }} |

### 2.2 Zones de securite

| Zone | Interfaces membres | Intra-zone |
|------|--------------------|------------|
| {{ pour chaque zone }} |

---

## 3. Routage

### 3.1 Table de routage active

| Destination | Gateway | Interface | Distance | Metrique | Type |
|-------------|---------|-----------|----------|----------|------|
| {{ pour chaque route }} |

### 3.2 Routes statiques configurees

| # | Destination | Gateway | Interface | Distance | Status | Commentaire |
|---|-------------|---------|-----------|----------|--------|-------------|
| {{ pour chaque route statique }} |

---

## 4. Regles de filtrage (Firewall Policies)

### 4.1 Politiques de securite

| ID | Nom | Source Intf | Dest Intf | Source Addr | Dest Addr | Service | Action | NAT | Profils | Log |
|----|-----|------------|-----------|-------------|-----------|---------|--------|-----|---------|-----|
| {{ pour chaque policy }} |

### 4.2 Objets adresses references

| Nom | Type | Valeur | Commentaire |
|-----|------|--------|-------------|
| {{ pour chaque objet utilise dans les policies }} |

### 4.3 Services references

| Nom | Protocole | Port(s) | Commentaire |
|-----|-----------|---------|-------------|
| {{ pour chaque service utilise dans les policies }} |

---

## 5. VPN

### 5.1 Tunnels IPsec

| Nom | Peer distant | Interface | Phase 1 (proposal) | Phase 2 (proposal) | DH Group | Status |
|-----|-------------|-----------|--------------------|--------------------|----------|--------|
| {{ pour chaque tunnel IPsec }} |

### 5.2 SSL VPN

| Parametre | Valeur |
|-----------|--------|
| Port d'ecoute | {{ port }} |
| Interface d'ecoute | {{ interface }} |
| Certificat | {{ servercert }} |
| Portails | {{ portails }} |
| Realms | {{ realms }} |

---

## 6. Profils de securite

### 6.1 Antivirus

| Profil | HTTP | SMTP | POP3 | IMAP | FTP | ML Detection |
|--------|------|------|------|------|-----|-------------|
| {{ pour chaque profil AV }} |

### 6.2 IPS

| Capteur | Entries | Botnet | Action par defaut |
|---------|---------|--------|-------------------|
| {{ pour chaque capteur IPS }} |

### 6.3 Web Filter

| Profil | Mode | Categories bloquees | Log |
|--------|------|--------------------|----|
| {{ pour chaque profil webfilter }} |

### 6.4 Application Control

| Profil | Categories bloquees/monitorees |
|--------|-------------------------------|
| {{ pour chaque profil appctrl }} |

---

## 7. Services reseau

### 7.1 DHCP

| Interface | Pool debut | Pool fin | Masque | Bail | DNS | Gateway | Options |
|-----------|-----------|---------|--------|------|-----|---------|---------|
| {{ pour chaque serveur DHCP }} |

### 7.2 DNS

| Parametre | Valeur |
|-----------|--------|
| DNS primaire | {{ primary }} |
| DNS secondaire | {{ secondary }} |
| Mode | {{ dns_mode }} |

### 7.3 NTP

| Parametre | Valeur |
|-----------|--------|
| NTP sync | {{ ntpsync }} |
| Serveur | {{ server }} |

---

## 8. Administration

### 8.1 Comptes administrateurs

| Nom | Profil | Type auth | Trusted Hosts | 2FA |
|-----|--------|-----------|---------------|-----|
| {{ pour chaque admin }} |

### 8.2 Logging

| Destination | Type | Status | Serveur | Port |
|-------------|------|--------|---------|------|
| {{ syslog, FortiAnalyzer, local }} |

### 8.3 SNMP

| Parametre | Valeur |
|-----------|--------|
| Version | {{ v2c / v3 }} |
| Community / User | {{ community ou user }} |
| Traps | {{ status }} |

---

## 9. Haute Disponibilite (HA)

| Parametre | Valeur |
|-----------|--------|
| Mode | {{ ha_mode }} |
| Groupe | {{ group_name }} |
| Priorite | {{ priority }} |
| Membres | {{ membres }} |
| Heartbeat | {{ hb_interfaces }} |
| Monitoring | {{ monitored_interfaces }} |
| Sync status | {{ sync_status }} |

---

## 10. Recommandations

### Points d'attention

{{ liste des constatations issues de l'analyse : firmware ancien, policies trop larges,
   absence de profils de securite, logging desactive, etc. }}

### Ameliorations suggerees

| # | Recommandation | Priorite | Impact |
|---|---------------|----------|--------|
| {{ pour chaque recommandation }} |

---

*Document genere automatiquement via FortiGate MCP Server + Claude Code*
```

---

## Template HTML (self-contained)

Pour generer un DOE en HTML self-contained, encapsuler le contenu Markdown converti en HTML
dans cette structure avec CSS inline :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DOE FortiGate — {{ hostname }}</title>
<style>
  :root {
    --primary: #1a5276;
    --secondary: #2e86c1;
    --accent: #e74c3c;
    --bg: #f8f9fa;
    --text: #2c3e50;
    --border: #dee2e6;
    --success: #27ae60;
    --warning: #f39c12;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: var(--text);
    background: var(--bg);
    line-height: 1.6;
    max-width: 1100px;
    margin: 0 auto;
    padding: 20px 40px;
  }
  h1 {
    color: var(--primary);
    border-bottom: 3px solid var(--secondary);
    padding-bottom: 10px;
    margin: 30px 0 15px;
    font-size: 1.8em;
  }
  h2 {
    color: var(--primary);
    border-bottom: 2px solid var(--border);
    padding-bottom: 8px;
    margin: 25px 0 12px;
    font-size: 1.4em;
  }
  h3 {
    color: var(--secondary);
    margin: 18px 0 8px;
    font-size: 1.1em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 20px;
    font-size: 0.88em;
  }
  th {
    background: var(--primary);
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
  }
  tr:nth-child(even) { background: #eef2f5; }
  tr:hover { background: #d6eaf8; }
  blockquote {
    background: #eef2f5;
    border-left: 4px solid var(--secondary);
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 0.95em;
  }
  code {
    background: #e8e8e8;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }
  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 25px 0;
  }
  .header-meta {
    background: white;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 15px 20px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .status-up { color: var(--success); font-weight: bold; }
  .status-down { color: var(--accent); font-weight: bold; }
  @media print {
    body { max-width: 100%; padding: 10px; font-size: 10pt; }
    h1 { page-break-before: always; }
    h1:first-of-type { page-break-before: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <!-- Contenu HTML converti depuis le Markdown ci-dessus -->
</body>
</html>
```

## Notes de generation

- **Interfaces down** : les marquer avec la classe `status-down` en HTML
- **Policies desactivees** : les griser ou les mettre en italique
- **VPN tunnels down** : les signaler visuellement
- **Tableaux longs** (>50 lignes) : ajouter un resume avant le tableau detaille
- **Recommandations** : prioriser par impact (Critique > Important > Moyen > Faible)
- **Print-friendly** : le CSS inclut des regles `@media print` pour l'impression PDF
