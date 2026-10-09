(async () => {
  const moi = await api('/api/moi');
  if (!moi.donnees.connecte) {
    window.location.href = 'connexion.html';
    return;
  }
  document.querySelector('#identite').textContent = `Connecté en tant que ${moi.donnees.email}`;
  // Cacher le lien n'est que du confort d'affichage : c'est le serveur qui
  // refuse la page /admin/messages à ceux qui ne sont pas admin.
  document.querySelector('#zone-admin').hidden = moi.donnees.role !== 'admin';

  const zone = document.querySelector('#commandes');
  const commandes = await api('/api/commandes');
  if (!commandes.ok || commandes.donnees.length === 0) {
    zone.textContent = 'Aucune commande pour le moment.';
    return;
  }
  for (const commande of commandes.donnees) {
    const carte = document.createElement('article');
    carte.className = 'carte';

    const titre = document.createElement('h3');
    titre.textContent = `Commande n°${commande.id} — ${formaterPrix(commande.total_centimes)}`;
    carte.append(titre);

    const liste = document.createElement('ul');
    for (const ligne of commande.detail) {
      const element = document.createElement('li');
      element.textContent = `${ligne.quantite} × ${ligne.nom} (${formaterPrix(ligne.prix_centimes)})`;
      liste.append(element);
    }
    carte.append(liste);
    zone.append(carte);
  }
})();

document.querySelector('#deconnexion').addEventListener('click', async () => {
  await api('/api/deconnexion', 'POST');
  window.location.href = 'index.html';
});
