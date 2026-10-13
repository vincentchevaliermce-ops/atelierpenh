# Activer l'éditeur pour un nouveau client (offre B)

**Objectif :** un client sans abonnement modifie son site seul depuis son téléphone, sur `sonsite.com/admin`.
**Coût :** 0 $. GitHub Pages et GitHub Actions sont gratuits pour les dépôts publics, et le Worker Cloudflare tourne sur l'offre gratuite (100 000 requêtes par jour).

## Comment ça marche (30 secondes)

```
Téléphone du client ──► sonsite.com/admin  (page statique, sur GitHub Pages)
                              │  mot de passe + modifications
                              ▼
                    Worker Cloudflare "atelierpenh-editor"   (un seul pour TOUS les clients)
                              │  vérifie le mot de passe, valide le contenu,
                              │  fait 1 commit sur content/site.json (+ photos)
                              ▼
                    Dépôt GitHub du client ──► GitHub Actions reconstruit le site (1 à 2 min)
```

- Le **design** est dans `render.js` et `assets/style.css`. Le client n'y a jamais accès.
- Le **contenu** est dans `content/site.json`, et c'est le seul fichier que l'éditeur peut modifier (plus les photos dans `img/uploads/`).
- Le **formulaire** est généré à partir de `content/schema.json`, qui fixe les champs, les longueurs maximales et les types.
- **L'interrupteur** est `site.config.json` → `"editor": { "enabled": true | false }`.

---

## A. Installation unique (une seule fois, environ 30 min)

À faire une seule fois. Les nouveaux clients prennent ensuite moins de 10 minutes.

1. **Compte GitHub pour les sites clients.** Ton compte actuel convient, mais une organisation gratuite (ex. `atelierpenh-sites`) est plus propre.
2. **Dépôt modèle.**
   - Crée un dépôt **public** `site-template` et copie-y le **contenu** du dossier `client-template/` de ce dépôt, y compris `.github/` et `.gitignore`.
   - Dans *Settings*, coche **Template repository**.
3. **Jeton GitHub pour le Worker.**
   - Va dans GitHub → *Settings* → *Developer settings* → *Fine-grained tokens* → *Generate new token*.
   - *Repository access* : **Only select repositories** (tu ajouteras chaque client ensuite). Si tu utilises une organisation dédiée aux sites clients, tu peux prendre *All repositories* de cette organisation.
   - *Permissions* : **Contents → Read and write**, rien d'autre.
   - Expiration : 1 an. Note la date dans ton agenda.
4. **Worker Cloudflare** (compte gratuit sur dash.cloudflare.com).
   - Va dans *Workers & Pages* → *Create* → *Create Worker*, nomme-le `atelierpenh-editor`, puis *Deploy*.
   - Clique *Edit code*, remplace tout le code par le contenu de `editor-worker/worker.js`, puis *Deploy*.
   - Dans *Settings* → *Variables and Secrets*, ajoute :
     - `GITHUB_TOKEN` (type **Secret**) : le jeton de l'étape 3.
     - `SESSION_SECRET` (type **Secret**) : une longue chaîne aléatoire d'au moins 32 caractères, à générer dans un gestionnaire de mots de passe.
     - `CLIENTS` (type **Text**) : `{}` pour l'instant.
   - Recommandé, contre les essais de mots de passe en rafale :
     - Va dans *Storage & Databases* → *KV* → *Create* `editor-logins`.
     - Dans le Worker, ouvre *Settings* → *Bindings* → *Add* → *KV namespace*, avec le nom de variable **`LOGIN_KV`**.
   - Note l'URL du Worker, du type `https://atelierpenh-editor.TONCOMPTE.workers.dev`.

> Gère `CLIENTS` **soit** dans le tableau de bord Cloudflare, **soit** dans `editor-worker/wrangler.toml` (avec `npx wrangler deploy`), mais pas les deux : un déploiement wrangler écrase les variables du tableau de bord.

---

## B. Nouveau client, en moins de 10 minutes

Exemple : client `chez-sophea`, domaine `chezsophea.com`.

1. **Créer le dépôt (1 min).**
   - Sur `site-template`, clique **Use this template** → *Create a new repository*.
   - Nom : `chez-sophea`, dépôt **Public**.
