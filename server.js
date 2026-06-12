const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Serveur lancé sur port " + PORT);
});

class Joueur {
  constructor(nom) { this.nom = nom; this.score = 0; }
}

class Plateau {
  constructor() { this.cases = new Array(14).fill(5); }
}

class Partie {

  constructor() {
    this.plateau        = new Plateau();
    this.joueurSud      = new Joueur("Joueur Sud");
    this.joueurNord     = new Joueur("Joueur Nord");
    this.joueurCourant  = "sud";   
    this.termine        = false;
    this.fin            = null;
    this.message        = "En attente des deux joueurs…";
    
    this.session        = { sud: null, nord: null };
  }


  joueurActif()  { return this.joueurCourant === "sud" ? this.joueurSud : this.joueurNord; }
  changerJoueur(){ this.joueurCourant = this.joueurCourant === "sud" ? "nord" : "sud"; }

  caseValide(index) {
    if (this.plateau.cases[index] <= 0) return false;
    return this.joueurCourant === "sud"
      ? (index >= 0 && index <= 6)
      : (index >= 7 && index <= 13);
  }

  distribuerGraines(index) {
    let graines = this.plateau.cases[index];
    this.plateau.cases[index] = 0;
    let position = index;
    while (graines > 0) {
      position = (position + 1) % 14;
      this.plateau.cases[position]++;
      graines--;
    }
    return position;
  }

  capturer(index) {
    const joueurEstSud = this.joueurCourant === "sud";
    const debutAdv = joueurEstSud ? 7  : 0;
    const finAdv   = joueurEstSud ? 13 : 6;

    if (index < debutAdv || index > finAdv) return 0;

    let total = 0, casesCapturees = [], i = index;
    while (i >= debutAdv && i <= finAdv) {
      const v = this.plateau.cases[i];
      if (v < 2 || v > 4) break;
      total += v; casesCapturees.push(i); i--;
    }
    if (!casesCapturees.length) return 0;

    
    const copie = [...this.plateau.cases];
    for (const c of casesCapturees) copie[c] = 0;
    let campVide = true;
    for (let j = debutAdv; j <= finAdv; j++) {
      if (copie[j] > 0) { campVide = false; break; }
    }
    if (campVide) return 0;

    for (const c of casesCapturees) this.plateau.cases[c] = 0;
    if (joueurEstSud) this.joueurSud.score += total;
    else              this.joueurNord.score += total;
    return total;
  }

  campVide(camp) {
    const s = camp === "sud" ? 0 : 7;
    const e = camp === "sud" ? 6 : 13;
    for (let i = s; i <= e; i++) if (this.plateau.cases[i] > 0) return false;
    return true;
  }

  solidaritePossible() {
    const campAdv = this.joueurCourant === "sud" ? "nord" : "sud";
    if (!this.campVide(campAdv)) return true;
    const debut = this.joueurCourant === "sud" ? 0  : 7;
    const fin   = this.joueurCourant === "sud" ? 6  : 13;
    const dA    = this.joueurCourant === "sud" ? 7  : 0;
    const fA    = this.joueurCourant === "sud" ? 13 : 6;
    for (let i = debut; i <= fin; i++) {
      if (!this.plateau.cases[i]) continue;
      const sim = [...this.plateau.cases];
      let g = sim[i]; sim[i] = 0; let pos = i;
      while (g > 0) { pos = (pos+1)%14; sim[pos]++; g--; }
      for (let j = dA; j <= fA; j++)
        if (sim[j] > this.plateau.cases[j]) return true;
    }
    return false;
  }

  totalGraines() { return this.plateau.cases.reduce((s,v) => s+v, 0); }

