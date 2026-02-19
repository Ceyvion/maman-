# Planning Jour MVP (FPH) — Générateur de planning jour

## 1) Reformulation des besoins
- Générer un planning **jour uniquement** (07:00–21:00) sans aucune nuit.
- Shifts fixes: `MATIN` (07:00–14:00), `SOIR` (14:00–21:00), `JOUR_12H` (07:00–19:00).
- Transmissions incluses dans la durée affichée (pas d’amplitude ajoutée).
- Pause minimale si > 6h, pause incluse dans la vacation (contrainte de conformité).
- Régimes d’agents obligatoires: 12h jour uniquement (max 3 consécutifs), matin uniquement, soir uniquement, **mixte (matin+soir)**.
- Contraintes repos: repos quotidien min 12h (option 11h accord local) **mais** SOIR→MATIN et SOIR→JOUR_12H interdits.
- Contraintes hebdo: 36h consécutives, 48h/7 jours glissants.
- Mode juridique: FPH / contractuel / mixte (appliquer la règle la plus protectrice en mixte).
- UI minimaliste en 3 écrans + moteur de contraintes + export CSV/PDF + rapport conformité.
- Suivi annuel des heures par agent (tracker) + équité tenant compte de l’historique.
- Cibles annuelles par agent (ex: 1607h proratisées).

## 2) Paramètres admin indispensables
- `transmissions_minutes` (ex: 10–20)
- `pause_min_minutes` (par défaut 20)
- `daily_rest_min_minutes` (12h) + `daily_rest_min_minutes_with_agreement` (11h si accord)
- `weekly_rest_min_minutes` (36h)
- `max_minutes_rolling_7d` (48h)
- `cycle_mode_enabled`, `cycle_weeks`, `max_minutes_per_week_excluding_overtime`
- `hard_forbidden_transitions` (SOIR→MATIN, SOIR→JOUR_12H)
- `planning_scope.day_only`, `planning_scope.service_window` (07:00–21:00)
- `allow_single_12h_exception`, `max_12h_exceptions_per_agent` (option d’exception 12h pour régime mixte)
- `allowed_12h_exception_dates` (liste de dates autorisées pour l’exception 12h)
- `forbid_matin_soir_matin` (interdire pattern MATIN→SOIR→MATIN)
- `use_tracker`, `tracker_year`, `record_tracker_on_generate`
- `auto_add_agents_if_needed`, `max_extra_agents` (renforts auto si planning impossible)
- `annual_target_hours` par agent (contrainte souple d’équité)

## 3) Modèle de données (MVP)
- **PlanningParams**: période, mode, besoins par shift, planning_scope, shifts, assumptions, admin_params, ruleset, regimes, transitions interdites, profil juridique.
- **Agent**: identité, régime, quotité, indisponibilités, préférences.
- **LockedAssignment**: (agent, date, shift).
- **Assignment**: affectation finale (agent, date, shift).
- **ComplianceReport**: violations dures + warnings + règles utilisées.

## 4) Algorithme (CP-SAT OR-Tools)
- Variables `x[a, d, s]` ∈ {0,1}.
- Contraintes dures:
  - compatibilité régime/shift + mode global
  - régime mixte: matin/soir, avec option 12h exceptionnel limité par agent
  - optionnel: interdire pattern MATIN→SOIR→MATIN
  - renforts auto si activé (ajout d’agents pour faisabilité)
  - 1 shift max / agent / jour
  - indisponibilités
  - repos quotidien + transitions interdites explicites
  - couverture minimale
  - max 3 jours consécutifs en 12h
  - max 48h / 7j glissants
  - repos hebdo 36h modélisé via blocs de repos (1 jour off encadré si >=36h, ou 2 jours off)
  - max hebdo si cycle activé
- Objectifs (souples): équité soirs/week-ends + préférences.
- Sortie: planning + score + rapport conformité.