2. **Régler `site.config.json` (2 min)** directement sur GitHub, avec l'icône crayon :
   ```json
   "clientId": "chez-sophea",
   "siteUrl": "https://chezsophea.com/",
   "domain": "chezsophea.com",
   "language": "en",
   "businessType": "Restaurant",
   "theme": { "accent": "#A8481F", "background": "#FBF7F2", "text": "#1F1A17", "muted": "#5E544D" },
   "editor": { "enabled": true, "apiUrl": "https://atelierpenh-editor.TONCOMPTE.workers.dev" }
   ```
   - `businessType` : `Restaurant`, `BarOrPub`, `CafeOrCoffeeShop`, `DaySpa`, `HairSalon`, `BeautySalon`, `NailSalon` ou `LocalBusiness`.
   - `language` : `en` ou `fr`. C'est la langue du site public. L'éditeur, lui, a toujours le bouton EN/FR.
   - Contraste : garde la couleur `accent` assez foncée pour que le texte blanc reste lisible (ratio de 4,5:1 minimum).
3. **Contenu de départ (2 min).** Remplis `content/site.json` (nom, carte, horaires…) et remplace les photos de `img/`, ou laisse le client le faire lui-même avec l'éditeur.
4. **Activer GitHub Pages (1 min).**
   - Dans le dépôt, ouvre *Settings* → *Pages* → *Source* : **GitHub Actions**.
   - Ouvre l'onglet *Actions* et vérifie que « Deploy site » est vert.
   - *Custom domain* : `chezsophea.com`, puis coche **Enforce HTTPS** quand GitHub le propose.
5. **Donner l'accès au Worker (2 min).**
   - Ajoute le dépôt `chez-sophea` au jeton GitHub (*Edit* → *Repository access*), sauf si le jeton couvre déjà toute l'organisation.
   - Dans Cloudflare → Worker → *Settings* → *Variables*, ajoute le client dans `CLIENTS` :
     ```json
     {
       "chez-sophea": {
         "repo": "atelierpenh-sites/chez-sophea",
         "branch": "main",
         "origins": ["https://chezsophea.com", "https://www.chezsophea.com"]
       }
     }
     ```
     Pour tester avant que le domaine soit branché, ajoute aussi `"https://atelierpenh-sites.github.io"` dans `origins`.
   - Ajoute le secret **`PASSWORD_CHEZ_SOPHEA`** : le mot de passe du client. C'est le nom du client en majuscules, avec les `-` remplacés par des `_`.
     - Choisis un mot de passe de 4 mots faciles à taper, par exemple `mango-river-blue-42`.
6. **Tester (2 min).**
   - Ouvre `https://chezsophea.com/admin` sur ton téléphone et connecte-toi.
   - Change l'horaire du lundi, regarde l'aperçu, puis publie.
   - Vérifie que le site est à jour 1 à 2 minutes plus tard.
   - Remets l'horaire d'origine.
7. **Envoyer au client** par WhatsApp : le lien `/admin`, le mot de passe et le fichier `GUIDE-CLIENT.md` (en PDF ou en captures).

### Désactiver l'éditeur (le client passe en abonnement, offre A)

- Mets `"editor": { "enabled": false }` dans `site.config.json`, puis fais un commit. La page `/admin` disparaît au déploiement suivant et le Worker refuse aussitôt toute connexion.
- Facultatif : retire le client de `CLIENTS` et supprime son secret `PASSWORD_…`.

### Client en abonnement (offre A)

- Même modèle, avec `"enabled": false`.
- Pour faire une modification, édite `content/site.json` sur GitHub (ça marche depuis ton téléphone) et fais un commit : le site se reconstruit tout seul.
- Tu peux aussi activer l'éditeur juste pour toi le temps d'une grosse mise à jour.

### Changer un mot de passe

Remplace le secret `PASSWORD_…` dans Cloudflare. Les sessions déjà ouvertes restent valides jusqu'à 30 jours. Pour couper tout le monde immédiatement, change `SESSION_SECRET` : tous les clients devront se reconnecter.

---

## Maintenance

- **Modifier le design d'un client** : édite `assets/style.css` ou `render.js` dans son dépôt. Le contenu n'est pas touché.
- **Ajouter un champ** (ex. « Happy hour ») :
  1. Ajoute-le dans `content/schema.json` (le formulaire apparaît tout seul).
  2. Affiche-le dans `render.js`.
  3. Ajoute la valeur dans `content/site.json`.
- **Tester en local** : `node build.js` crée `_site/`, puis `npx serve _site` ou `python3 -m http.server -d _site`. Si `apiUrl` est vide, `/admin` passe en **mode démo** : tout marche sauf Publier.
- **La validation** existe en double : `client-template/validate.js` et sa copie dans `editor-worker/worker.js`. Après toute modification, lance `node editor-worker/sync-validate.mjs`, puis recolle le code dans Cloudflare.
- **Un contenu invalide** ne casse jamais le site : `build.js` échoue et l'ancienne version reste en ligne.
