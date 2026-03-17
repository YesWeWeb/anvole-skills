# Prerequis — Securite du debug FortiGate

> Applicable : FortiOS 6.4 / 7.0 / 7.2 / 7.4 / 7.6

```
diagnose debug enable              # Activer le mode debug (OBLIGATOIRE avant tout debug live)
diagnose debug duration 30         # Limiter a 30 secondes (TOUJOURS fixer une duree)
diagnose debug console timestamp enable  # Horodater les messages debug
diagnose debug info                # Verifier quels debugs sont actifs
diagnose debug disable             # DESACTIVER apres usage
diagnose debug reset               # Tout arreter (debug + filtres)
```

**Regles de securite :**
- TOUJOURS fixer `diagnose debug duration` AVANT `diagnose debug enable`
- Les commandes live debug (marquees `[LIVE]`) ne doivent JAMAIS etre automatisees dans un script
- `diagnose sniffer packet` et `diagnose debug flow` consomment beaucoup de CPU
- VDOM : si multi-VDOM, prefixer avec `config vdom` puis `edit <vdom-name>`
- Certaines commandes `diagnose` necessitent le profil `super_admin`
