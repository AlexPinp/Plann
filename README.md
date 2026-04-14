## Planner SAU

Application de gestion de planning pour equipe infirmiere en service d'urgence.

## Getting Started

1) Installer les dependances:

```bash
npm install
```

2) Configurer les variables d'environnement:

```bash
cp .env.example .env
```

Puis remplir:

- `DATABASE_URL` (Supabase Postgres ou Postgres local)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

3) Generer le client Prisma:

```bash
npx prisma generate
```

4) Lancer l'application:

```bash
npm run dev
```

5) Ouvrir [http://localhost:3000](http://localhost:3000)

## Fonctionnalites en place

- Dashboard d'accueil
- Vue planning hebdomadaire
- Page agents/competences
- Auth email link Supabase (`/login`)
- Callback auth (`/api/auth/callback`)
- API CRUD initiale des affectations (`/api/assignments`)

## Prochaines etapes

- Ajouter migrations Prisma et seed
- Brancher les pages UI sur les vraies donnees Prisma
- Ajouter controle d'acces par role (admin, cadre, lecture seule)
