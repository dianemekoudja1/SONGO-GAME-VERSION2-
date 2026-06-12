/* ==========================================================
   SONGO — VERSION 2 : Client Ajax  (jeu réseau)
   Fichier : client.js

   PRINCIPE DU CLIENT AJAX
   ──────────────────────────────────────────────────────────
   1. L'utilisateur choisit son camp (sud ou nord).
   2. Une requête POST /api/rejoindre est envoyée au serveur.
   3. Le client lance un polling (setInterval) toutes les 1,5 s
      sur GET /api/etat pour synchroniser l'affichage.
   4. Quand le joueur clique sur une case, une requête
      POST /api/jouer est envoyée (Ajax) ; la réponse contient
      le nouvel état complet, mis à jour immédiatement.
   5. Si c'est le tour de l'adversaire, les cases sont désactivées
      et le polling assure la mise à jour quand il joue.

   ORGANISATION DU CODE
   ──────────────────────────────────────────────────────────
   1. Variables d'état client
   2. Fonctions Ajax (rejoindre, jouer, reset, getEtat)
   3. Fonctions d'affichage (renderDots, render, showVictory)
   4. Polling et initialisation
   ========================================================== */


/* ==========================================================
   1. VARIABLES D'ÉTAT CLIENT
   ========================================================== */

let monCamp    = null;   // "sud" ou "nord" — camp choisi par CE client
let monNom     = "";     // prénom saisi
let pollingId  = null;   // référence setInterval pour le polling
let derniereVictoire = false; // pour n'afficher la victoire qu'une fois


/* ==========================================================
   2. FONCTIONS AJAX
   ========================================================== */

/**
 * Requête générique fetch (Ajax).
 * Toutes les communications avec le serveur passent par ici.
 *
 * @param {string} url     Route API
 * @param {string} method  "GET" ou "POST"
 * @param {object} body    Données à envoyer (POST uniquement)
 * @returns {Promise<object>} Réponse JSON du serveur
 */
async function ajax(url, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  return response.json();
}

/**
 * REJOINDRE LA PARTIE
 * Envoi Ajax : POST /api/rejoindre  { camp, nom }
 * Si OK, affiche le plateau et démarre le polling.
 */
async function rejoindre(camp) {
  const nomInput = document.getElementById('input-nom').value.trim();
  monNom  = nomInput || `Joueur ${camp}`;
  monCamp = camp;

  document.getElementById('btn-join-sud').disabled  = true;
  document.getElementById('btn-join-nord').disabled = true;

  try {
    const data = await ajax('/api/rejoindre', 'POST', { camp, nom: monNom });

    if (!data.ok) {
      alert(data.msg);
      document.getElementById('btn-join-sud').disabled  = false;
      document.getElementById('btn-join-nord').disabled = false;
      monCamp = null;
      return;
    }

    // Afficher le plateau, masquer l'écran de connexion
    document.getElementById('screen-join').style.display = 'none';
    document.getElementById('screen-game').style.display = '';

    // Démarrer le polling pour synchroniser l'état
    demarrerPolling();

  } catch (e) {
    alert("Erreur réseau : " + e.message);
    monCamp = null;
  }
}

/**
 * JOUER UN COUP
 * Envoi Ajax : POST /api/jouer  { index, camp }
 * La réponse contient le nouvel état complet.
 */
async function jouer(index) {
  try {
    const data = await ajax('/api/jouer', 'POST', { index, camp: monCamp });

    if (!data.ok) {
      setStatus(data.msg, 'err');
      return;
    }

    // Mettre à jour l'affichage avec l'état retourné par le serveur
    appliquerEtat(data.etat);

    if (data.fin && !derniereVictoire) {
      derniereVictoire = true;
      setTimeout(() => showVictory(data.fin, data.etat), 400);
    }

  } catch (e) {
    setStatus("Erreur réseau : " + e.message, 'err');
  }
}

/**
 * RÉCUPÉRER L'ÉTAT (polling)
 * Envoi Ajax : GET /api/etat
 * Met à jour l'affichage si des changements sont détectés.
 */
async function getEtat() {
  try {
    const etat = await ajax('/api/etat');
    appliquerEtat(etat);

    if (etat.fin && !derniereVictoire) {
      derniereVictoire = true;
      setTimeout(() => showVictory(etat.fin, etat), 400);
    }
  } catch (e) {
    /* silence — perte réseau momentanée */
  }
}

/**
 * NOUVELLE PARTIE
 * Envoi Ajax : POST /api/reset
 */
async function resetGame() {
  try {
    derniereVictoire = false;
    document.getElementById('victory-overlay').classList.remove('show');
    await ajax('/api/reset', 'POST');
    // Remettre aussi l'écran de connexion pour choisir son camp
    monCamp = null;
    arreterPolling();
    document.getElementById('screen-join').style.display = '';
    document.getElementById('screen-game').style.display = 'none';
    document.getElementById('btn-join-sud').disabled  = false;
    document.getElementById('btn-join-nord').disabled = false;
  } catch (e) {
    alert("Erreur réseau : " + e.message);
  }
}


/* ==========================================================
   3. FONCTIONS D'AFFICHAGE
   ========================================================== */

/** Rendu visuel des graines */
function renderDots(n) {
  if (n === 0) return `<span style="color:#5C3317;font-size:12px;">·</span>`;
  if (n <= 9) {
    let html = '<div class="seeds-dots">';
    for (let i = 0; i < n; i++) html += '<div class="dot"></div>';
    return html + '</div>';
  }
  return `<div class="seeds-num">${n}</div>`;
}

