# FortiGate — Référence Technique

## Identification

| Champ | Source | Exemple |
|-------|--------|---------|
| Hostname | `get system status` → `Hostname:` | CBTP-FGT60F-972-MQ-10 |
| Modèle | `get system status` → `Version:` | FortiGate-60F |
| Firmware | `get system status` → `Version:` | v7.4.11,build2878 |
| Serial | `get system status` → `Serial-Number:` | FGT60FTK2209GTZR |
| HA mode | `get system status` → `Current HA mode:` | standalone |
| VDOM | `get system status` → `Current virtual domain:` | root |
| Uptime | `get system performance status` → `Uptime:` | 9 days, 22 hours |

## Authentification SSH

- **Méthode** : `keyboard-interactive` (le FortiGate ne supporte pas `password` auth directement avec certains clients)
- **Port** : souvent non-standard (ex: 48022) — toujours demander à l'utilisateur
- **Module Node.js** : `ssh2` avec `tryKeyboard: true`
- **Pas de double authentification shell** (contrairement au Cisco SB)
- **Pas de pager** : FortiOS envoie la sortie complète en mode SSH shell

```javascript
conn.connect({
  host: IP,
  port: PORT,        // paramètre obligatoire — souvent != 22
  username: USERNAME,
  password: PASSWORD,
  tryKeyboard: true,  // OBLIGATOIRE pour FortiGate
  readyTimeout: 15000,
});

conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
  finish([PASSWORD]);
});
```

## Format CLI FortiOS

### Commandes `get` vs `show`

| Préfixe | Fonction | Format sortie |
|---------|----------|---------------|
| `get` | État courant / runtime | Texte clé-valeur (`key: value`) |
| `show` | Configuration running | Bloc `config ... edit ... set ... next ... end` |

### Format `show` (configuration)

```
config <section>
    edit "<name>"
        set <param1> <value1>
        set <param2> <value2>
        config <sub-section>
            edit <id>
                set <param> <value>
            next
        end
    next
    edit "<name2>"
        ...
    next
end
```

### Format `get` (état)

```
key1                : value1
key2                : value2
```

Ou texte structuré libre (tables ARP, routing, etc.)

## Sections collectées

### Système (`get system status`)
Informations d'identification : hostname, firmware, serial, HA mode, VDOM, mode opération (NAT/transparent).

### Performance (`get system performance status`)
CPU par core, mémoire (total/used/free), bande passante moyenne/max, sessions actives, uptime.

### Interfaces physiques (`get system interface physical`)
État up/down, IP, vitesse pour chaque port physique. Format :
```
==[<interface_name>]
    mode: static
    ip: <IP> <MASK>
    status: up|down
    speed: 1000Mbps (Duplex: full)
```

### Interfaces config (`show system interface`)
Configuration complète : VLAN (vlanid), alias, allowaccess, device-identification, secondary IP, rôle (wan/lan), interface parent.

Interfaces types :
- `physical` : ports physiques (wan1, wan2, internal1-5, dmz, a, b)
- `hard-switch` : switch interne (internal)
- `vap-switch` : WiFi (CRCP_PV, CRCP_PUB)
- `tunnel` : VPN (ssl.root, t_MQ-GF_IDOM, etc.)
- Sous-interface VLAN : `set interface "internal"` + `set vlanid <N>`

### Routage (`get router info routing-table all`)
Table de routage complète avec codes :
- `S*` = route statique par défaut
- `C` = connected
- `S` = static
- Routes via tunnels SD-WAN avec gateway tunnel

### Routes statiques (`show router static`)
Configuration des routes statiques : destination, gateway, device, distance, SD-WAN zone, blackhole.

### Firewall policies (`show firewall policy`)
Chaque policy contient :
- `name` : nom lisible
- `srcintf` / `dstintf` : zones source/destination
- `action` : accept (deny est implicite si absent)
- `srcaddr` / `dstaddr` : objets adresse
- `service` : services autorisés
- `schedule` : toujours "always" en général
- `logtraffic` : all / utm / disable
- `groups` / `users` : authentification
- `nat enable` : si NAT activé
- `comments` : notes

### Objets adresse (`show firewall address`)
Types : `ipmask` (sous-réseau), `fqdn`, `geography` (pays).

### Groupes d'adresses (`show firewall addrgrp`)
Regroupement d'objets adresse : `set member "obj1" "obj2"`.

### VIP / NAT destination (`show firewall vip`)
Port forwarding / DNAT : `extip`, `mappedip`, `extport`, `mappedport`, `extintf`.

### IP Pools (`show firewall ippool`)
SNAT pools : `startip`, `endip`.

### Services (`show firewall service custom`)
Définitions de services : port TCP/UDP, protocole, catégorie.

### Groupes de services (`show firewall service group`)
Regroupement de services.

### Zones (`show system zone`)
Zones de sécurité regroupant des interfaces :
```
config system zone
    edit "Z_INFRA_CORE"
        set description "Niveau 2 : Services Fondamentaux"
        set interface "VLAN10"
    next
end
```