## 5) Spécification MVP / V2
**MVP (livré)**
- Moteur contraintes CP-SAT
- UI 3 écrans minimaliste
- Export CSV/PDF
- Rapport conformité

**V2**
- Gestion plus fine des quotités (cible heures/semaine)
- Verrouillage interactif (clic sur calendrier)
- Multi-semaines avec cycles paramétrables
- Import agents (CSV)
- Optimisation avancée (équité multi-critères, pénalités pondérées)
- Historique + audit complet

## 6) Architecture + API
- **Backend**: FastAPI + OR-Tools (CP-SAT)
- **Frontend**: HTML/CSS/JS (SPA simple)

Endpoints:
- `POST /generate` -> planning + conformité
- `POST /export/csv` -> CSV
- `POST /export/pdf` -> PDF
- `GET /tracker/{year}` -> heures annuelles + noms d’agents persistés
- `POST /tracker/record` -> enregistrer heures
- `GET /live/entries` -> liste des tâches live par période/agent/shift
- `POST /live/entries` -> créer une tâche live
- `PUT /live/entries/{entry_id}` -> mettre à jour statut/détails
- `DELETE /live/entries/{entry_id}` -> supprimer une tâche live
- `GET /compliance/french-health` -> état des garde-fous conformité FR
- `GET /compliance/audit/recent` -> journal d’audit récent
- `GET /health`

Conformité santé FR (équivalent attendu à HIPAA):
- Pas d’équivalent unique en France: appliquer **RGPD + Loi Informatique et Libertés + règles santé (secret médical / HDS selon contexte d’hébergement)**.
- Garde-fous implémentés dans le MVP:
  - blocage des motifs sensibles dans les tâches live (email, téléphone, NIR)
  - rétention des tâches live (purge automatique)
  - audit log (génération, exports, opérations live)
  - notice UI de minimisation des données
- Variables d’environnement:
  - `FRENCH_HEALTH_COMPLIANCE_MODE=true|false` (défaut `true`)
  - `BLOCK_PATIENT_IDENTIFIERS=true|false` (défaut `true`)
  - `LIVE_TASK_RETENTION_DAYS=90` (défaut `90`)

## 7) Instructions d’exécution
Python 3.14 n'est pas supporte pour ce MVP (roues natives `pydantic-core`/`ortools`).
Utiliser Python 3.12.

Option simple (recommandee):
```bash
cd "/Users/galleguerric/Desktop/maman emploi du temps/mvp"
./run_api.sh
```

Frontend (serveur statique):
```bash
cd "/Users/galleguerric/Desktop/maman emploi du temps/mvp"
./run_frontend.sh
```
Ouvrir: http://localhost:5173

Lancement tout-en-un (API + Frontend + ouverture navigateur):
```bash
cd "/Users/galleguerric/Desktop/maman emploi du temps/mvp"
./run_all.sh
```

Option manuelle:
```bash
cd "/Users/galleguerric/Desktop/maman emploi du temps/mvp"
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 8) Dataset d’exemple
- `/Users/galleguerric/Desktop/maman emploi du temps/mvp/data/sample_request.json`

## 9) Tests (>=10)
```bash
cd "/Users/galleguerric/Desktop/maman emploi du temps/mvp"
source .venv/bin/activate
PYTHONPATH=. pytest -q
```

## 10) Guide utilisateur (1 page)
1. **Paramètres planning**: définir service, période, mode et besoins par shift.
2. **Agents**: saisir identité, régime, quotité, indisponibilités.
3. **Générer**: lancer la génération, consulter planning + conformité.
4. **Suivi en temps réel**: dans l’onglet génération, choisir une affectation agent/date/shift, ajouter une tâche détaillée, et mettre à jour son statut (prévu/en cours/bloqué/terminé) en live.
5. **Exporter**: CSV/PDF via boutons.

**Disclaimer**: outil d’aide à la décision. Vérifier selon accords locaux et réglementations applicables.
