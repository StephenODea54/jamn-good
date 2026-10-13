# Jamn Good

The Jamn Good website: an Astro site that runs on Cloudflare Workers, with content managed in
[EmDash](https://docs.emdashcms.com/).

## Editing content

Sign in at **`/_emdash/admin`**. Changes go live as soon as you **publish** them; saved drafts stay hidden.

| Collection | What it controls |
| --- | --- |
| **Products** | Everything in the shop: name, price, type (jam or baked: picks the **Jams** or **Baked Goods** tab), whether it's a limited run (also lists it under **Limited**), photos, description, ingredients, storage. **Homepage position** (1 to 4) puts a product in the homepage row; leave it blank to keep it off the homepage. **Shop order** sets the order on the Shop page. |
| **Events** | Markets and craft shows on Where to Find Us. Past events hide themselves. |
| **Stores** | Shops that carry Jamn Good. |
| **FAQs** | Questions and answers on the FAQ page (answers support links). |
| **Treats** | Baked goods listed in the homepage Cookies & Treats section. |
| **Site Details** | Contact email and social links. Instagram/Facebook icons only appear when their URL is filled in. |
| **Newsletter Subscribers** | Everyone who joined through the "Stay in the Loop" form, with when and where they signed up. Private; never shown on the site. Export them to an email service when you start sending newsletters. |

Ratings, review counts, ingredients and storage are optional. If they're blank, that part of the
product page is hidden.

The page design (layout, headings, homepage copy) lives in the code under `src/`.

## Online orders (Stripe)

Checkout uses Stripe's hosted Checkout page; card details never touch this site. Orders are
**local pickup only**: Stripe collects the customer's name, email, phone and optional pickup notes,
and the thank-you page shows the pickup instructions from **Site Details**.

- Prices and names are read from EmDash when checkout starts, so the cart can't change what's
  charged.
- **No sales tax** is charged: Ohio doesn't tax cottage food sold to be eaten off-site, and
  orders are pickup only. Stripe Tax is not used, so leave it off in the Stripe dashboard (it
  charges a fee per transaction).
- New orders appear in Stripe under **Payments**. Turn on email alerts for successful payments in
  Stripe's notification settings.

### Orders in the admin

Every paid order is also saved to **Orders** in `/_emdash/admin`, a pickup to-do list with the
customer's name, email, phone, items, total, pickup notes and a link to the payment in Stripe.
Change **Status** as you go (new → contacted → ready → picked up). Orders stay unpublished, so
customer details never appear on the site.

Orders are saved two ways, so none are missed: when the customer reaches the thank-you page, and
by a Stripe webhook (for customers who close the tab before the redirect). To set up the webhook
on the live site:

1. In Stripe, go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://<your-site>/api/stripe-webhook`.
3. Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Copy the endpoint's **signing secret** (`whsec_...`) and run
   `pnpm wrangler secret put STRIPE_WEBHOOK_SECRET`.

Locally, the thank-you page is enough. To test the webhook too, run
`stripe listen --forward-to localhost:4321/api/stripe-webhook` with the
[Stripe CLI](https://docs.stripe.com/stripe-cli) and put the `whsec_...` it prints in `.dev.vars`
as `STRIPE_WEBHOOK_SECRET`.

Secrets: `STRIPE_SECRET_KEY` goes in `.dev.vars` locally (restart `pnpm dev` after changing it)
and in `pnpm wrangler secret put STRIPE_SECRET_KEY` for the live site. Use the `sk_test_` key
until you're ready to take real payments. Test card: `4242 4242 4242 4242`, any future date, any CVC.

## Running it locally

Requires Node 22.16+ and pnpm.

```sh
pnpm install
pnpm dev
```

On first run, open
<http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin>. It creates the
content types and starting content from `seed/seed.json` and signs you in as a local admin (this
shortcut only works in local development). Then attach the product photos:

```sh
# token from http://localhost:4321/_emdash/api/setup/dev-bypass?token=1
EMDASH_TOKEN=ec_pat_... node scripts/load-content.mjs
```

`scripts/load-content.mjs` adds any products from `seed/seed.json` that the site doesn't have yet
and attaches their photos from `public/images/products` (`<slug>.jpg` for the shop,
`<slug>-tall.jpg` for the product page, `<slug>-home.jpg` for the homepage). It never overwrites
existing entries or photos, so it's safe to re-run. Pass other collection names to load those too,
e.g. `node scripts/load-content.mjs products site_details`.

Local content lives in `.wrangler/` and is separate from the live site.

## Deploying to Cloudflare

Needs a **Workers Paid** plan: the compressed Worker is about 4.7 MB, over the free plan's 3 MB
limit. The site is served at **jamn-good.com**; `www.jamn-good.com` redirects there. Both are set
in `wrangler.jsonc`, and Wrangler creates their DNS records.

1. `pnpm wrangler login`
2. `pnpm run deploy`. The first deploy also creates the D1 database, R2 bucket and session store.
3. Set the secrets (each command asks for the value; it takes effect immediately):
   - `pnpm wrangler secret put EMDASH_ENCRYPTION_KEY`: the same value as in `.dev.vars`. Keep a
     backup somewhere safe; losing it makes stored secrets unreadable.
   - `pnpm wrangler secret put STRIPE_SECRET_KEY`: the `sk_test_` key until you're ready to take
     real payments, then the `sk_live_` key.
4. **Straight away**, open `https://jamn-good.com/_emdash/admin` and finish the setup wizard.
   Whoever finishes it first becomes the administrator. Choose to include the sample content:
   that loads the products, events, FAQs and so on from `seed/seed.json`.
5. Create an API token in the admin (your user settings → API tokens). With it set as
   `EMDASH_URL=https://jamn-good.com EMDASH_TOKEN=ec_pat_...` in front of each command:
   - `node scripts/sync-schema.mjs` adds any collections or fields from `seed/seed.json` the site
     doesn't have yet (content types are only created once, at setup; run this whenever the seed
     gains a collection or field).
   - `node scripts/load-content.mjs products site_details events stores faqs treats` loads the
     starting content and product photos (also works if you skipped the sample content).

   Both only add what's missing, so they're safe to re-run. Delete the token afterwards.
6. Set up the Stripe webhook (see **Orders in the admin** above) and store its signing secret with
   `pnpm wrangler secret put STRIPE_WEBHOOK_SECRET`.

Later updates are just `pnpm run deploy`; content edited in the admin is untouched.

Sign-in uses passkeys. Email sign-in links need Cloudflare Email Sending set up first (see the
EmDash Cloudflare deployment guide).
