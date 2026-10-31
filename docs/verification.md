# Verification record

Verified locally on 31 October 2026. This record distinguishes executed checks from supplied deployment templates.

## Initial sample-mode checks (historical)

| Layer | Result |
|---|---|
| React/esbuild production bundle | Built successfully with the npm lockfile |
| Spring/JUnit | **25 tests passed**, zero failures/errors/skips |
| Packaged application | Executable jar starts with the persistent H2 catalogue; 10 sample listings |
| Live Postman collection | **12 requests, 25 assertions passed**, no failed requests/assertions |
| Chrome desktop | Search, comparison, listing disclosure/history, shortlist persistence, no-key interpretation and feedback exercised |
| Chrome 390 × 844 | Expandable filters, optical-disclosure filter, comparison limit, dialog and responsive layout exercised; document width equals viewport width |
| Failure/recovery | Local server deliberately stopped; catalogue displayed a retry action. After restarting, Retry restored the filtered catalogue without losing the shortlist |
| Shared comparison | Copied comparison URL; reloading reopened the expected comparison |

Backend coverage includes duplicate batch replay, concurrent replay, batch ID conflicts, same-timestamp observation conflicts, model/mount distinctions, conservative missing-data handling, late updates, rejected-row recovery, duplicate rows, variant-scoped history, stale-data behavior, literal search filters, pagination counts, sold/unknown availability, clear-optics filters, closed owner endpoints, anonymous event allowlisting, concurrent AI quota reservations, malformed AI output, provider failure, explicit no-AI consent, exhausted quota, and repeatable demo startup.

Two issues found during verification were corrected: nested nullable numeric expressions prevented the full demo from starting, and an outage left the old result count visible above the error. Demo startup now has a regression test. UI errors now replace the result count with an unavailable state.

Chrome testing additionally confirmed that selecting three listings disables a fourth selection; an unknown model prevents a matching-variant verdict; different fungus disclosures remain visible for matching models; a local shortlist survives reload; and the no-key query `Sigma zoom below ₹40,000` yields reviewed brand/zoom/budget filters and two matching sample listings.

The runtime uses the same real API and SQL backend shown in the source. There is no browser-only fake backend. At that initial sample-mode stage, no real dealer connection, purchase, account or AI call was used. Real-source verification is recorded below.

## Reproduce

```sh
cd backend
mvn test
```

After starting an isolated demo instance:

```sh
postman collection run tests/secondglass.postman_collection.json --no-report-events
```

On the development machine the CLI is at `/Users/dhrkamra/.local/bin/postman`. The CLI's report-export option required login, so verification used local console results with cloud event reporting disabled. A copy of that local output is in `reports/postman-run.txt`. The suite intentionally records one test feedback vote. Browser verification also contributes demo usage counts; these are not real-user adoption metrics.

The machine's Maven settings referenced an unavailable proxy; development used a temporary empty settings file and an isolated dependency cache. This machine-specific workaround is not required by the application itself. Mockito's subclass mock maker avoids requiring JVM agent attachment for these tests.

## Not verified / remaining boundaries

* PostgreSQL runtime parity, Docker build/run, and Kubernetes deployment: templates only; Docker daemon was unavailable. They must be tested before deployment.
* The GitHub Actions workflow is supplied for a future repository; it has not run on GitHub. The local build and test commands were executed directly.
* Live AI provider: the adapter and failure behavior were tested with mocks; no paid request or free-tier availability was verified.
* Formal dealer data partnerships, real item photographs and recurring network refresh schedules: not implemented. Public-page collection is verified below.
* Production load, multi-instance ingestion throughput, security review, screen-reader audit and cross-browser/device coverage: not claimed. Chrome checks are targeted interaction checks, not a full accessibility certification.
* No measured real-world model-matching precision/recall: conservative deterministic rules are tested on synthetic fixtures, not a labelled external retailer corpus.

## Real-source update — 31 October 2026

