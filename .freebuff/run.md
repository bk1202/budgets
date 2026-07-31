# FreeBudget — Run Instructions

## Reproduce Artifacts
1. `npm install` — install backend dependencies
2. `cd client && npm install` — install frontend dependencies
3. `cd client && npm run build` — build the React/Vite frontend (outputs to `client/dist/`)
4. Copy `.env.example` to `.env` and fill in your Plaid API credentials

## Run the Server
```
NODE_ENV=production node server.js
```
The production mode serves the built frontend from `client/dist/` and the API on the same port.
The server binds to `0.0.0.0` so it's accessible from any device on your local network.

Default port: 3001

## Phone Access Anywhere (via ngrok)
1. Authenticate ngrok: `ngrok config add-authtoken <your-token>` (get one at https://dashboard.ngrok.com)
2. Start the tunnel: `ngrok http 3001`
3. Open the HTTPS URL ngrok prints — accessible from any phone, anywhere
