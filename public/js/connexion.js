// Les deux formulaires fonctionnent pareil : on envoie, puis on va sur "Mon compte".
function brancher(idFormulaire, idResultat, adresse) {
  const formulaire = document.querySelector(idFormulaire);
  const resultat = document.querySelector(idResultat);

  formulaire.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const champs = Object.fromEntries(new FormData(formulaire));
    const reponse = await api(adresse, 'POST', champs);
    if (reponse.ok) {
      window.location.href = 'compte.html';
    } else {
      afficherResultat(resultat, reponse.donnees.erreur ?? 'Une erreur est survenue.', false);
    }
  });
}

brancher('#formulaire-connexion', '#resultat-connexion', '/api/connexion');
brancher('#formulaire-inscription', '#resultat-inscription', '/api/inscription');
