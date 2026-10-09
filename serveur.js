// Serveur du site. Lancer avec : npm start  puis ouvrir http://localhost:3000
const express = require('express');
const path = require('node:path');
const routes = require('./routes');

const PORT = 3000;
const app = express();

// Taille maximale des données reçues : évite qu'on nous envoie des Mo de texte.
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

// En-têtes de sécurité envoyés avec chaque réponse.
app.use((req, res, next) => {
  // CSP : le navigateur n'exécute que les scripts et styles venant de notre
  // propre site. C'est un filet de sécurité : si du code arrivait quand même à
  // se glisser dans une page, le navigateur refuserait de l'exécuter.
  // Conséquence : pas de <script> ni de style="" écrits directement dans le HTML.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  // Le navigateur ne devine pas le type d'un fichier, il croit ce qu'on lui dit.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Les autres sites ne voient pas de quelle page du nôtre vient le visiteur.
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use(routes);

// Seul le dossier public/ est servi tel quel. serveur.js, db.js et data/
// restent inaccessibles depuis le navigateur.
app.use(express.static(path.join(__dirname, 'public')));

// Gestion des erreurs : le détail technique va dans la console du serveur,
// jamais au visiteur (il y apprendrait la base utilisée, les noms de tables,
// les chemins du disque...).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ erreur: 'Requête invalide.' });
  }
  console.error(err);
  res.status(500).json({ erreur: 'Une erreur est survenue.' });
});

// 127.0.0.1 : pendant le développement, le serveur n'écoute que sur cet ordinateur.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Boulangerie : http://localhost:${PORT}`);
});
