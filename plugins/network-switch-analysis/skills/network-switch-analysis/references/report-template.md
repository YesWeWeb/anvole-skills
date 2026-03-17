# Template HTML — Rapport d'analyse reseau

Ce fichier est la reference pour generer les rapports HTML. **Lire ce fichier AVANT de generer tout rapport.**

Le rapport est TOUJOURS un fichier `.html` autonome (self-contained). Ne JAMAIS produire de Markdown.

---

## A. Bloc CSS complet

Copier ce bloc `<style>` verbatim dans chaque rapport genere. Ne pas modifier les classes CSS.

```html
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; background: #f4f6f8; color: #222; }
  .header { background: #1a2a4a; color: #fff; padding: 24px 32px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .header p { color: #a0b0c8; font-size: 12px; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px 20px; }
  h2 { font-size: 15px; font-weight: 700; color: #1a2a4a; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #1a2a4a; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 16px 0; }
  .kpi { background: #fff; border-radius: 6px; padding: 14px 16px; border-left: 4px solid #2c7ad6; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .kpi .val { font-size: 28px; font-weight: 700; color: #1a2a4a; }
  .kpi .lbl { font-size: 11px; color: #666; margin-top: 2px; }
  .kpi.warn { border-left-color: #e05a2b; }
  .kpi.warn .val { color: #e05a2b; }
  .topo { background: #fff; border-radius: 6px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 16px; overflow-x: auto; }
  .topo pre { font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; line-height: 1.6; color: #1a2a4a; white-space: pre; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 16px; }
  th { background: #2c4a7a; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; white-space: nowrap; }
  td { padding: 6px 10px; border-bottom: 1px solid #eef0f3; vertical-align: middle; font-size: 12px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f0f4fa; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; white-space: nowrap; }
  .badge-up { background: #d4edda; color: #155724; }
  .badge-down { background: #f0f0f0; color: #888; }
  .badge-warn { background: #fff3cd; color: #856404; }
  .badge-crit { background: #f8d7da; color: #721c24; }
  .badge-phone { background: #cce5ff; color: #004085; }
  .badge-ap { background: #d4edda; color: #155724; }
  .badge-server { background: #e2d9f3; color: #4a235a; }
  .badge-trunk { background: #fff3cd; color: #856404; }
  .badge-vm { background: #e8d5f5; color: #5a1a80; }
  .badge-nas { background: #dce8f5; color: #0d3b66; }
  .badge-print { background: #fce4d6; color: #8b2500; }
  .badge-uplink { background: #2c4a7a; color: #fff; }
  .poe-bar { display: inline-block; height: 8px; background: #2c7ad6; border-radius: 4px; min-width: 2px; vertical-align: middle; margin-right: 4px; }
  .anomaly-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
  .anomaly-box.crit { background: #f8d7da; border-color: #dc3545; }
  .anomaly-box h4 { font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #721c24; }
  .anomaly-box ul { padding-left: 16px; }
  .anomaly-box li { margin: 4px 0; font-size: 12px; }
  .rec-box { background: #d4edda; border: 1px solid #28a745; border-radius: 6px; padding: 12px 16px; margin: 8px 0; }
  .rec-box h4 { font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #155724; }
  .rec-box ul { padding-left: 16px; }
  .rec-box li { margin: 4px 0; font-size: 12px; }
  .switch-card { background: #fff; border-radius: 8px; box-shadow: 0 1px 6px rgba(0,0,0,.1); padding: 14px 20px; margin-bottom: 10px; border-top: 4px solid #2c7ad6; }
  .switch-card.cisco { border-top-color: #049fd9; }
  .switch-card.hp { border-top-color: #0096d6; }
  .switch-card.fortinet { border-top-color: #ee3124; }
  .switch-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: #444; }
  .switch-meta span strong { color: #1a2a4a; }
  .port-inactive td { opacity: 0.55; }
  .conf { font-size: 10px; color: #888; }
  code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-family: 'Consolas', monospace; font-size: 11px; }
  .crit-text { color: #dc3545; font-weight: 700; }
  .warn-text { color: #e05a2b; font-weight: 600; }
</style>
```

---

## B. Squelette HTML

Structure obligatoire du rapport. Chaque section est OBLIGATOIRE (sauf mention contraire).

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport d'analyse reseau — [NOM DU SITE]</title>
<!-- COLLER LE BLOC <style> CI-DESSUS -->
</head>
<body>

<!-- ============================================================ -->
<!-- SECTION 1 : HEADER                                           -->
<!-- ============================================================ -->
<div class="header">
  <h1>Rapport d'analyse reseau — [NOM DU SITE]</h1>
  <p>Genere le [JJ/MM/AAAA] | [N] switches analyses | Source : [sources] | Confiance max : [X]%</p>
</div>

<div class="container">

