# Deploying Vinyl Periphery

The site runs on Vercel:

- The frontend is built by Vite and served as static files from
  `frontend/dist`. `vercel.json` sends every non-`/api` path to `index.html`
  so React Router can handle `/library` and `/results/...` on a refresh.
- Each file in `api/` is a Vercel Function. The logic lives in
  `backend/handlers/` so the Express server can run the same code locally.

Heroku keeps working from the same code until the domain is switched, so the
move has no downtime.

## 1. Create the Vercel project

1. In Vercel, **Add New → Project** and import
   `EricLusk-Jopson/vinyl-periphery`.
2. Leave **Root Directory** as the repo root and **Framework Preset** as
   **Other**. `vercel.json` sets the install command, build command and
   output directory, so leave those overrides off.
3. Under **Environment Variables**, add:

   | Name | Value | Environments |
   |---|---|---|
   | `CONSUMER_KEY` | Discogs consumer key | Production, Preview |
   | `CONSUMER_SECRET` | Discogs consumer secret | Production, Preview |

   Analytics adds two more; see `docs/analytics.md`.
4. Deploy. Production deploys come from `main`; every other branch and pull
   request gets its own preview URL.

The Hobby plan is enough. Vercel's fair use rules restrict Hobby to
non-commercial use but say asking for donations does not count as commercial,
so the Buy me a coffee link is fine.

## 2. Check the preview

On the `*.vercel.app` URL:

- [ ] Home loads with fonts and styles.
- [ ] A full search runs and opens its results.
- [ ] Refreshing `/library` and a `/results/...` page loads the page, not a 404.
- [ ] `/api/health` returns `{"status":"ok", ...}`.
- [ ] `/api/search?band=Talk%20Talk&album=Spirit%20of%20Eden` returns Discogs
      results, not `Search is not configured`.

## 3. Switch the domain

Keep the domain's DNS at Namecheap. Change only the website records, so email
records are untouched.

1. In Vercel, **Settings → Domains**, add the apex domain and `www`. Vercel
   shows the records to create and offers to redirect one to the other.
2. In Namecheap, **Domain List → Manage → Advanced DNS**:
   - Delete the records that point at Heroku (an `ALIAS` or `CNAME` to a
     `herokudns.com` host, or a URL redirect record).
   - Add the **A** record for `@` with the IP Vercel shows (usually
     `76.76.21.21`).
   - Add the **CNAME** record for `www` with the host Vercel shows for this
     project.
   - Leave `MX`, `TXT` (SPF, DKIM, DMARC, verification) and any mail `CNAME`
     records alone.
3. Don't switch the nameservers to Vercel. If you ever do, copy every mail
   record across first, or email stops working.

Vercel issues the HTTPS certificate once the records resolve, usually within
minutes. Old DNS answers can be cached for up to the record's TTL.

## 4. Retire Heroku

After a week on Vercel with no problems:

1. Scale the Heroku dynos to zero, then delete the app.
2. Remove `heroku-postbuild` and the production static-serving branch in
   `backend/server.js`. Keep the Express server for local development, or
   switch local development to `vercel dev`.

## Local development

```
npm install && npm run install-client
npm run server   # API on :5000, with CONSUMER_KEY and CONSUMER_SECRET in .env
npm run client   # Vite on :5173, proxies /api to :5000
```

`vercel dev` also works and runs the `api/` functions directly.
