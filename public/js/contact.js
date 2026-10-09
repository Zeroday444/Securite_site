const formulaire = document.querySelector('#formulaire-contact');
const resultat = document.querySelector('#resultat');

formulaire.addEventListener('submit', async (evenement) => {
  evenement.preventDefault();
  const champs = Object.fromEntries(new FormData(formulaire));
  const reponse = await api('/api/contact', 'POST', champs);
  if (reponse.ok) {
    afficherResultat(resultat, reponse.donnees.message, true);
    formulaire.reset();
  } else {
    afficherResultat(resultat, reponse.donnees.erreur ?? 'Envoi impossible.', false);
  }
});
