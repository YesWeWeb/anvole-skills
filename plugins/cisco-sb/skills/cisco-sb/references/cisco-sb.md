# Référence Cisco Small Business (SG300, SG500, CBS)

Guide pour les switches Cisco Small Business (gamme SG/SF/CBS).
**Firmware propriétaire — pas Cisco IOS.** Syntaxe CLI différente mais similaire.

---

## Identification

**Modèles concernés :**
- SG300-xx / SG500-xx (ancienne génération, fin de vie annoncée)
- SG350-xx / SG550-xx (génération actuelle)
- SF300-xx / SF500-xx (Fast Ethernet)
- CBS220-xx / CBS250-xx / CBS350-xx (gamme actuelle depuis 2020)

**Firmware :**
- SMB firmware (ex: `1.4.x`, `2.5.x`, `3.x`) — pas Cisco IOS
- Accès CLI via SSH ou Telnet (activer dans l'interface web)
- Interface web sur `http://<IP>/` ou `https://<IP>/`

**Détection du vendor :**
- Prompt CLI : `sw-name#` ou `Switch#` (sans `>` du mode utilisateur IOS)
- `show version` retourne `Cisco Small Business` ou `CBS` ou `SG`
- `show system` : présent sur SB firmware (absent sur IOS)

---

## Commandes CLI

### Identification du switch

```
show version
show system
show ip interface
```

**Format `show version` typique :**
```
Active-image: flash://system/images/SG300_FW.ros
 Version: 1.4.8.06
 MD5 Digest: ...
Cisco Small Business SG300-52 - 52-Port Gigabit Managed Switch
Hardware Version: R01
```

### Table MAC

```
show mac address-table
```

**Format :**
```
Vlan    Mac Address       Type       Ports
----    ---------------   --------   -----
   1    00:1a:2b:3c:4d:5e Dynamic    gi1
  10    aa:bb:cc:dd:ee:ff Dynamic    gi5
  20    11:22:33:44:55:66 Static     gi24
```

**Différence IOS :** format MAC en `xx:xx:xx:xx:xx:xx` (séparateur `:`) — pas le format `xxxx.xxxx.xxxx` de Cisco IOS.

### Interfaces

```
show interfaces status
show interfaces gigabitethernet <N> status
```

**Format :**
```
                                          Flow Link          Back   Mdix
           Type         Duplex  Speed     Neg  State       Pressure Mode
--------- ------------ ------  --------- ---- ----------- -------- -------
gi1       1G-Copper    Full    100M      Enabled  Up          Disabled Off
gi2       1G-Copper    Full    1000M     Enabled  Up          Disabled Off
gi3       1G-Copper               Auto  Enabled  Down        Disabled Off
```

**Nommage des ports :**
- `gi<N>` = GigabitEthernet port N (ex: `gi1`, `gi24`, `gi48`)
- `te<N>` = 10GigabitEthernet (sur modèles SG550X/CBS350)
- `po<N>` = Port-channel (LAG)

### Configuration des ports

```
show running-config interface gi<N>
```

**⚠️ Firmware 1.4.x :** `show interfaces gi<N> switchport` retourne "Unrecognized command".
Utiliser `show running-config interface gi<N>` à la place.

**Format `show running-config interface gi<N>` :**
```
interface gigabitethernet44
 switchport trunk allowed vlan add 100
!
```

**Format avec LACP :**
```
interface gigabitethernet15
 channel-group 2 mode auto
!
```

**Sur firmware >= 2.x **, `show interfaces gi<N> switchport` est disponible et retourne :
```
Information of gi5
  VLAN Membership Mode: Hybrid
  Access Mode VLAN: 1(default)
  Trunk Native Mode VLAN: 1 (default)
  VLAN Trunk Allowed Vlan: 1-4094
  Voice VLAN : none
```

**Champs importants :**
- `VLAN Membership Mode` : `Access` / `Trunk` / `Hybrid` (hybrid = mode par défaut)
- `Access Mode VLAN` : VLAN d'accès (si mode Access)
- `Trunk Native Mode VLAN` : VLAN natif trunk
- `Voice VLAN` : VLAN voix configuré (ou `none`)

### VLAN

```
show vlan
show vlan tag <vlan-id>
```

**Format `show vlan` :**
```
VLAN  Name               Status    Ports
----  -----------------  --------  ----------------------------------------
1     Default            active    gi1-gi52, Po1-Po8
10    DATA               active    gi1-gi12
20    VOIX               active    gi1-gi12, gi24(T)
100   MANAGEMENT         active    gi24(T)
```

**(T) = port taggé (trunk), sinon non-taggé (access)**

### LLDP

```
show lldp neighbors
show lldp neighbors gi<N>
```

**⚠️ Firmware 1.4.x :**
- `show lldp neighbors detail` → "Wrong number of parameters" (n'existe pas)
- `show lldp neighbors interface gigabitethernet <N>` → "Wrong number of parameters"
- Syntaxe correcte pour le détail par port : `show lldp neighbors gi<N>`

**Format `show lldp neighbors` (liste globale) :**
```
  Port      Device ID          Port ID            System Name      Capabilities   TTL
--------- ------------------ ------------------ ---------------- -------------- -----
gi27      88:25:10:93:b4:66  39                 SW-CORE          B              117
gi44      88:25:10:93:b4:66  88:25:10:93:b4:86  SW-CORE          B              113
```

**Capabilities (Cisco SB) :**
- `B` = Bridge (switch)
- `R` = Router
- `T` = Telephone
- `W` = WLAN Access Point
- `D` = DOCSIS Cable Device
- `H` = Host / Station

**Format `show lldp neighbors gi<N>` (détail par port) :**
```
Device ID: 88:25:10:93:b4:66
Port ID: 39
Capabilities: Bridge
System Name: SW-ARUBA
System description: Aruba Instant On 1930 48G ... JL686B
Port description: 39
Management Address: 10.10.90.201

LLDP-MED Network policy
Application type: Voice
VLAN ID: 100
```

### CDP (si activé)

```
show cdp neighbors
show cdp neighbors detail
```

Le CDP est désactivé par défaut sur Cisco Small Business. Si actif, format similaire à Cisco IOS.

---

## Différences clés vs Cisco IOS

| Aspect | Cisco IOS (Catalyst) | Cisco Small Business |
|--------|---------------------|---------------------|
| Format MAC | `aabb.ccdd.eeff` | `aa:bb:cc:dd:ee:ff` |
| Mode port | `switchport mode access` | `VLAN Membership Mode: Access` |
| Voice VLAN | `switchport voice vlan X` | `Voice VLAN: X` (dans show switchport) |
| Port naming | `GigabitEthernet0/X` | `gi<N>` |
| VLAN trunk | `switchport trunk allowed vlan` | `VLAN Trunk Allowed Vlan:` |
| Version cmd | `show version` (IOS) | `show version` (SMB firmware différent) |
| CDP | Activé par défaut | Désactivé par défaut |
| LLDP | Optionnel (IOS 12.2+) | Activé par défaut |

---

## Heuristiques d'identification

**Détection du vendor dans l'output :**
- `Cisco Small Business` dans `show version` → SG/SF/CBS
- `SG300`, `SG500`, `SG350`, `CBS` dans le hostname ou `show version`
- Format MAC `xx:xx:xx:xx:xx:xx` (avec `:`) dans `show mac address-table` → probable SB
- `VLAN Membership Mode:` dans `show interfaces ... switchport` → certitude SB

**Voice VLAN :**
- Chercher `Voice VLAN :` (avec espace avant `:`) dans `show interfaces switchport`
- Si `Voice VLAN : none` → pas de VLAN voix configuré
- Si `Voice VLAN : 20` → VLAN voix 20

---

## Accès CLI

**Via SSH (recommandé) :**
```
ssh admin@<IP>
# ou
ssh -oHostKeyAlgorithms=+ssh-rsa admin@<IP>  # pour firmware anciens
```

**Via Telnet (si SSH non disponible) :**
```
telnet <IP>
```

**Activation CLI dans l'interface web :**
Administration → Management Interface → SSH/Telnet → Enable

**Identifiants par défaut :**
- Username : `cisco` ou `admin`
- Password : `cisco` ou vide (selon modèle et firmware)
- Voir étiquette sous le switch

---

## Collecte automatisée via SSH Node.js

Sur Windows, `python3` peut être indisponible (redirige vers Windows Store). Utiliser **Node.js** avec le module `ssh2`.

### Double authentification (comportement spécifique SG300/SG500)

Le firmware Cisco SB demande une **double authentification** :
1. **SSH level** : username + password lors de la connexion SSH (géré par ssh2)
2. **Shell level** : une fois connecté, le shell affiche `User Name:` puis `Password:` avant de donner le prompt `#`

**Sans gérer cette étape, toutes les commandes envoyées seront interprétées comme des saisies dans le
formulaire de login → authentification échoue → le switch coupe la connexion.**

Le script doit détecter les chaînes `User Name:` et `Password:` dans le flux de données et y répondre
avant d'envoyer les commandes.

### Prérequis

```bash
# Vérifier disponibilité
node --version   # doit retourner une version
npm --version

# Installer ssh2 (si pas déjà présent)
npm install ssh2
```

### Gestion du pager

Les switches Cisco SB ont un pager actif par défaut : l'output s'interrompt avec `More:` tous les 24 lignes.

**Comportement confirmé sur firmware 1.4.x (SG300) :**
- `terminal length 0` → `% Unrecognized command` (non supporté sur 1.4.x)
- `terminal datadump` → non confirmé sur 1.4.x

**Solution : le script v2 gère le pager automatiquement** — il détecte `More:` dans le flux et envoie un espace pour avancer, sans dépendre de `terminal length 0`.

Le script envoie quand même `terminal length 0` en premier (au cas où le firmware le supporte), puis gère le pager quelle que soit la réponse.

### Script Node.js minimal

```javascript
const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const IP = process.argv[2] || '192.168.1.1';
const PASSWORD = process.argv[3] || 'cisco';

const COMMANDS = [
  'terminal datadump',
  'show version',
  'show system',
  'show ip interface',
  'show interfaces status',
  'show vlan',
  'show mac address-table',
  'show lldp neighbors detail',
];

conn.on('ready', () => {
  conn.shell((err, stream) => {
    if (err) throw err;

    let output = '';
    stream.on('data', (data) => { output += data.toString(); });
    stream.stderr.on('data', (data) => { output += data.toString(); });

    stream.on('close', () => {
      fs.writeFileSync('switch_output.txt', output);
      console.log('Collecte terminée → switch_output.txt');
      conn.end();
    });

    // Envoyer toutes les commandes avec délai
    let i = 0;
    const sendNext = () => {
      if (i < COMMANDS.length) {
        stream.write(COMMANDS[i++] + '\n');
        setTimeout(sendNext, 1500);
      } else {
        setTimeout(() => stream.write('exit\n'), 2000);
      }
    };

    // Attendre le prompt initial
    setTimeout(sendNext, 2000);
  });
}).connect({
  host: IP,
  port: 22,
  username: 'cisco',
  password: PASSWORD,
  algorithms: {
    // Nécessaire pour les firmware anciens (< 2016)
    serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256'],
    kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1',
          'ecdh-sha2-nistp256'],
  },
  readyTimeout: 15000,
});

conn.on('error', (err) => console.error('SSH error:', err.message));
```

**Usage :**
```bash
node collect_cisco.js 10.10.90.202 mypassword
```

### Points d'attention

- **Firmware 1.4.x (2016)** : utiliser les algorithmes SSH anciens (voir `algorithms` dans le script)
- **Prompt variable** : le script utilise des délais fixes (1.5s par commande). Augmenter si le switch est lent.
- **Timeout** : augmenter `readyTimeout` sur les réseaux lents
- **Authentification** : username `cisco` par défaut, sinon `admin`. Voir étiquette sous le switch.

---

## Limitations connues

**Firmware très ancien (< 1.3) :**
- `show lldp neighbors detail` peut être absent
- `show interfaces switchport` peut avoir un format différent
- Préférer l'interface web pour ces cas

**Firmware 2016 et avant :**
- CVE critiques non corrigés (fin de support annoncée)
- Signaler dans le rapport comme risque de sécurité

**Interface web :**
- Accessible sur `http://<IP>/`
- Menu : Ports → Port Settings (statut), VLANs → VLAN Membership, LLDP → Neighbors
- Peut être utilisé en complément si CLI incomplet
