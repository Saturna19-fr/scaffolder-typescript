# TS + oxlint Scaffolder

Une page HTML autonome pour composer un `tsconfig.json` et un `.oxlintrc.json`, option par
option, avec la documentation en face — puis copier-coller le résultat.

**Ouvre simplement [`index.html`](index.html) dans un navigateur.** Aucun serveur, aucun build,
aucune requête réseau : tout (y compris les 871 règles et leur documentation) est embarqué dans
le fichier, et l'état est conservé dans le `localStorage` du navigateur.

## Ce qu'il y a dedans

| | |
|---|---|
| **119** options du compilateur TypeScript | toutes celles acceptées dans `compilerOptions`, par catégorie, avec type, valeur par défaut et description longue |
| **7** `watchOptions` + `typeAcquisition` + champs racine | `include`, `exclude`, `files`, `extends`, `references`, `compileOnSave` |
| **871** règles oxlint | toutes les règles enregistrées, avec « ce que fait la règle », « pourquoi c'est un problème », catégorie, auto-fix, type-aware, version d'apparition |
| **706** options de règles | 643 propriétés nommées + 63 options positionnelles, avec leur type, leur défaut et leur doc |
| **11** champs de config oxlint | `plugins`, `categories`, `env` (43 environnements), `globals`, `options`, `settings` (6 plugins), `ignorePatterns`, `extends`, `overrides`, `rules`, `jsPlugins` |

Les deux versions de TypeScript sont couvertes : **7.0.2** et **5.9.3**. Un sélecteur filtre les
options et affiche les valeurs par défaut de la version choisie ; les options supprimées dans
TS 7 sont marquées `TS 5 uniquement`, les nouvelles `TS 7 uniquement`.

## Fonctionnalités

- **Préréglages** : 6 pour TypeScript (app bundler, Node ESM, librairie, monorepo, rigueur
  maximale, minimal) et 7 pour oxlint (recommandé, TS strict, React/Next, Vue, Node, tests, tout).
- **Recherche** (`/`) sur les noms, les descriptions et les options, dans les deux onglets.
- **Filtres de règles** : plugin, catégorie, auto-fixable, type-aware, activée par défaut,
  déjà réglée, configurable — plus une application en masse sur le résultat filtré.
- **Sortie commentée** en option : `tsconfig.json` et `.oxlintrc.json` acceptent les commentaires,
  donc chaque ligne peut porter sa description.
- **Avertissements de cohérence** : plugin manquant pour une règle réglée, règle type-aware sans
  `options.typeAware`, `isolatedDeclarations` sans `declaration`, option dépréciée, etc. — avec
  un bouton de correction quand c'est automatisable.
- **4 sorties** : `tsconfig.json`, `.oxlintrc.json`, `package.json` et les commandes
  d'installation pour npm / pnpm / yarn / bun.
- Thème clair / sombre, utilisable au clavier, et lisible sur téléphone.

## Déploiement

La page est publiée sur GitHub Pages par `.github/workflows/pages.yml` à chaque push sur la
branche par défaut : le workflow reconstruit `index.html` depuis `src/` et `data/`, échoue si le
fichier commité est périmé, puis publie la page seule.

**Une activation manuelle est nécessaire une fois**, car le `GITHUB_TOKEN` d'Actions n'a pas le
droit de créer un site Pages : dans **Settings → Pages**, mettre **Source** sur
**GitHub Actions**. Le workflow suivant publiera sur
<https://saturna19-fr.github.io/scaffolder-typescript/>.

## Vérification

Les configurations produites sont testées contre les vrais outils, pas seulement relues :

- les **119** options écrites ensemble dans un `tsconfig.json` passent `tsc --noEmit` sans une
  seule erreur `TS5023 Unknown compiler option` ;
- un `.oxlintrc.json` contenant les **871** règles en `error` avec **toutes** leurs options
  documentées renseignées passe `oxlint --print-config` (sortie 0) et charge bien 871 règles ;
- chaque préréglage est généré puis exécuté sur un fichier réel.

## Régénérer les données

Les fichiers de `data/` ne sont pas écrits à la main — ils sont extraits des outils eux-mêmes :

```bash
./scripts/refresh-data.sh            # dernières versions
TS7=7.1.0 OX=1.90.0 ./scripts/refresh-data.sh
```

Le script installe `typescript` (7.x et 5.x) et `oxlint`, lit `tsc --help --all`,
`ts.optionDeclarations`, `oxlint --rules -f json`, le schéma JSON tsconfig de SchemaStore et le
schéma de configuration d'oxlint, clone la documentation oxlint pour en extraire les descriptions
de règles, puis reconstruit `index.html`.

## Structure

```
index.html                        la page, autonome (~1 Mo) — c'est le livrable
src/template.html                 structure + CSS
src/app.js                        logique de l'application
src/build.py                      injecte les données et le JS dans le template
data/ts-data.json                 options TypeScript, watchOptions, champs racine
data/ox-rules.json                les 871 règles oxlint et leurs options
data/ox-config.json               schéma de configuration oxlint
scripts/extract-*.py              extracteurs (sortie des outils -> data/)
scripts/refresh-data.sh           pipeline complet
```

Après modification de `src/`, lancer `python3 src/build.py` pour régénérer `index.html`.
