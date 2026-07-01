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
    scripts/services/loyaltyOSService.js   # HTTP service (LocalServiceRegistry)
    scripts/loyalty/OrderPayload.js        # SFCC order -> canonical payload (matches the mapping template)
    scripts/loyalty/LoyaltyExport.js       # export one order (idempotent server-side by order_no)
    scripts/jobs/ExportOrders.js           # job step custom.LoyaltyOS.ExportOrders (primary path)
    scripts/hooks/orderHooks.js            # optional OCAPI afterPOST hook (headless orders)
    hooks.json
    steptypes.json                         # job step definition
  .project
metadata/
  system-objecttype-extensions.xml         # site prefs (LoyaltyOS group) + Order.loyaltyExportStatus
  services.xml                             # service / profile / credential definitions
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

## How it works
- **Primary — job.** `custom.LoyaltyOS.ExportOrders` scans orders created within a lookback window that
  aren't yet `EXPORTED`, builds the payload, and POSTs each to `{endpoint}/api/v1/orders`. Idempotent
  server-side by `order_no`, so overlap is harmless; works regardless of checkout path.
- **Optional — hook.** `dw.ocapi.shop.order.afterPOST` marks OCAPI/SCAPI-created orders for prompt pickup.
- **Auth** via the `loyaltyos.http.ingest` service: `Authorization: ApiKey <key>`.

## CI/CD
`.github/workflows/deploy.yml` is a **starter stub** using `sfcc-ci`: it packages a code version, then
`code:deploy` + `code:activate`. It needs repo secrets `SFCC_CLIENT_ID`, `SFCC_CLIENT_SECRET`,
`SFCC_INSTANCE`, and an Account Manager API client with WebDAV/OCAPI permissions. Metadata import is
left as a documented TODO (package `metadata/` into the site-import structure, then `instance:import`).

## Cancellations & refunds (extension)
This reference covers order **accrual** export. For **cancel/refund**, add a status-change job/hook that
POSTs to the platform reversal endpoints (void / proportional refund) keyed by `order_no` — see the
LoyaltyOS [developer docs](https://loyalty.marketing.aetherprojects.net/developer.html) for the reversal API.

## Switching to OAuth2 client credentials
Instead of the API key, add a token service that fetches a client-credentials bearer token and set
`Authorization: Bearer <token>` in `loyaltyOSService.js` (cache until expiry). API key is the simplest
starting point and is fully supported by the platform.
