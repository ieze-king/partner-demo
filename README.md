# HomeHunt (demo partner site)

A small website built the way a real Getpropool partner would build one. It shows homes from the
**Getpropool Partner API**, updates within seconds when a listing changes on Getpropool, and sends
interested visitors to the person who listed the home.

HomeHunt is fictional. It exists to demonstrate the API and to give partners working sample code.

## How it works

| Piece | File | What it does |
|---|---|---|
| API client | `lib/getpropool.ts` | Calls the Partner API from the server, with the API key kept secret |
| Webhook receiver | `app/api/webhook/route.ts` | Getpropool calls it when a listing is published, updated, changes availability or is removed, and when an enquiry is answered. Checks the signature, updates the site's copy |
| Store | `lib/store.ts` | The site's copy of the listings and a change counter, in Upstash Redis (memory when running locally) |
| Listings | `app/api/listings/route.ts` | Serves the copy; re-reads everything from Getpropool at most once a minute as a safety net |
| Live refresh | `app/api/version/route.ts` | Open pages check it every 3 seconds and reload when it changes |
| Enquiries | `app/api/enquiries` | "I'm interested" sends the visitor to the lister (`POST /enquiries`) and follows the answer |
| Page | `components/HomeHunt.tsx` | Listings, filters, the live activity panel and the enquiry form |

The API key never reaches the browser. Every webhook is checked against the signing secret.

## Set up (once)

### 1. On Getpropool

1. Sign in at **admin.getpropool.com** with a partner account and open the **Partner Portal**.
2. Create the organisation **HomeHunt (demo)**.
3. A Getpropool admin approves it in **admin → Organizations**.
4. In the portal, **API Keys → create a key**. Copy it (shown once).
5. A Getpropool admin switches on **Enquiries** for that key in **admin → API Keys**.
6. After deploying to Vercel (below), in the portal **Webhooks → add** the address
   `https://<your-vercel-address>/api/webhook` with all events ticked:
   `property.published`, `property.updated`, `property.vacancy_changed`, `property.unpublished`, `enquiry.updated`.
   Copy the **secret** (shown once).

### 2. On Vercel

1. **Add New → Project →** import the GitHub repository `partner-demo`. Framework: Next.js (detected).
2. **Storage → Create → Upstash (Redis)**, free plan, and connect it to the project. This adds
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Settings → Environment Variables:**
   - `GETPROPOOL_API_KEY` = the key from step 1.4
   - `GETPROPOOL_WEBHOOK_SECRET` = the secret from step 1.6
4. **Redeploy** so the variables apply.

## Run the demo

1. Open the HomeHunt site.
2. On Getpropool, a demo lister adds a home with photos. An admin approves it (**Verify**). It appears on HomeHunt within a few seconds.
3. The lister changes the price or a photo. HomeHunt updates on its own.
4. On HomeHunt, open the home and tap **Send to the lister**. The lister sees it on Getpropool, marked "via HomeHunt (demo)".
5. The lister taps **Available**. HomeHunt shows the reply and a WhatsApp button.
6. The lister taps **Not available** (or an admin deactivates the home). It disappears from HomeHunt.

The **Live from Getpropool** panel shows each change as it arrives and how long it took.

## Run locally

```bash
cp .env.example .env.local   # fill in the key and secret
npm install
npm run dev                  # http://localhost:3000
```

Locally, Getpropool can only reach the webhook if the site is public (for example with a tunnel), so
changes show up through the once-a-minute safety net instead.