<!-- ============================================================ -->
<!-- SECTION 2 : KPIs                                             -->
<!-- 6 cartes minimum. Utiliser .kpi.warn pour les anomalies.     -->
<!-- ============================================================ -->
<div class="summary-grid">
  <div class="kpi"><div class="val">[N]</div><div class="lbl">Switches analyses</div></div>
  <div class="kpi"><div class="val">[N]</div><div class="lbl">Ports actifs (total)</div></div>
  <div class="kpi"><div class="val">[N]</div><div class="lbl">Telephones IP</div></div>
  <div class="kpi"><div class="val">[N]</div><div class="lbl">APs WiFi</div></div>
  <div class="kpi"><div class="val">[N]</div><div class="lbl">VLANs configures</div></div>
  <div class="kpi warn"><div class="val">[N]</div><div class="lbl">Anomalies detectees</div></div>
</div>

<!-- ============================================================ -->
<!-- SECTION 3 : TOPOLOGIE INTER-SWITCHES                         -->
<!-- ASCII art dans <pre>. Utiliser box-drawing (lignes, coins).  -->
<!-- Montrer : port-a-port, vitesse, VMs, anomalies inline.       -->
<!-- Pour 1 seul switch : montrer uplinks et equipements majeurs. -->
<!-- ============================================================ -->
<h2>Topologie inter-switches</h2>
<div class="topo">
<pre>
[ASCII ART ICI — voir regles ci-dessous]
</pre>
</div>

<!-- ============================================================ -->
<!-- SECTION 4 : ANOMALIES DETECTEES                              -->
<!-- 3 boites de severite. Omettre une boite si 0 anomalie de ce  -->
<!-- niveau. Au moins une boite doit etre presente.               -->
<!-- ============================================================ -->
<h2>Anomalies detectees</h2>

<!-- Niveau CRITIQUE — intervention immediate -->
<div class="anomaly-box crit">
  <h4>CRITIQUE — Intervention requise</h4>
  <ul>
    <li><strong>[Localisation] :</strong> [Description + impact + action corrective]</li>
  </ul>
</div>

<!-- Niveau ATTENTION — a corriger a court terme -->
<div class="anomaly-box">
  <h4>ATTENTION — A corriger a court terme</h4>
  <ul>
    <li><strong>[Localisation] :</strong> [Description + action]</li>
  </ul>
</div>

<!-- Niveau AMELIORATION — organisation et securisation -->
<div class="rec-box">
  <h4>AMELIORATIONS — Organisation et securisation</h4>
  <ul>
    <li><strong>[Sujet] :</strong> [Recommandation]</li>
  </ul>
</div>

<!-- ============================================================ -->
<!-- SECTION 5 : ETAT DES LIEUX VLAN                              -->
<!-- En mode multi-switch : UNE seule table croisee.              -->
<!-- En mode mono-switch : colonnes Nom, Role, Ports, Statut.     -->
<!-- ============================================================ -->
<h2>Etat des lieux VLAN</h2>
<table>
  <thead>
    <tr>
      <th>ID</th><th>Nom SW1</th><th>Nom SW2</th><th>Role</th>
      <th>Ports acces SW1</th><th>Ports acces SW2</th><th>Statut</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>[ID]</strong></td>
      <td>[Nom sur SW1]</td>
      <td>[Nom sur SW2]</td>
      <td>[Role / description]</td>
      <td>[Ports untagged SW1]</td>
      <td>[Ports untagged SW2]</td>
      <td><span class="badge badge-up">Actif</span></td>
      <!-- Badges possibles : badge-up (Actif), badge-down (INACTIF), badge-warn (Nommage incoherent / Absent SWx / A segmenter), badge-crit (ANOMALIE) -->
    </tr>
  </tbody>
</table>

<!-- ============================================================ -->
<!-- SECTION 6 : INVENTAIRE PAR SWITCH                            -->
<!-- Repeter ce bloc pour chaque switch analyse.                  -->
<!-- ============================================================ -->
<h2>SW1 — [HOSTNAME] | [MODELE]</h2>
<div class="switch-card">
  <!-- Ajouter classe .cisco, .hp, .fortinet selon vendor -->
  <div class="switch-meta">
    <span><strong>IP :</strong> [IP]</span>
    <span><strong>Modele :</strong> [modele complet]</span>
    <span><strong>Firmware :</strong> [version]</span>
    <span><strong>Ports actifs :</strong> [N] / [total]</span>
    <span><strong>Source :</strong> [CLI SSH / API WCD / etc.]</span>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Port</th><th>Statut</th><th>Vitesse</th><th>PoE</th>
      <th>VLAN natif (PVID)</th><th>VLANs tagges</th>
      <th>Equipement identifie</th><th>Conf.</th><th>Remarque</th>
    </tr>
  </thead>
  <tbody>
    <!-- PORT ACTIF — exemple phone IP -->
    <tr>
      <td>8</td>
      <td><span class="badge badge-up">UP</span></td>
      <td>100 Mbps</td>
      <td><div class="poe-bar" style="width:34px"></div>3.4W</td>
      <td>1</td>
      <td>100</td>
      <td><span class="badge badge-phone">Phone IP (PoE)</span></td>
      <td class="conf">65%</td>
      <td>100Mbps + PoE 3.4W</td>
    </tr>
    <!-- PORT INACTIF — grouper les plages -->
    <tr class="port-inactive">
      <td>9-16</td>
      <td><span class="badge badge-down">DOWN</span></td>
      <td>—</td><td>—</td><td>1</td><td>Multi-VLAN</td>
      <td>Ports libres</td><td>—</td><td></td>
    </tr>
    <!-- PORT ANOMALIE -->
    <tr>
      <td>2</td>
      <td><span class="badge badge-crit">UP</span></td>
      <td>1G</td><td>Non</td>
      <td><span class="crit-text">666 — Blackhole !</span></td>
      <td>Multi-VLAN</td>
      <td>Inconnu — trafic natif isole</td><td>—</td>
      <td><span class="crit-text">ANOMALIE : native VLAN = Blackhole sur port actif</span></td>
    </tr>
  </tbody>
