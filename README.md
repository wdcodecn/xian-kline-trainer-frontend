# Xian K-Line Trainer Frontend

TanStack Start frontend for the Xian K-line replay trainer.

## Stack

- React 19
- TanStack Start
- TanStack Query
- Vite
- Lightweight Charts

## Local development

```bash
npm install
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

## Production build

```bash
npm install
VITE_API_BASE_URL=https://xian-api.example.com npm run build
npm run start
```

## Docker

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:8080 -t xian-kline-trainer-frontend .
docker run --rm -p 3000:3000 xian-kline-trainer-frontend
```

## Important environment variables

- `VITE_API_BASE_URL`
