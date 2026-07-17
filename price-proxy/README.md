# TaxTracker price proxy

A tiny [Cloudflare Worker](https://workers.cloudflare.com/) that fetches the
**previous trading day's closing price** for a share and hands it back to
TaxTracker.

## Why this exists

TaxTracker is a static website (it runs entirely in your browser, with no
server of its own). Browsers refuse to let a website read price data directly
from Yahoo Finance — a security rule called **CORS** blocks it. This Worker
sits in the middle: it runs on Cloudflare's servers (where CORS doesn't
apply), fetches the price, and returns it to TaxTracker. No API key is needed.

## One-time deploy (about 5 minutes)

You'll do this once. You need a free Cloudflare account.

1. Install the Cloudflare command-line tool (`wrangler`):

   ```bash
   npm i -g wrangler
   ```

2. Log in — this opens your browser to approve access:

   ```bash
   wrangler login
   ```

3. From this folder, deploy:

   ```bash
   cd price-proxy
   wrangler deploy
   ```

The **free tier is plenty** — it allows 100,000 requests per day, and
TaxTracker makes a handful.

## After deploying

`wrangler deploy` prints a URL that looks like:

```
https://taxtracker-price-proxy.<your-subdomain>.workers.dev
```

1. **Copy that URL.**
2. Open TaxTracker, go to the **Share Schemes** screen, open **Price
   settings**, and paste the URL into the **Price proxy URL** field. It's
   saved in your browser only — nothing is sent anywhere else or committed to
   any repo.
3. Set the **Ticker symbol** if needed (defaults to `SAP.DE` — SAP on the
   German XETRA exchange).

## If your GitHub Pages address is different

The Worker only answers requests from an approved list of website addresses
(the CORS allowlist). It already includes:

- `https://spitefulgrain40.github.io` (your GitHub Pages site)
- `http://localhost:5173` (local development)

If your Pages URL is different, edit the `ALLOWED_ORIGINS` array near the top
of `src/worker.js`, then run `wrangler deploy` again.

## A note on currency

The Worker returns the price **exactly as Yahoo reports it**, along with the
currency code. For `SAP.DE` (XETRA) that currency is **EUR** — and that is the
correct, native figure for shares held in the EquatePlus broker portal.

You can optionally ask the Worker to also return a conversion rate so
TaxTracker can show a **GBP reference figure at today's rate**. Add the
`fxFrom` and `fxTo` query parameters:

```
?symbol=SAP.DE&fxFrom=EUR&fxTo=GBP
```

Both must be 3-letter currency codes (e.g. `EUR`, `GBP`, `USD`). When present,
the Worker fetches the live rate from
[Frankfurter](https://frankfurter.dev/) (European Central Bank data, no key
needed) and adds it to the response as `fx: { from, to, rate, date }`. If the
parameters are missing or the rate can't be fetched, `fx` is `null` and the
price is still returned — FX never fails the whole request.

The GBP figure is a **reference conversion only**. UK Capital Gains Tax is
legally calculated using the exchange rate on the actual purchase and sale
dates, not today's rate, so treat the live GBP value as a display convenience
rather than a filing figure.

## Security

The `symbol` parameter is checked against a strict allowlist pattern
(`^[A-Z0-9.\-]{1,15}$`) before anything is fetched, so this Worker can't be
abused as a general-purpose open proxy — it can only look up share tickers.