  partieTerminee() {
    if (this.joueurSud.score  >= 40) return { raison: `${this.joueurSud.nom} a atteint 40 points`,  gagnant:"sud"     };
    if (this.joueurNord.score >= 40) return { raison: `${this.joueurNord.nom} a atteint 40 points`, gagnant:"nord"    };
    if (this.totalGraines() < 10) {
      if (this.joueurSud.score  > this.joueurNord.score) return { raison:"Moins de 10 graines", gagnant:"sud"     };
      if (this.joueurNord.score > this.joueurSud.score)  return { raison:"Moins de 10 graines", gagnant:"nord"    };
      return { raison:"Moins de 10 graines", gagnant:"egalite" };
    }
    return null;
  }

  
  jouer(index, camp) {
    if (this.termine)                 return { ok:false, msg:"Partie terminée." };
    if (camp !== this.joueurCourant)  return { ok:false, msg:"Ce n'est pas votre tour !" };
    if (!this.caseValide(index))      return { ok:false, msg:"Case invalide !" };
    if (!this.solidaritePossible()) {
      this.termine = true;
      return { ok:false, msg:"Aucun coup de solidarité possible — fin de partie." };
    }

    const derniere   = this.distribuerGraines(index);
    const pts        = this.capturer(derniere);
    const msgCapture = pts > 0 ? `  ✦ +${pts} capturée(s)` : "";

    const fin = this.partieTerminee();
    if (fin) {
      this.termine = true;
      this.fin     = fin;
      this.message = `Partie terminée — ${fin.raison}`;
      return { ok:true, fin };
    }

    this.changerJoueur();
    this.message = `Tour de ${this.joueurActif().nom}${msgCapture}`;
    return { ok:true, msg:this.message };
  }


  toJSON() {
    return {
      cases         : this.plateau.cases,
      scoreSud      : this.joueurSud.score,
      scoreNord     : this.joueurNord.score,
      nomSud        : this.joueurSud.nom,
      nomNord       : this.joueurNord.nom,
      joueurCourant : this.joueurCourant,
      termine       : this.termine,
      fin           : this.fin,
      message       : this.message,
      totalGraines  : this.totalGraines(),
      places        : {              // indique quelles places sont prises
        sud  : this.session.sud  !== null,
        nord : this.session.nord !== null
      }
    };
  }
}






app.get('/api/etat', (req, res) => {
  res.json(partie.toJSON());
});


app.post('/api/rejoindre', (req, res) => {
  const { camp, nom } = req.body;
  if (camp !== "sud" && camp !== "nord")
    return res.status(400).json({ ok:false, msg:"Camp invalide." });

  if (partie.session[camp] !== null)
    return res.json({ ok:false, msg:`Le camp ${camp} est déjà occupé.` });

  const nomJoueur = (nom || `Joueur ${camp}`).trim().substring(0, 20);
  partie.session[camp] = nomJoueur;

  if (camp === "sud")  partie.joueurSud.nom  = nomJoueur;
  if (camp === "nord") partie.joueurNord.nom = nomJoueur;

  // Mettre à jour le message quand les deux joueurs sont là
  if (partie.session.sud && partie.session.nord) {
    partie.message = `Partie lancée ! Tour de ${partie.joueurSud.nom}.`;
  } else {
    partie.message = `${nomJoueur} a rejoint (${camp}). En attente de l'adversaire…`;
  }

  res.json({ ok:true, camp, nom:nomJoueur });
});


app.post('/api/jouer', (req, res) => {
  const { index, camp } = req.body;
  if (typeof index !== 'number' || (camp !== 'sud' && camp !== 'nord'))
    return res.status(400).json({ ok:false, msg:"Paramètres invalides." });

  const result = partie.jouer(index, camp);
  res.json({ ...result, etat: partie.toJSON() });
});


app.post('/api/reset', (req, res) => {
  partie = new Partie();
  res.json({ ok:true, etat: partie.toJSON() });
});

app.listen(PORT, () => {
  console.log(`\n🌱  Songo Réseau — serveur démarré`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    Ouvrez deux onglets ou deux navigateurs pour jouer !\n`);
});
