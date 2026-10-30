# How to run the site

## First time setup

```bash
npm install
npm run seed
```

The seed script creates 8 demo users and 5 tasks in `data/app.db`.

## Start the dev server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Stop the server

Press `Ctrl+C` in the terminal where `npm run dev` is running.

## Run tests

```bash
npm test          # 13 unit tests on rating math and diff logic
npm run smoke     # 21 end-to-end checks through the real HTTP path
```

## Build for production

```bash
npm run build     # verify it compiles
npm start         # run the production build
```

## Reset the database

```bash
npm run seed
```

This wipes and recreates all the demo data.
