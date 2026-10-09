const zoneProduits = document.querySelector('#produits');
const zonePanier = document.querySelector('#panier');
const zoneTotal = document.querySelector('#total');
const boutonCommander = document.querySelector('#commander');
const resultat = document.querySelector('#resultat');

let produits = [];
const panier = new Map(); // id du produit -> quantité

function afficherPanier() {
  zonePanier.replaceChildren();
  let total = 0;
  for (const [id, quantite] of panier) {
    const produit = produits.find((p) => p.id === id);
    total += produit.prix_centimes * quantite;
    const ligne = document.createElement('li');
    ligne.textContent = `${quantite} × ${produit.nom}`;
    zonePanier.append(ligne);
  }
  // Ce total est un simple affichage. Le montant réel de la commande est
  // recalculé par le serveur à partir de ses propres prix.
  zoneTotal.textContent = panier.size ? `Total : ${formaterPrix(total)}` : 'Votre panier est vide.';
  boutonCommander.disabled = panier.size === 0;
}

function afficherProduits() {
  for (const produit of produits) {
    const carte = document.createElement('li');
    carte.className = 'produit carte';

    const image = document.createElement('img');
    image.src = `images/${produit.image}`;
    image.alt = produit.nom;

    const nom = document.createElement('h3');
    nom.textContent = produit.nom;

    const prix = document.createElement('p');
    prix.textContent = formaterPrix(produit.prix_centimes);

    const bouton = document.createElement('button');
    bouton.className = 'bouton';
    bouton.type = 'button';
    bouton.textContent = 'Ajouter';
    bouton.addEventListener('click', () => {
      panier.set(produit.id, (panier.get(produit.id) ?? 0) + 1);
      afficherPanier();
    });

    carte.append(image, nom, prix, bouton);
    zoneProduits.append(carte);
  }
}

boutonCommander.addEventListener('click', async () => {
  // On n'envoie que les identifiants et les quantités, jamais les prix.
  const articles = [...panier].map(([id, quantite]) => ({ id, quantite }));
  const reponse = await api('/api/commandes', 'POST', { articles });
  if (reponse.ok) {
    panier.clear();
    afficherPanier();
    afficherResultat(
      resultat,
      `Commande n°${reponse.donnees.id} enregistrée : ${formaterPrix(reponse.donnees.total_centimes)}.`,
      true
    );
  } else {
    afficherResultat(resultat, reponse.donnees.erreur ?? 'Commande impossible.', false);
  }
});

(async () => {
  const reponse = await api('/api/produits');
  produits = reponse.ok ? reponse.donnees : [];
  afficherProduits();
  afficherPanier();
})();
