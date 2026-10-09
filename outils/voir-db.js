// Affiche le contenu de la base : npm run voir-db
// Regarde la colonne "hash" : même en lisant la base, on ne connaît pas les
// mots de passe.
const db = require('../db');

console.log('\nUtilisateurs');
console.table(
  db.prepare('SELECT id, email, role, hash FROM users').all().map((u) => ({
    ...u,
    hash: `${u.hash.slice(0, 40)}…`,
  }))
);

console.log('\nCommandes');
console.table(db.prepare('SELECT id, user_id, total_centimes, cree_le FROM commandes').all());

console.log('\nMessages');
console.table(db.prepare('SELECT id, nom, email, message FROM messages').all());
