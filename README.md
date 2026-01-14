# StreamFinder

## Overview
StreamFinder is a movie/TV discovery app with clean detail URLs, a Node/Express API proxy for TMDB, and static assets in `client/`.

## Local development
1) Install dependencies:
```
npm install
```

2) Add TMDB key:
```
TMDB_API_KEY=your_key_here
```
Create `server/.env` with the value above.

3) Run the server:
```
npm start
```

## Production
Set `NODE_ENV=production` and ensure `TMDB_API_KEY` is configured. This silences dev logs and keeps production output clean.

### Deploy: Node server
- Host the Express server from `server/server.js`.
- Ensure your platform serves static files from `client/`.
- Set environment variables: `TMDB_API_KEY`, `NODE_ENV=production`.

### Deploy: Netlify (static + redirects)
Use `netlify.toml` which includes clean URL rewrites for `/movie/*` and `/tv/*`.

### Deploy: Vercel
Use `vercel.json` with rewrites for `/movie/:slug` and `/tv/:slug`.

