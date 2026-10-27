# Mon fioul

Application web mobile-first pour suivre le niveau de plusieurs cuves, les transvasements et les livraisons. Les données sont stockées dans SQLite, dans `server/fioul.db`.

## Démarrer en local

Prérequis : Node.js 20 ou plus récent.

```sh
npm install
npm run dev
```

Ouvrir ensuite l’adresse Vite affichée dans le terminal (par défaut `http://localhost:5173`). L’API SQLite tourne sur le port `3000`.

## Démarrer en production

```sh
npm install
npm run build
npm start
```

L’application et son API sont alors servies sur le port `3000`. Pour un VPS, placer un reverse proxy HTTPS devant le serveur et conserver `server/fioul.db` sur un volume persistant. Définir `PORT` pour choisir un autre port.

## Modèle de suivi

- Une cuve a un nom, une capacité et un niveau de départ.
- Un transvasement daté retire des litres d’une cuve et les ajoute à une autre.
- Une livraison datée ajoute les litres livrés à la cuve choisie.
- Le stock affiché est recalculé depuis le niveau de départ et les actions. Une action est refusée si elle dépasse le stock ou la capacité.
- La configuration initiale illustre trois cuves A, B et C, avec C pleine et A/B vides. Modifiez les niveaux et capacités dans « Gérer » pour refléter votre installation.

Le journal est conservé dans SQLite. Une cuve liée à une action ne peut pas être supprimée afin de garder l’historique cohérent.

## Prix d’achat et statistiques

Dans une livraison, saisissez le **prix total TTC en euros** correspondant au volume livré. Le prix au litre est calculé automatiquement. Les virgules et les points sont acceptés pour les centimes (ex. `650,25`). Les montants sont conservés en centimes entiers dans SQLite.

Le prix est facultatif : vous pouvez le compléter ou le corriger dans l’historique, sans modifier les volumes. Un champ vide signifie « prix non renseigné », tandis que `0` représente un achat gratuit.

La section Statistiques affiche, pour tout l’historique ou pour une année :

- les dépenses dont le prix est renseigné ;
- les litres achetés et le nombre de livraisons ;
- le prix moyen pondéré : somme des prix connus / somme des litres de ces mêmes livraisons ;
- un détail mensuel des volumes, dépenses et prix moyens.

Les livraisons sans prix restent incluses dans les volumes mais sont exclues du calcul des dépenses et du prix moyen. Les transvasements et les niveaux de départ sont exclus des achats. Ces statistiques ne mesurent pas la consommation réelle de la chaudière.

## Mettre à jour une installation existante

Arrêtez le serveur et sauvegardez `server/fioul.db`. Remplacez les fichiers du projet en conservant ce fichier de données, puis exécutez `npm install`, `npm run build` et `npm start`.

Au démarrage, la migration SQLite ajoute automatiquement le champ de prix si nécessaire. Les cuves et l’historique sont conservés ; les anciennes livraisons ont un prix non renseigné que vous pourrez compléter.

`DB_PATH` permet d’utiliser un autre emplacement pour la base SQLite. Les tests utilisent une base temporaire indépendante : `npm test`.

## Graphique des achats

Le graphique mensuel de la section Statistiques suit le filtre de période. Trois courbes sont disponibles via les boutons : prix moyen au litre, dépenses connues et litres achetés. Chaque indicateur utilise sa propre échelle et son unité.

Touchez ou survolez un point pour afficher sa valeur. Le sélecteur « Voir un mois » donne également accès aux valeurs au clavier ou sur téléphone. Le graphique peut défiler horizontalement sur petit écran ; le tableau mensuel reste disponible en dessous.

Les mois sans livraison affichent zéro pour les volumes et les dépenses. Les prix inconnus interrompent la ligne, sans estimation. Les dépenses des mois avec certains prix manquants sont signalées comme partielles. Le prix moyen reste pondéré par les litres dont le prix est connu.

## Interface application

Quatre écrans sont accessibles depuis la barre de navigation fixe :

- **Accueil** : réserve totale, jauges visuelles des cuves, actions rapides et dernière activité.
- **Ajouter** : formulaire de transvasement ou de livraison, avec prix d’achat.
- **Statistiques** : chiffres et courbes des achats, avec filtre par année.
- **Historique** : journal filtrable par livraisons ou transvasements et modification des prix.

Les réglages des cuves sont accessibles via l’icône en haut à droite. Sur téléphone, ils s’ouvrent dans un panneau en bas de l’écran. Le bouton Retour du navigateur permet de revenir à l’écran précédent. Après un enregistrement, l’accueil affiche le stock actualisé.

Cette interface reste une application web à ouvrir dans le navigateur. Elle nécessite une connexion à son serveur pour lire et enregistrer les données.

## Gestion des cuves revue

Les réglages affichent une liste de cuves avec niveau, capacité et position. « Modifier » ouvre une fiche dédiée ; les changements sont appliqués uniquement avec « Enregistrer ». « Annuler » abandonne le brouillon.

Pour une cuve sans historique, les raccourcis Vide / À moitié / Pleine facilitent la saisie du niveau de départ. Dès qu’une cuve possède des mouvements, son niveau de départ est verrouillé et une explication apparaît. Les autres cuves sans historique restent modifiables.

La suppression demande confirmation en rappelant le volume retiré du stock affiché. Une cuve avec historique ou la dernière cuve de l’installation ne peut pas être supprimée.