- Collected and refreshed 24 genuine public-page offers across Tapprs, Amazon India, RK Deals, Camera Club India and ShopAtSC. Real mode is now the default; the old demo database is preserved.
- **28 Java tests passed** on Java 17, including snapshot replay, atomic rollback of rejected snapshots, and disappearance handling with retained history.
- **7 Python adapter tests passed**: exact fractional prices, stock per variant, currency rejection, excluding Amazon MRP/coupon/accessory prices, retaining old timestamps on failure, conservative optical disclosures, and separating a lens manufacturer from its camera mount.
- **15 read-only live API checks passed**, including real HTTPS links, five-source coverage, new/used/store/stock filters and a cross-retailer FE 50mm comparison. See `reports/live-api-checks.txt`.
- React production bundle rebuilt. Packaged application started on port 8086 with real data. Automatic local snapshot reload was exercised by collecting a corrected second snapshot.
- Chrome desktop checks: actual seller names/prices, direct destination links, Amazon-only new results, the five-source coverage dialog, and a same-variant comparison across Tapprs, RK Deals and Amazon with distinct new/used labels. The earlier mobile checks above were against sample mode; responsive viewport override did not take effect during this update, so a fresh mobile check is not claimed.
- No order placed, account created, dealer message sent, paid provider called or cloud deployment performed. Source access worked without bypassing challenges. Extraction reads bounded public pages, not official marketplace feeds.

Reproduce adapter tests with `python -m unittest discover -s tools -p 'test_*.py' -v`; with the real local server running, use `python tests/live-smoke.py`. The existing Postman collection remains a **demo-only** suite and its previous 25 assertions should not be interpreted as a run against this real catalogue.

## Seller-link and new-retailer update — 31 October 2026

- Tapprs’ public GET search was verified: `/sale?q=FE+50mm+F1.8` returned only the Sony FE 50mm model. No individual sale-card product link was exposed. Cards and details now use model search, label it “Find this lens” and surface the observed item ID. Original observation provenance is retained.
- Added actual new-lens product observations from Flipkart, Srishti Digilife and Pooja Electronics. Current snapshot: **28 offers across eight sources** (the refreshed Amazon search also returned a fifth reviewed ASIN).
- **9 source-parser tests passed**, including separate identification of the APS-C SEL50F18/BC and full-frame SEL50F18F despite different retailer title formats. **15 live API checks passed**, updated for eight sources. Three additional live queries confirmed the new retailers’ purchase type, model code, price and stock.
- Frontend bundle and executable jar rebuilt; Chrome verified the new Tapprs URL/item ID and expanded store list. No Java business logic changed in this update; the previous 28-test Java result remains the latest backend run.

## Retail-only update — 31 October 2026

Supersedes the earlier Tapprs integration described above. The current snapshot contains **24 offers across nine sources**, with Tapprs removed. Added Cashify's two explicitly sold-out refurbished grade variants and Dacby's pre-owned Canon EF-S lens. Chrome confirmed Dacby's Add to Cart and Buy Now controls; no purchase was performed.

- **34 Java tests passed**, including existing-source removal with history retention, inactive detail/comparison rejection, exact retailer-host validation and mount filtering.
- **12 Python parser tests passed**, including ProductGroup variants, conflicting warranty claims and Canon used-lens classification.
- **20 read-only live API checks passed**, covering nine sources, no Tapprs destination, refurbished policies and mount separation.
- Frontend and jar rebuilt; existing local database reloaded. Chrome verified Tapprs absent from the store selector, Dacby's direct product destination, and Cashify's sold-out/warranty-confirmation labels.
- Screenshots: `preview/retail-only.png` and `preview/retail-refurbished.png`. No new mobile or cloud deployment verification is claimed.

The source shortlist review is in `source-review.md`. Incomplete or inaccessible candidates are not represented by fabricated listings.

## Fotocentre, Just Canon and photo-free cards — 31 October 2026

