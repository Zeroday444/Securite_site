// Petites fonctions de sécurité réutilisées dans routes.js.
const crypto = require('node:crypto');

// Transforme l'en-tête "Cookie: a=1; b=2" en objet { a: '1', b: '2' }.
function lireCookies(req) {
  const cookies = {};
  for (const morceau of (req.headers.cookie ?? '').split(';')) {
    const i = morceau.indexOf('=');
    if (i === -1) continue;
    try {
      cookies[morceau.slice(0, i).trim()] = decodeURIComponent(morceau.slice(i + 1).trim());
    } catch {
      // cookie mal formé : on l'ignore
    }
  }
  return cookies;
}

// --- Mots de passe -----------------------------------------------------------
// On ne stocke jamais le mot de passe, seulement son "hachage" : une empreinte
// impossible à inverser. scrypt est volontairement lent, ce qui rend le test de
// millions de mots de passe très coûteux pour quelqu'un qui aurait volé la base.
// Le "sel" (aléatoire, différent pour chaque compte) fait que deux personnes
// avec le même mot de passe n'ont pas la même empreinte.
function hacherMotDePasse(motDePasse) {
  const sel = crypto.randomBytes(16);
  const cle = crypto.scryptSync(motDePasse, sel, 64);
  return `scrypt$${sel.toString('hex')}$${cle.toString('hex')}`;
}

function verifierMotDePasse(motDePasse, hash) {
  const [, selHex, cleHex] = hash.split('$');
  const attendu = Buffer.from(cleHex, 'hex');
  const obtenu = crypto.scryptSync(motDePasse, Buffer.from(selHex, 'hex'), attendu.length);
  // Comparaison en temps constant : le temps de réponse ne donne aucun indice.
  return crypto.timingSafeEqual(attendu, obtenu);
}

// --- Affichage de texte venant d'un visiteur ---------------------------------
// Remplace les caractères qui ont un sens en HTML. Un message contenant des
// balises est alors affiché comme du texte au lieu d'être interprété par le
// navigateur. À appliquer au moment de l'AFFICHAGE, sur tout ce qui vient
// d'un visiteur.
function echapperHtml(valeur) {
  return String(valeur)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// --- Limitation du nombre d'essais -------------------------------------------
// Compte les essais par clé (une IP, un email...) sur une fenêtre de temps.
// Renvoie une fonction qui répond true quand la limite est dépassée.
function creerLimiteur({ max, fenetreMs }) {
  const essais = new Map(); // clé -> { nombre, debut }
  return function limiteDepassee(cle) {
    const maintenant = Date.now();
    const essai = essais.get(cle);
    if (!essai || maintenant - essai.debut > fenetreMs) {
      essais.set(cle, { nombre: 1, debut: maintenant });
      return false;
    }
    essai.nombre += 1;
    return essai.nombre > max;
  };
}

module.exports = {
  lireCookies,
  hacherMotDePasse,
  verifierMotDePasse,
  echapperHtml,
  creerLimiteur,
};
