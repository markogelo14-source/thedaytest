# TheDay

TheDay is a responsive wedding and event RSVP manager built with Next.js App Router, Prisma, and SQLite for local development. It recreates the Figma flow with a public event page, personalized RSVP pages, and a protected organizer dashboard for guests, tables, imports, and settings.

## Features

- Organizer sign-in with signed HTTP-only session cookies
- Public event landing page and personalized RSVP links
- Guest management with manual RSVP editing
- Seating/table management for confirmed attendees
- CSV guest import and export
- JSON backup export
- Responsive organizer and guest flows

## Stack

- Next.js 16
- React 19
- Prisma 7
- SQLite via `better-sqlite3` for local development
- Tailwind CSS 4

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Prepare the database and seed demo data:

```bash
npm run db:setup
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local admin login

If you keep the development defaults, sign in at [http://localhost:3000/sign-in](http://localhost:3000/sign-in) with:

- Username: `admin`
- Password: `theday-demo`

If you set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`, those values will be used instead.

## Scripts

- `npm run dev` starts the Next.js dev server
- `npm run build` creates a production build
- `npm run start` runs the production server
- `npm run lint` runs ESLint
- `npm run db:generate` generates Prisma client artifacts
- `npm run db:push` syncs the Prisma schema to the database
- `npm run db:seed` seeds demo event data
- `npm run db:setup` runs `db:push` and `db:seed`

## CSV import format

The CSV import/export uses these columns:

- `name`
- `maxPeople`
- `contact`
- `status`
- `note`
- `attendees`
- `children`

Notes:

- `name` and `maxPeople` are required.
- `attendees` and `children` accept multiple names separated by `|`.
- Supported status values are `pending`, `confirmed`, `declined`, plus Croatian equivalents already handled by the importer.
- Import mode `append` adds new guest groups.
- Import mode `replace` removes existing guest groups and replaces them with the CSV contents.

## Project routes

- `/sign-in` organizer login
- `/` protected organizer dashboard
- `/event/[slug]` public event landing page
- `/rsvp/[token]` personalized RSVP page

## Deployment notes

This project is fully functional locally with SQLite. For real production deployment, SQLite on serverless hosting is not a durable multi-user backend. The recommended production path is:

1. Use a managed Postgres database such as Neon.
2. Update the Prisma datasource/provider for Postgres.
3. Set production values for `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET`.
4. Run Prisma migrations against the production database before deploy.

If you deploy to Vercel today, treat the current SQLite setup as development-only unless you intentionally move the app to persistent hosted database infrastructure.
