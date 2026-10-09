// Toutes les adresses du site qui lisent ou écrivent des données.
// Règle de base : tout ce qui arrive du navigateur (formulaire, cookie, adresse)
// peut avoir été modifié par le visiteur. Le serveur revérifie donc tout.
const crypto = require('node:crypto');
const express = require('express');
const db = require('./db');
const {
  lireCookies,
  hacherMotDePasse,
  verifierMotDePasse,
  echapperHtml,
  creerLimiteur,
} = require('./outils');

const routeur = express.Router();

// Renvoie toujours une chaîne : si on reçoit autre chose (objet, tableau...),
// on la remplace par une chaîne vide.
const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Protection CSRF ---------------------------------------------------------
// Un autre site pourrait faire envoyer un formulaire vers le nôtre par le
// navigateur d'un client connecté. Le navigateur indique d'où vient la requête
// dans l'en-tête Origin : on refuse toute écriture qui ne vient pas de chez nous.
routeur.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origine = req.get('origin');
  if (origine && new URL(origine).host !== req.get('host')) {
    return res.status(403).json({ erreur: 'Requête refusée.' });
  }
  next();
});

// --- Sessions ----------------------------------------------------------------
// Le cookie ne contient qu'un identifiant aléatoire, impossible à deviner.
// Qui est connecté est noté ICI, côté serveur : le visiteur ne peut pas
// modifier son cookie pour devenir quelqu'un d'autre.
const DUREE_SESSION_MS = 2 * 60 * 60 * 1000;
const sessions = new Map(); // identifiant -> { userId, expireLe }

function ouvrirSession(res, userId) {
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, { userId, expireLe: Date.now() + DUREE_SESSION_MS });
  res.setHeader('Set-Cookie', cookieSession(id, DUREE_SESSION_MS / 1000));
}

function cookieSession(valeur, dureeSecondes) {
  const options = [
    `sid=${valeur}`,
    'Path=/',
    `Max-Age=${dureeSecondes}`,
    'HttpOnly', // illisible depuis JavaScript : un script ne peut pas le voler
    'SameSite=Lax', // pas envoyé quand la requête est déclenchée par un autre site
  ];
  // Secure = envoyé uniquement en HTTPS. Activé en ligne, pas en local où le
  // site tourne en simple http://localhost.
  if (process.env.NODE_ENV === 'production') options.push('Secure');
  return options.join('; ');
}

function utilisateurConnecte(req) {
  const id = lireCookies(req).sid;
  const session = id && sessions.get(id);
  if (!session) return null;
  if (session.expireLe < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(session.userId) ?? null;
}

// À placer devant les routes réservées aux personnes connectées.
function exigerConnexion(req, res, next) {
  req.utilisateur = utilisateurConnecte(req);
  if (!req.utilisateur) return res.status(401).json({ erreur: 'Connectez-vous pour continuer.' });
  next();
}

// --- Comptes -----------------------------------------------------------------
const limiteConnexion = creerLimiteur({ max: 5, fenetreMs: 15 * 60 * 1000 });
const limiteInscription = creerLimiteur({ max: 5, fenetreMs: 60 * 60 * 1000 });
// Sert à faire le même calcul que l'email existe ou non (voir plus bas).
const HASH_FACTICE = hacherMotDePasse(crypto.randomBytes(16).toString('hex'));

routeur.post('/api/inscription', (req, res) => {
  const email = texte(req.body.email).toLowerCase();
  const motDePasse = typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : '';

  if (limiteInscription(req.ip)) {
    return res.status(429).json({ erreur: 'Trop de demandes. Réessayez plus tard.' });
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return res.status(400).json({ erreur: 'Adresse email invalide.' });
  }
  // La longueur protège mieux que les caractères spéciaux imposés.
  if (motDePasse.length < 10 || motDePasse.length > 200) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 10 caractères.' });
  }

  // Les "?" sont remplis par la base elle-même : ce que tape le visiteur reste
  // une simple valeur et ne peut jamais être lu comme du SQL. On n'assemble
  // jamais une requête en collant des morceaux de texte.
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    // Limite connue : ce message révèle qu'un compte existe. Sur un vrai site,
    // on répond pareil dans les deux cas et on envoie un email de confirmation.
    return res.status(409).json({ erreur: 'Un compte existe déjà avec cet email.' });
  }
  // Le rôle n'est pas lu dans la requête : tout nouveau compte est "client".
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (email, hash) VALUES (?, ?)')
    .run(email, hacherMotDePasse(motDePasse));

  ouvrirSession(res, Number(lastInsertRowid));
  res.status(201).json({ email });
});