- Both requested sources added using ordinary public HTTPS product reads; no browser impersonation or challenge bypass. Snapshot now contains **26 selected offers across 11 sources**. Network refresh remains on demand.
- Fotocentre: Sony FE 50mm f/1.8, ₹21,199 (not ₹22,990 MRP); Just Canon: Canon RF 50mm f/1.8 STM, ₹18,995. Both source pages expose Add to Cart and in-stock status. Browser verified their direct product destinations, without placing orders.
- **15 parser tests passed**, including exact offer-versus-list pricing, retailer/manufacturer distinction, Canon mount separation, accessory rejection and retained timestamps on failures.
- **34 Java tests passed** and **23 read-only live API checks passed**. Frontend and executable jar rebuilt and the local server restarted.
- Removed the generic lens SVG component from cards and details. Cards now have a compact condition/save header and text content. No product photographs or placeholder art remain; functional icons and price-history charts remain.
- Chrome verified Fotocentre card and details, Just Canon via Canon RF filter, both new stores in the selector and the photo-free layout. Screenshot: `preview/text-only-retailers.png`. No fresh mobile verification is claimed.

## Sold-out defaults and product ratings — 31 October 2026

- Sold-out results excluded by default; the explicit Show sold-out listings filter restores reference offers. Listed in stock remains stricter and excludes UNKNOWN. Existing offer details/history remain accessible for active sold-out records.
- Refreshed snapshot: 25 offers across 11 stores (Amazon returned four reviewed ASINs this time), with 10 in stock, 11 sold out and four unknown. Seven offers carry product scores and exact counts from their source; no cross-store averaging or seller-rating inference.
- 38 Java tests, 19 parser tests and 29 live API checks passed. Tests cover invalid scores/counts, exact versus abbreviated counts, organization-versus-product aggregates, late updates, removal of missing ratings, legacy fingerprint compatibility and stock filter precedence.
- Existing H2 database was backed up locally before V3 migration. The executable app started successfully with the migration and current snapshot. No PostgreSQL or Kubernetes runtime validation is claimed.
- Chrome verified Amazon's linked score/count labels and Cashify's transition from zero results by default to two explicitly sold-out results on opt-in. Generic lens pictures remain absent. Screenshot: preview/product-ratings.png.
- Amazon availability remains UNKNOWN because this adapter observes search result prices and does not verify seller/variant/PIN-code-specific delivery. Unknown is not classified as sold out or in stock.

## Nikon, Fujifilm, Sigma and Tamron expansion

- Refreshed 32 real offers across 12 configured stores: 12 in stock, 11 sold out, five backorders and four unknown-stock Amazon listings. All 12 source refreshes succeeded. This is selected coverage, not full inventory.
- Added Fujifilm X India's XC35mmF2 and Fotocentre's Nikon Z 35mm f/1.4, Sigma 12mm DC in three mounts and Tamron 70–300mm in two mounts. Brand/mount filters and AI-filter validation now support Nikon and Fujifilm.
- 40 Java tests, 25 parser tests and 35 read-only local API checks passed; production React build and executable package succeeded. Reports: `reports/retail-backend-tests.txt`, `reports/source-tests.txt`, `reports/live-api-tests.txt`.
- Regression coverage includes mount-specific prices/URLs, crop coverage on Canon RF, compact Fujifilm model names, rejection of ambiguous mounts, exact-variant backorder extraction, and backorders excluded from in-stock results.
- Chrome verified the Nikon result, two Tamron prices with distinct mount links, the Nikon Z mount filter and in-stock exclusion. Fujifilm's source page showed its price and Add to cart. No purchase, login, account creation or customer data collection was performed.
- Additional chains are not represented as integrated: Croma ordinary fetches return 403 and availability depends on location; Reliance's rendered unavailable state conflicts with JSON-LD InStock; no eligible standalone Vijay Sales lens page was verified. See `docs/source-review.md` for exact source evidence and distributor limitations.
- No schema migration was needed. The existing database and observation history were preserved. PostgreSQL, Docker, Kubernetes and public deployment remain unverified, as before.