### DHCP (`show system dhcp server`)
Serveurs DHCP par interface : range IP, gateway, DNS, lease-time, réservations MAC.

### DNS (`get system dns`)
Serveurs DNS configurés (primary, secondary).

### VPN IPSec Phase 1 (`show vpn ipsec phase1-interface`)
Tunnels IPSec : type (static/dynamic), interface, remote-gw, proposal (chiffrement), authusrgrp.

### VPN IPSec Phase 2 (`show vpn ipsec phase2-interface`)
Paramètres phase 2 : proposal, src/dst, PFS group.

### VPN tunnel summary (`get vpn ipsec tunnel summary`)
État runtime des tunnels : selectors up/total, compteurs rx/tx paquets.

### VPN SSL (`show vpn ssl settings`)
Configuration SSL VPN : certificat, pool IP tunnel, DNS, interfaces source, geo-restrictions, portails.

### Users (`show user local`)
Comptes locaux (pas les mots de passe en clair — chiffrés ENC).

### Groupes (`show user group`)
Groupes utilisateurs : type (firewall/fsso), membres.

### LDAP (`show user ldap`)
Configuration LDAP/AD : serveur, DN, type (regular/simple).

### HA (`get system ha status`)
Mode HA (standalone/active-passive/active-active), priorité, état sync.

### ARP (`get system arp`)
Table ARP : IP → MAC → interface. Format :
```
Address           Age(min)   Hardware Addr      Interface
10.10.90.201      0          d4:c9:ef:xx:xx:xx  VLAN90
```

### Sessions (`get system session-info statistics`)
Compteurs sessions : total, TCP/UDP/ICMP, expectation, clash.

### SD-WAN (`show system sdwan`)
Configuration SD-WAN : zones, membres (interfaces), health-checks, règles de routage.

### Logging (`show log setting`)
Paramètres de journalisation.

### SNMP (`show system snmp community`)
Communautés SNMP : nom, hosts autorisés, événements.

### NTP (`show system ntp`)
Configuration NTP : serveurs, sync status.

### Admin (`show system admin`)
Comptes administrateur : profil d'accès, VDOM.

### Profils de sécurité
- `show antivirus profile` : AV scan par protocole (HTTP, FTP, IMAP, etc.)
- `show webfilter profile` : filtrage web, catégories
- `show ips sensor` : signatures IPS, actions
- `show application list` : contrôle applicatif, catégories

### VDOM (`get system vdom-property`)
Propriétés des domaines virtuels.

## Parsing guidance — format `config` FortiOS

### Structure imbriquée

Les blocs `config` peuvent être imbriqués. Règles :
- `config <section>` ouvre un bloc
- `edit "<name>"` ou `edit <id>` ouvre une entrée dans le bloc
- `set <param> <value>` définit un paramètre
- `next` ferme l'entrée courante (retour au niveau `config`)
- `end` ferme le bloc `config` courant
- Les blocs peuvent s'imbriquer : `config` → `edit` → `config` (sous-section) → `edit` → `next` → `end` → `next` → `end`

```
config firewall policy        ← niveau 0
    edit 1                    ← entrée dans le bloc
        set name "RULE_1"
        config web-proxy      ← sous-bloc imbriqué (niveau 1)
            edit 1
                set url "..."
            next
        end                   ← ferme le sous-bloc
    next                      ← ferme l'entrée
    edit 2
        ...
    next
end                           ← ferme le bloc principal
```

### Valeurs multi-token

Certains champs acceptent plusieurs valeurs entre guillemets :
```
set member "obj1" "obj2" "obj3"
set srcintf "zone1" "zone2"
```
Chaque valeur est un token séparé, tous entre guillemets doubles.

### Escaping et guillemets

- Les valeurs contenant des espaces sont entourées de guillemets : `set name "Ma Règle"`
- Les guillemets dans les valeurs sont échappés : `set comment "Device \"test\""`
- Les valeurs numériques et mots-clés simples n'ont pas de guillemets : `set vlanid 90`, `set action accept`

### Champs absents = valeur par défaut

FortiOS n'affiche que les paramètres modifiés par rapport aux valeurs par défaut. Si un champ n'apparaît pas dans `show`, il a sa valeur par défaut FortiOS. Exemples :
- `action` absent → `deny` (par défaut)
- `logtraffic` absent → `utm` (par défaut)
- `nat` absent → désactivé
- `schedule` absent → `"always"`

### Adaptation par version FortiOS

| Version | Changement |
|---------|-----------|
| < 6.4 | SD-WAN s'appelle `virtual-wan-link` au lieu de `sdwan` |
| 7.0+ | `show system sdwan` inclut les health-checks |
| 7.4.x | `get system sdwan health-check` → `command parse error` |

## Particularités FortiGate-60F v7.4.x

- `get system sdwan health-check` → **KO** (`command parse error`). Utiliser `show system sdwan` qui inclut les health-checks dans la section config.
- Le prompt est `HOSTNAME # ` (avec espace après #)
- Les mots de passe dans la config sont chiffrés (`ENC <hash>`)
- Les PSK VPN sont aussi chiffrés (`ENC <hash>`)
