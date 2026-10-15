# Team Alpha — Wedding Photography Platform

Team Alpha is a wedding photography website and business platform with a React frontend and an Express backend.

## Project structure
- `frontend/`: React, Vite, Tailwind CSS website and admin interface.
- `backend/`: Express API and integrations.

## Local development
1. Install Node.js and npm.
2. In `backend/`, run `npm install`, copy `.env.example` to `.env`, and fill in local credentials. Never commit `.env`.
3. In `frontend/`, run `npm install` and configure any required local environment variables.
4. Start the backend with `npm run dev` from `backend/`.
5. Start the frontend with `npm run dev` from `frontend/`.

The backend depends on services such as MongoDB and Cloudinary; set these up before testing their features. Refer to actual application configuration for frontend API URLs.

## Quality checks
- Frontend: `npm run lint`, `npm run build`.
- Backend: `npm start` (requires configured services).

## Redesign
See [Premium Redesign Plan](docs/PREMIUM_REDESIGN_PLAN.md) for phased changes, verification and release gates.

## Security
Never commit secrets, API tokens, private keys or customer data. Check Git history and rotate any previously exposed credentials.
