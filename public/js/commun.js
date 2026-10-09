// Chargé sur toutes les pages.

// Envoie une requête à notre serveur et renvoie { ok, statut, donnees }.
async function api(adresse, methode = 'GET', corps) {
  const options = { method: methode };
  if (corps !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(corps);
  }
  const reponse = await fetch(adresse, options);
  const donnees = await reponse.json().catch(() => ({}));
  return { ok: reponse.ok, statut: reponse.status, donnees };
}

// Affiche un message de résultat. textContent (et non innerHTML) : le texte est
// affiché tel quel, jamais interprété comme du HTML.
function afficherResultat(element, texte, succes) {
  element.textContent = texte;
  element.className = `resultat ${succes ? 'succes' : 'erreur'}`;
}

function formaterPrix(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

// Dans le menu, "Connexion" devient "Mon compte" quand on est connecté.
(async () => {
  const lien = document.querySelector('#lien-compte');
  if (!lien) return;
  const moi = await api('/api/moi');
  if (moi.donnees.connecte) {
    lien.textContent = 'Mon compte';
    lien.href = 'compte.html';
  }
})();
