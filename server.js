const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


let partie = new Partie();



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

  joueurActif() { return this.joueurCourant === "sud" ? this.joueurSud : this.joueurNord; }
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
    const debutAdv = joueurEstSud ? 7 : 0;
    const finAdv   = joueurEstSud ? 13 : 6;

    if (index < debutAdv || index > finAdv) return 0;

    let total = 0, casesCapturees = [], i = index;

    while (i >= debutAdv && i <= finAdv) {
      const v = this.plateau.cases[i];
      if (v < 2 || v > 4) break;
      total += v;
      casesCapturees.push(i);
      i--;
    }

    if (!casesCapturees.length) return 0;

    for (const c of casesCapturees) this.plateau.cases[c] = 0;

    if (joueurEstSud) this.joueurSud.score += total;
    else this.joueurNord.score += total;

    return total;
  }

  campVide(camp) {
    const s = camp === "sud" ? 0 : 7;
    const e = camp === "sud" ? 6 : 13;
    for (let i = s; i <= e; i++) if (this.plateau.cases[i] > 0) return false;
    return true;
  }

  totalGraines() {
    return this.plateau.cases.reduce((s, v) => s + v, 0);
  }

  partieTerminee() {
    if (this.joueurSud.score >= 40)
      return { raison: "Sud a atteint 40", gagnant: "sud" };

    if (this.joueurNord.score >= 40)
      return { raison: "Nord a atteint 40", gagnant: "nord" };

    return null;
  }

  jouer(index, camp) {
    if (this.termine) return { ok:false, msg:"Terminé" };
    if (camp !== this.joueurCourant) return { ok:false, msg:"Pas ton tour" };
    if (!this.caseValide(index)) return { ok:false, msg:"Case invalide" };

    const last = this.distribuerGraines(index);
    this.capturer(last);

    const fin = this.partieTerminee();
    if (fin) {
      this.termine = true;
      this.fin = fin;
      return { ok:true, fin };
    }

    this.changerJoueur();
    return { ok:true, msg:"Tour suivant" };
  }

  toJSON() {
    return {
      cases: this.plateau.cases,
      scoreSud: this.joueurSud.score,
      scoreNord: this.joueurNord.score,
      joueurCourant: this.joueurCourant,
      message: this.message
    };
  }
}



app.get('/api/etat', (req, res) => {
  res.json(partie.toJSON());
});

app.post('/api/jouer', (req, res) => {
  const { index, camp } = req.body;
  const result = partie.jouer(index, camp);
  res.json(result);
});

app.post('/api/reset', (req, res) => {
  partie = new Partie();
  res.json({ ok:true });
});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Serveur lancé sur port " + PORT);
});