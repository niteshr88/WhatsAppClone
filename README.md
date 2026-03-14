# Sandesaa

## Frontend Environment Setup

The frontend uses Vite environment files.

- `.env.development`
  Used for local development.
- `.env.production`
  Used automatically during production builds.
- `.env.example`
  Template file for new environments.

### Frontend variables

- `VITE_API_BASE_URL`
  Base URL for the deployed API.
- `VITE_HUB_URL`
  Full SignalR hub URL.
- `VITE_DEV_PROXY_TARGET`
  Local API target used by the Vite dev server proxy.

## Frontend Deployment

### Local development

1. Set `frontend/.env.development`
2. Run:

```bash
npm install
npm run dev
```

### Production build

1. Set `frontend/.env.production`
2. Run:

```bash
cd frontend
npm install
npm run build
```

The production build output is generated in `frontend/dist`.

## Current Production API

The current production API base URL is:

`https://sandesaapi-emgacxb7audcfcdq.westus2-01.azurewebsites.net`

