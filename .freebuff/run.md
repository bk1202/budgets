# FreeBudget — Run Instructions

## Reproduce Artifacts
1. `npm install` — install backend dependencies
2. `cd client && npm install` — install frontend dependencies
3. `cd client && npm run build` — build the React/Vite frontend (outputs to `client/dist/`)
4. Copy `.env` from the main checkout (or create one from `.env.example`)

## Run the Server
```
NODE_ENV=production node server.js
```

The production mode serves the built frontend from `client/dist/` and the API on the same port.
Default port: 3001