routeur.post('/api/connexion', (req, res) => {
  const email = texte(req.body.email).toLowerCase();
  const motDePasse = typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : '';

  // 5 essais par quart d'heure pour un même email depuis une même adresse :
  // deviner un mot de passe en les essayant tous devient irréaliste.
  if (limiteConnexion(`${req.ip}|${email}`)) {
    return res.status(429).json({ erreur: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  }

  const utilisateur = db.prepare('SELECT id, email, hash FROM users WHERE email = ?').get(email);
  // On vérifie un mot de passe même si l'email n'existe pas, pour que la
  // réponse prenne le même temps dans les deux cas.
  const correct = verifierMotDePasse(motDePasse, utilisateur?.hash ?? HASH_FACTICE);
  if (!utilisateur || !correct) {
    // Même message dans les deux cas : on ne dit pas si l'email est inscrit.
    return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
  }

  ouvrirSession(res, utilisateur.id);
  res.json({ email: utilisateur.email });
});

routeur.post('/api/deconnexion', (req, res) => {
  // On supprime la session côté serveur, pas seulement le cookie.
  sessions.delete(lireCookies(req).sid);
  res.setHeader('Set-Cookie', cookieSession('', 0));
  res.json({ ok: true });
});

// Appelée par toutes les pages pour adapter le menu : répond aussi aux
// visiteurs non connectés.
routeur.get('/api/moi', (req, res) => {
  const utilisateur = utilisateurConnecte(req);
  if (!utilisateur) return res.json({ connecte: false });
  res.json({ connecte: true, email: utilisateur.email, role: utilisateur.role });
});

// --- Formulaire de contact ---------------------------------------------------
const limiteContact = creerLimiteur({ max: 3, fenetreMs: 10 * 60 * 1000 });

routeur.post('/api/contact', (req, res) => {
  const merci = { message: 'Merci ! Votre message a bien été envoyé.' };

  // Champ piège : invisible pour un humain, rempli par les robots. On répond
  // "merci" sans rien enregistrer, pour ne pas leur indiquer qu'ils sont repérés.
  if (texte(req.body.site_web) !== '') return res.json(merci);

  if (limiteContact(req.ip)) {
    return res.status(429).json({ erreur: 'Trop de messages envoyés. Réessayez plus tard.' });
  }

  // Validation côté serveur. Les "required" et "maxlength" du HTML aident le
  // visiteur honnête mais ne protègent rien : on peut envoyer la requête sans
  // passer par la page.
  const nom = texte(req.body.nom);
  const email = texte(req.body.email);
  const message = texte(req.body.message);
  if (nom.length < 1 || nom.length > 80) {
    return res.status(400).json({ erreur: 'Indiquez votre nom (80 caractères maximum).' });
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return res.status(400).json({ erreur: 'Adresse email invalide.' });
  }
  if (message.length < 10 || message.length > 2000) {
    return res.status(400).json({ erreur: 'Le message doit faire entre 10 et 2000 caractères.' });
  }

  db.prepare('INSERT INTO messages (nom, email, message) VALUES (?, ?, ?)').run(nom, email, message);
  res.json(merci);
});

// Page réservée à la boulangerie : la liste des messages reçus.
routeur.get('/admin/messages', (req, res) => {
  const utilisateur = utilisateurConnecte(req);
  // Le rôle est relu dans la base à chaque requête, il ne vient pas du navigateur.
  if (!utilisateur || utilisateur.role !== 'admin') {
    return res.status(403).type('text').send('Accès réservé à la boulangerie.');
  }

  const messages = db
    .prepare('SELECT nom, email, message, cree_le FROM messages ORDER BY id DESC')
    .all();
  // Tout ce qui vient d'un visiteur passe par echapperHtml avant d'être mis
  // dans la page : c'est ici que se joue la protection, à l'affichage.
  const liste = messages
    .map(
      (m) => `<article class="carte">
        <p><strong>${echapperHtml(m.nom)}</strong> — ${echapperHtml(m.email)} — ${echapperHtml(m.cree_le)}</p>
        <p class="message-recu">${echapperHtml(m.message)}</p>
      </article>`
    )
    .join('\n');

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Messages reçus</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/composants.css">
</head>
<body>
  <main class="contenu">
    <h1>Messages reçus</h1>
    ${liste || '<p>Aucun message.</p>'}
    <p><a class="lien" href="/compte.html">← Retour à mon compte</a></p>
  </main>
</body>
</html>`);
});

// --- Boutique ----------------------------------------------------------------
routeur.get('/api/produits', (req, res) => {
  res.json(db.prepare('SELECT id, nom, prix_centimes, image FROM produits').all());
});

routeur.post('/api/commandes', exigerConnexion, (req, res) => {
  const articles = req.body.articles;
  if (!Array.isArray(articles) || articles.length === 0 || articles.length > 20) {
    return res.status(400).json({ erreur: 'Panier invalide.' });
  }

  const chercherProduit = db.prepare('SELECT nom, prix_centimes FROM produits WHERE id = ?');
  const detail = [];
  let total = 0;
  for (const article of articles) {
    const quantite = article?.quantite;
    // Quantité entière et positive : sinon une quantité négative ferait
    // baisser le total.
    if (!Number.isInteger(article?.id) || !Number.isInteger(quantite) || quantite < 1 || quantite > 50) {
      return res.status(400).json({ erreur: 'Panier invalide.' });
    }
    const produit = chercherProduit.get(article.id);
    if (!produit) return res.status(400).json({ erreur: 'Produit inconnu.' });

    // Le navigateur n'envoie que "quel produit, combien". Le PRIX est relu
    // dans notre base : celui affiché dans la page n'est jamais pris en compte.
    total += produit.prix_centimes * quantite;
    detail.push({ nom: produit.nom, quantite, prix_centimes: produit.prix_centimes });
  }

  // Pas de paiement ici. Sur un vrai site, on ne manipule jamais de numéro de
  // carte : on redirige vers un prestataire (Stripe, PayPlug, SumUp...) en lui
  // donnant le total calculé ci-dessus.
  const { lastInsertRowid } = db
    .prepare('INSERT INTO commandes (user_id, detail, total_centimes) VALUES (?, ?, ?)')
    .run(req.utilisateur.id, JSON.stringify(detail), total);
  res.status(201).json({ id: Number(lastInsertRowid), total_centimes: total });
});

routeur.get('/api/commandes', exigerConnexion, (req, res) => {
  const commandes = db
    .prepare('SELECT id, detail, total_centimes, cree_le FROM commandes WHERE user_id = ? ORDER BY id DESC')
    .all(req.utilisateur.id);
  res.json(commandes.map((c) => ({ ...c, detail: JSON.parse(c.detail) })));
});

routeur.get('/api/commandes/:id', exigerConnexion, (req, res) => {
  // "AND user_id = ?" : être connecté ne suffit pas, il faut que la commande
  // appartienne à la personne connectée. Sans ça, il suffirait de changer le
  // numéro dans l'adresse pour lire les commandes des autres clients.
  const commande = db
    .prepare('SELECT id, detail, total_centimes, cree_le FROM commandes WHERE id = ? AND user_id = ?')
    .get(Number(req.params.id), req.utilisateur.id);
  // 404 que la commande n'existe pas ou qu'elle soit à quelqu'un d'autre : on
  // ne révèle pas quels numéros existent.
  if (!commande) return res.status(404).json({ erreur: 'Commande introuvable.' });
  res.json({ ...commande, detail: JSON.parse(commande.detail) });
});

module.exports = routeur;