</table>

<!-- ============================================================ -->
<!-- SECTION 7 : RECAPITULATIF DES EQUIPEMENTS                    -->
<!-- Agreger par type sur TOUS les switches.                      -->
<!-- ============================================================ -->
<h2>Recapitulatif des equipements identifies</h2>
<table>
  <thead>
    <tr>
      <th>Equipement</th><th>Type</th><th>Switch</th>
      <th>Port(s)</th><th>VLAN(s)</th><th>Confiance</th><th>Remarque</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Telephones IP PoE x [N]</td>
      <td><span class="badge badge-phone">Phone IP</span></td>
      <td>[SW]</td>
      <td>[liste ports]</td>
      <td>[VLANs]</td>
      <td class="conf">[%]</td>
      <td>[details]</td>
    </tr>
  </tbody>
</table>

<!-- ============================================================ -->
<!-- SECTION 8 : FOOTER                                           -->
<!-- ============================================================ -->
<br>
<p style="color:#888;font-size:11px;text-align:center;padding:16px">
  Rapport genere automatiquement par Claude Code — Skill network-switch-analysis — [JJ/MM/AAAA]<br>
  Sources : [lister les sources par switch]<br>
  Confiance maximale : [X]% ([raison])
</p>

</div>
</body>
</html>
```

---

## C. Regles visuelles

### Badges — mapping type equipement -> classe CSS

| Type equipement | Classe badge | Texte exemple |
|----------------|-------------|---------------|
| Phone IP | `badge-phone` | Phone IP (PoE) |
| AP WiFi | `badge-ap` | AP WiFi (PoE) |
| Serveur / Hyperviseur | `badge-server` | Serveur / Hyperviseur |
| Trunk inter-switch | `badge-trunk` | Inter-switch -> SW2.gi27 |
| Uplink (firewall, routeur) | `badge-uplink` | Uplink Firewall (SFP+) |
| VM Hyper-V | `badge-vm` | VM Hyper-V |
| NAS | `badge-nas` | NAS Synology |
| Imprimante | `badge-print` | Imprimante Konica-Minolta |
| PC / Endpoint generique | `badge-server` | PC / Endpoint |
| Port libre (DOWN) | `badge-down` | DOWN |
| Port UP normal | `badge-up` | UP |
| Port anomalie | `badge-crit` | UP (avec texte crit-text) |
| Port warning | `badge-warn` | UP (avec texte warn-text) |

### Barres PoE

```html
<div class="poe-bar" style="width:[W*10]px"></div>[W]W
```

- Formule : `width = watts * 10` pixels
- Exemples : 3.4W -> `width:34px`, 4.8W -> `width:48px`
- Si PoE anomalie (ex: sur lien inter-switch) : ajouter `style="background:#e05a2b"` + `<span class="warn-text">...</span>`
- Si pas de PoE : afficher `Non` ou `—`

### Groupement des ports inactifs

- **3+ ports DOWN consecutifs** : regrouper en "Port X-Y" dans un seul `<tr class="port-inactive">`
- **1-2 ports DOWN isoles** : les lister individuellement en `<tr class="port-inactive">`
- **Port DOWN avec config particuliere** (ex: PVID=666, trunk pre-configure) : lister individuellement avec remarque

### Confiance

- `<td class="conf">65%</td>` pour les pourcentages
- `<td class="conf">LLDP 95%</td>` pour les sources confirmees (mentionner la source)
- `—` pour les ports libres

### Switch cards — variante vendor

| Vendor | Classe CSS |
|--------|-----------|
| Aruba (Instant On, AOS-CX) | `switch-card` (defaut, bleu) |
| Cisco (IOS, SB) | `switch-card cisco` (cyan) |
| HP (ProCurve, OfficeConnect) | `switch-card hp` (bleu HP) |
| Fortinet | `switch-card fortinet` (rouge) |

### Topologie ASCII — regles

1. Utiliser des box-drawing chars pour encadrer chaque switch : `+---+` ou `|` ou `---`
2. Montrer chaque lien avec : port source <-> port destination, vitesse, type (trunk/access)
3. Signaler les anomalies inline entre crochets : `[ANOMALIE]`, `[OBSOLETE]`
4. Pour les VMs Hyper-V : lister sous le switch physique avec VLANs
5. Pour le firewall/routeur : placer en haut de la topologie
6. Indiquer les LAG/Port-Channel avec les ports membres
