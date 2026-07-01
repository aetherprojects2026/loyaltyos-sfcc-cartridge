# loyaltyos-sfcc-cartridge

Reference **Salesforce B2C Commerce (SFCC / SFRA)** cartridge — `int_loyaltyos` — that exports orders to
the LoyaltyOS Order Ingestion API. Pairs with the platform-side `LoyaltySaaS.Connectors.Sfcc` module and
the `sfcc-order.mapping.json` field-mapping template.

**LoyaltyOS** — [website](https://loyalty.marketing.aetherprojects.net) · [developer docs](https://loyalty.marketing.aetherprojects.net/developer.html) · [trust & security](https://loyalty.marketing.aetherprojects.net/trust.html)

> **Status:** reference **scaffolding, not verified against an SFCC sandbox.** It uses standard `dw.*`
> APIs and the Service framework; review and test in a POD/sandbox before production. This is B2C Commerce
> code (not .NET) — it lives in its own repo, separate from the platform.

## Repository layout

```
int_loyaltyos/                     # the cartridge
  cartridge/
    scripts/services/loyaltyOSService.js   # HTTP services: ingest + reversal (LocalServiceRegistry)
    scripts/loyalty/OrderPayload.js        # SFCC order -> canonical payload (matches the mapping template)
    scripts/loyalty/LoyaltyExport.js       # export one order (idempotent server-side by order_no)
    scripts/loyalty/LoyaltyReversal.js     # build + send void/refund reversal (keyed by order_no)
    scripts/jobs/ExportOrders.js           # job step custom.LoyaltyOS.ExportOrders (accrual path)
    scripts/jobs/ExportReversals.js        # job step custom.LoyaltyOS.ExportReversals (cancel/refund path)
    scripts/hooks/orderHooks.js            # optional OCAPI afterPOST hook (headless orders)
    hooks.json
    steptypes.json                         # job step definitions (export + reversals)
  .project
metadata/
  system-objecttype-extensions.xml         # site prefs (LoyaltyOS group) + Order.loyaltyExportStatus + Order.loyaltyReversalStatus
  services.xml                             # service / profile / credential definitions (ingest + reversal)
.github/workflows/deploy.yml               # sfcc-ci deploy stub
dw.json.sample                             # copy -> dw.json for local upload (gitignored)
package.json
```

## Prerequisites
- Node.js 20+ and (for CI) the [`sfcc-ci`](https://github.com/SalesforceCommerceCloud/sfcc-ci) CLI.
- The **SFCC VS Code extension** (Prophet) for local upload/watch.
- An SFCC sandbox and Business Manager access.

## Local development
1. `cp dw.json.sample dw.json` and fill in your sandbox hostname + credentials (**`dw.json` is
   gitignored — never commit it**).
2. Upload/watch the cartridge with the SFCC VS Code extension (`npm run watch` is just a reminder).
3. Add `int_loyaltyos` to the site's **cartridge path** (BM > Sites > Manage Sites > Settings).
4. Import `metadata/system-objecttype-extensions.xml` and `metadata/services.xml` (BM > Administration >
   Site Development > Import & Export).
5. Set Site Preferences (group **LoyaltyOS**): `loyaltyOSEnabled = true`, `loyaltyOSEndpoint` (tenant API
   base URL), `loyaltyOSApiKey` (an API key minted in the LoyaltyOS portal).
6. Create a job using step `custom.LoyaltyOS.ExportOrders`; schedule it (e.g. every 15 min).
7. Create a second job using step `custom.LoyaltyOS.ExportReversals` for cancel/refund reversals;
   schedule it similarly (it shares the same `loyaltyOSEnabled` gate and lookback parameter).

## How it works
- **Primary — job.** `custom.LoyaltyOS.ExportOrders` scans orders created within a lookback window that
  aren't yet `EXPORTED`, builds the payload, and POSTs each to `{endpoint}/api/v1/orders`. Idempotent
  server-side by `order_no`, so overlap is harmless; works regardless of checkout path.
- **Optional — hook.** `dw.ocapi.shop.order.afterPOST` marks OCAPI/SCAPI-created orders for prompt pickup.
- **Reversals — job.** `custom.LoyaltyOS.ExportReversals` scans orders modified within the lookback window
  that aren't yet reversed (`Order.loyaltyReversalStatus != EXPORTED`). Cancelled orders send a **void**;
  orders with a refund send a **proportional refund** (`amount` + `currency`). Each POSTs to the LoyaltyOS
  reversal API keyed by `order_no`; the platform keys reversals to the original order and is idempotent, so
  overlap is harmless.
- **Auth** via the `loyaltyos.http.ingest` / `loyaltyos.http.reversal` services: `Authorization: ApiKey <key>`.

## CI/CD
`.github/workflows/deploy.yml` is a **starter stub** using `sfcc-ci`: it packages a code version, then
`code:deploy` + `code:activate`. It needs repo secrets `SFCC_CLIENT_ID`, `SFCC_CLIENT_SECRET`,
`SFCC_INSTANCE`, and an Account Manager API client with WebDAV/OCAPI permissions. Metadata import is
left as a documented TODO (package `metadata/` into the site-import structure, then `instance:import`).

## Cancellations & refunds (reversal path)
Alongside accrual export, the cartridge exports **reversals** so a cancel or refund reverses the loyalty
effect of the original order:

- **`custom.LoyaltyOS.ExportReversals` job** (`scripts/jobs/ExportReversals.js`) scans orders modified
  within a lookback window whose reversal hasn't been exported (`Order.loyaltyReversalStatus != EXPORTED`).
- **`LoyaltyReversal.js`** builds the payload from the SFCC `Order` (`order_no`, `type` = `void` for a
  cancelled order or `refund` for a refunded order, plus `amount` + `currency` for a proportional refund),
  POSTs it via the `loyaltyos.http.reversal` service, and stamps `Order.loyaltyReversalStatus`
  (`NOT_EXPORTED` / `EXPORTED` / `FAILED`).
- Reversals are keyed by `order_no` and are idempotent server-side, so re-running the job is safe.

Confirm the exact reversal endpoint path and payload shape against the LoyaltyOS
[developer docs](https://loyalty.marketing.aetherprojects.net/developer.html); the service currently posts
to `{endpoint}/api/v1/orders/reversals` (marked `INTEGRATION:` in `loyaltyOSService.js`), and the refund
amount is derived from the order's refund invoices — verify that source against your payment model.

## Switching to OAuth2 client credentials
Instead of the API key, add a token service that fetches a client-credentials bearer token and set
`Authorization: Bearer <token>` in `loyaltyOSService.js` (cache until expiry). API key is the simplest
starting point and is fully supported by the platform.
