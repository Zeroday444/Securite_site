// Base de données SQLite : un simple fichier, rangé dans data/ et donc HORS du
// dossier public/. Si elle était dans public/, n'importe qui pourrait la
// télécharger en tapant son adresse dans le navigateur.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { hacherMotDePasse } = require('./outils');

const dossier = path.join(__dirname, 'data');
fs.mkdirSync(dossier, { recursive: true });
const db = new DatabaseSync(path.join(dossier, 'boulangerie.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client'
  );
  CREATE TABLE IF NOT EXISTS produits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    -- Prix en centimes (entier) : les nombres à virgule font des erreurs
    -- d'arrondi (0.1 + 0.2 = 0.30000000000000004).
    prix_centimes INTEGER NOT NULL,
    image TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS commandes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    detail TEXT NOT NULL,
    total_centimes INTEGER NOT NULL,
    cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Données de départ, créées une seule fois. Ce sont des comptes de TEST pour
// le développement en local : à supprimer avant toute mise en ligne.
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
  const ajouterUser = db.prepare('INSERT INTO users (email, hash, role) VALUES (?, ?, ?)');
  for (const [email, motDePasse, role] of [
    ['admin@boulangerie.test', 'fournil-test-2024', 'admin'],
    ['alice@exemple.test', 'croissant-test-2024', 'client'],
    ['bob@exemple.test', 'baguette-test-2024', 'client'],
  ]) {
    ajouterUser.run(email, hacherMotDePasse(motDePasse), role);
  }

  const ajouterProduit = db.prepare(
    'INSERT INTO produits (nom, prix_centimes, image) VALUES (?, ?, ?)'
  );
  for (const [nom, prix, image] of [
    ['Baguette tradition', 130, 'baguettes.jpg'],
    ['Pain aux céréales', 420, 'pains-cereales.jpg'],
    ['Croissant pur beurre', 140, 'croissants.jpg'],
    ['Tarte au citron', 2400, 'tarte-citron.jpg'],
    ['Boîte de 6 macarons', 1200, 'macarons.jpg'],
    ['Cookie chocolat', 250, 'cookies.jpg'],
  ]) {
    ajouterProduit.run(nom, prix, image);
  }

  const ajouterCommande = db.prepare(
    'INSERT INTO commandes (user_id, detail, total_centimes) VALUES (?, ?, ?)'
  );
  ajouterCommande.run(
    2,
    JSON.stringify([
      { nom: 'Baguette tradition', quantite: 2, prix_centimes: 130 },
      { nom: 'Tarte au citron', quantite: 1, prix_centimes: 2400 },
    ]),
    2660
  );
  ajouterCommande.run(
    3,
    JSON.stringify([{ nom: 'Croissant pur beurre', quantite: 4, prix_centimes: 140 }]),
    560
  );

  db.prepare('INSERT INTO messages (nom, email, message) VALUES (?, ?, ?)').run(
    'Camille',
    'camille@exemple.test',
    'Bonjour, faites-vous des gâteaux d’anniversaire sur commande ?'
  );
}

module.exports = db;
