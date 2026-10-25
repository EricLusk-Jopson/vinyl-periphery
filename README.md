# Vinyl Periphery

Find the albums hiding in your liner notes. Enter an album you love and Vinyl
Periphery traces everyone credited on it, from session players to engineers and
producers, then ranks the other albums they worked on by how many of those
people they share.

Data comes from the [Discogs API](https://www.discogs.com/developers). This
project is not affiliated with Discogs.

## Running locally

You need a Discogs consumer key and secret. Put them in `.env` at the repo root:

```
CONSUMER_KEY=...
CONSUMER_SECRET=...
```

Then:

```
npm install
npm run install-client
npm run server        # backend on :5000
npm run client        # frontend on :5173
```

Frontend checks, from `frontend/`: `npm run lint`, `npx tsc -b`, `npm test`,
`npm run build`. Backend tests, from the root: `npm test`.

## Deployment

The site deploys to Vercel: the frontend as static files and each endpoint in
`api/` as a function. See [docs/deploy.md](docs/deploy.md).

## Feedback

Bugs and feature requests go to
[vinyl-periphery-feedback](https://github.com/EricLusk-Jopson/vinyl-periphery-feedback).