/**
 * Applique un état JSON reçu du serveur à l'interface.
 * C'est la fonction centrale de mise à jour de l'affichage.
 *
 * @param {object} etat  Objet JSON retourné par /api/etat ou /api/jouer
 */
function appliquerEtat(etat) {
  const p         = etat.cases;
  const isSudTour = etat.joueurCourant === "sud";
  const monTour   = monCamp === etat.joueurCourant && !etat.termine;

  // ── Bandeau "en attente de l'adversaire" ──
  const advPresent = etat.places.sud && etat.places.nord;
  const waitBanner = document.getElementById('waiting-adv');
  waitBanner.style.display = advPresent ? 'none' : '';

  // ── Rangée Nord ──
  const rowNord = document.getElementById('row-nord');
  rowNord.innerHTML = '';
  for (let i = 7; i <= 13; i++) {
    const cell     = document.createElement('div');
    // On ne peut jouer que les cases de son propre camp quand c'est son tour
    const isActive = monTour && monCamp === "nord" && p[i] > 0 && !etat.termine;
    cell.className = 'cell' + (isActive ? '' : ' disabled');
    cell.innerHTML = renderDots(p[i]);
    cell.title     = `Case ${i} : ${p[i]} graine(s)`;
    if (isActive) cell.onclick = () => jouer(i);
    rowNord.appendChild(cell);
  }

  // ── Rangée Sud ──
  const rowSud = document.getElementById('row-sud');
  rowSud.innerHTML = '';
  for (let i = 0; i <= 6; i++) {
    const cell     = document.createElement('div');
    const isActive = monTour && monCamp === "sud" && p[i] > 0 && !etat.termine;
    cell.className = 'cell' + (isActive ? '' : ' disabled');
    cell.innerHTML = renderDots(p[i]);
    cell.title     = `Case ${i} : ${p[i]} graine(s)`;
    if (isActive) cell.onclick = () => jouer(i);
    rowSud.appendChild(cell);
  }

  // ── Scores ──
  document.getElementById('score-nord').textContent    = etat.scoreNord;
  document.getElementById('score-sud').textContent     = etat.scoreSud;
  document.getElementById('score-lbl-nord').textContent = etat.nomNord;
  document.getElementById('score-lbl-sud').textContent  = etat.nomSud;
  document.getElementById('total-info').textContent    = etat.totalGraines + ' graines';

  // ── Labels actif/inactif ──
  if (!etat.termine) {
    document.getElementById('lbl-nord').className =
      'player-label ' + (isSudTour ? 'inactive' : 'active');
    document.getElementById('lbl-sud').className  =
      'player-label ' + (isSudTour ? 'active'   : 'inactive');
  }

  // ── Message de statut ──
  if (!etat.termine) {
    if (!advPresent) {
      setStatus("En attente de l'adversaire…", '');
    } else if (monTour) {
      setStatus("C'est votre tour — choisissez une case.", 'ok');
    } else {
      setStatus(`Tour de ${isSudTour ? etat.nomSud : etat.nomNord} — veuillez patienter…`, '');
    }
  } else {
    setStatus(etat.message, 'win');
  }
}

/** Affiche l'écran de victoire */
function showVictory(fin, etat) {
  const g = fin.gagnant;
  document.getElementById('v-score-nord').textContent = etat.scoreNord;
  document.getElementById('v-score-sud').textContent  = etat.scoreSud;
  document.getElementById('v-name-nord').textContent  = etat.nomNord;
  document.getElementById('v-name-sud').textContent   = etat.nomSud;
  document.getElementById('v-reason').textContent     = fin.raison;

  document.getElementById('vs-nord').classList.remove('winner');
  document.getElementById('vs-sud').classList.remove('winner');

  if (g === 'nord') {
    document.getElementById('v-icon').textContent  = '🏆';
    document.getElementById('v-tag').textContent   = 'Victoire';
    document.getElementById('v-title').textContent = `${etat.nomNord} gagne !`;
    document.getElementById('vs-nord').classList.add('winner');
  } else if (g === 'sud') {
    document.getElementById('v-icon').textContent  = '🏆';
    document.getElementById('v-tag').textContent   = 'Victoire';
    document.getElementById('v-title').textContent = `${etat.nomSud} gagne !`;
    document.getElementById('vs-sud').classList.add('winner');
  } else {
    document.getElementById('v-icon').textContent  = '🤝';
    document.getElementById('v-tag').textContent   = 'Fin de partie';
    document.getElementById('v-title').textContent = 'Égalité !';
  }

  document.getElementById('victory-overlay').classList.add('show');
}

/** Met à jour la barre de message */
function setStatus(msg, type) {
  const el   = document.getElementById('status');
  el.textContent = msg;
  el.className   = type || '';
}


/* ==========================================================
   4. POLLING ET INITIALISATION
   ========================================================== */

/**
 * Démarre le polling Ajax : interroge GET /api/etat toutes les
 * 1 500 ms pour rafraîchir l'affichage quand l'adversaire joue.
 */
function demarrerPolling() {
  if (pollingId) return;
  getEtat(); // appel immédiat
  pollingId = setInterval(getEtat, 1500);
}

function arreterPolling() {
  if (pollingId) { clearInterval(pollingId); pollingId = null; }
}

/* ── Initialisation ── */
// Si la page est rechargée, l'état client est perdu ; le joueur devra re-choisir son camp.
console.log("Songo Réseau — client chargé. Choisissez votre camp pour commencer.");
