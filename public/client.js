

let monCamp    = null;   
let monNom     = "";     
let pollingId  = null;  
let derniereVictoire = false; 



async function ajax(url, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  return response.json();
}


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

    
    document.getElementById('screen-join').style.display = 'none';
    document.getElementById('screen-game').style.display = '';

    
    demarrerPolling();

  } catch (e) {
    alert("Erreur réseau : " + e.message);
    monCamp = null;
  }
}


async function jouer(index) {
  try {
    const data = await ajax('/api/jouer', 'POST', { index, camp: monCamp });

    if (!data.ok) {
      setStatus(data.msg, 'err');
      return;
    }

    
    appliquerEtat(data.etat);

    if (data.fin && !derniereVictoire) {
      derniereVictoire = true;
      setTimeout(() => showVictory(data.fin, data.etat), 400);
    }

  } catch (e) {
    setStatus("Erreur réseau : " + e.message, 'err');
  }
}


async function getEtat() {
  try {
    const etat = await ajax('/api/etat');
    appliquerEtat(etat);

    if (etat.fin && !derniereVictoire) {
      derniereVictoire = true;
      setTimeout(() => showVictory(etat.fin, etat), 400);
    }
  } catch (e) {
    
  }
}


async function resetGame() {
  try {
    derniereVictoire = false;
    document.getElementById('victory-overlay').classList.remove('show');
    await ajax('/api/reset', 'POST');
    
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

  
  const advPresent = etat.places.sud && etat.places.nord;
  const waitBanner = document.getElementById('waiting-adv');
  waitBanner.style.display = advPresent ? 'none' : '';

  
  const rowNord = document.getElementById('row-nord');
  rowNord.innerHTML = '';
  for (let i = 7; i <= 13; i++) {
    const cell     = document.createElement('div');
    
    const isActive = monTour && monCamp === "nord" && p[i] > 0 && !etat.termine;
    cell.className = 'cell' + (isActive ? '' : ' disabled');
    cell.innerHTML = renderDots(p[i]);
    cell.title     = `Case ${i} : ${p[i]} graine(s)`;
    if (isActive) cell.onclick = () => jouer(i);
    rowNord.appendChild(cell);
  }

  
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

  
  document.getElementById('score-nord').textContent    = etat.scoreNord;
  document.getElementById('score-sud').textContent     = etat.scoreSud;
  document.getElementById('score-lbl-nord').textContent = etat.nomNord;
  document.getElementById('score-lbl-sud').textContent  = etat.nomSud;
  document.getElementById('total-info').textContent    = etat.totalGraines + ' graines';

  
  if (!etat.termine) {
    document.getElementById('lbl-nord').className =
      'player-label ' + (isSudTour ? 'inactive' : 'active');
    document.getElementById('lbl-sud').className  =
      'player-label ' + (isSudTour ? 'active'   : 'inactive');
  }

  
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


function setStatus(msg, type) {
  const el   = document.getElementById('status');
  el.textContent = msg;
  el.className   = type || '';
}


function demarrerPolling() {
  if (pollingId) return;
  getEtat(); // appel immédiat
  pollingId = setInterval(getEtat, 1500);
}

function arreterPolling() {
  if (pollingId) { clearInterval(pollingId); pollingId = null; }
}


console.log("Songo Réseau — client chargé. Choisissez votre camp pour commencer.");
