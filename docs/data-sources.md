# Real source coverage

The default snapshot contains **32 actual public-page offers from twelve sources**, collected on 31 October 2026. This pilot covers selected Sony, Canon, Nikon, Fujifilm, Sigma and Tamron lenses, not exhaustive coverage of all Indian websites or all products on each platform.

| Source | Offers | Extraction and destination |
|---|---:|---|
| [Fujifilm X India](https://fujifilmxindia.com/products/fujifilm-xc35mmf2) | 1 | XC35mmF2, ₹19,500, in stock at collection. Fujifilm X / APS-C. [Manufacturer-linked authorised e-commerce store](https://www.fujifilm-x.com/en-in/shop/online/); direct variant checkout. |
| [Foto Centre India](https://fotocentreindia.com/product/sony-fe-50mm-f1-8-lens-in-mumbai-india/) | 7 | Sony FE 50mm ₹21,199 and Nikon Z 35mm f/1.4 ₹47,490 in stock; Sigma 12mm DC in Sony E, Fujifilm X and Canon RF mounts at ₹49,000 on backorder; Tamron 70–300mm in Nikon Z at ₹37,990 and Sony E at ₹45,300 on backorder. Exact mount links and prices remain separate. |
| [Just Canon](https://www.justcanon.in/products/canon-rf-50mm-f-1-8-stm) | 1 | New Canon RF 50mm f/1.8 STM, ₹18,995 at collection; direct variant URL and Add to Cart. Manufacturer is Canon despite store name in brand metadata. |
| [Cashify](https://www.cashify.in/buy-refurbished-camera-lens/renewed-sony-fe-2-28-mm) | 2 | Refurbished Sony FE 28mm, separate Good/Superb grade product URLs. Both sold out. Conflicting 1/6-month warranty and refund claims remain unconfirmed. |
| [Dacby](https://dacby.com/buy/camera-lens/canon-ef-s-55-250mm-f40-56-is-ii-telephoto-zoom-lens-mIlHbTTZRy89fBz545Su) | 1 | Pre-owned Canon EF-S 55–250mm IS II, ₹6,999 at collection. Product page shows Add to Cart and Buy Now. Exchange-only language is not treated as a refund period. |
| [Flipkart](https://www.flipkart.com/sony-sel50f18-bc-lens/p/itmf3xjg4jvafmwz) | 1 | New APS-C E 50mm F1.8 OSS; product JSON-LD. This is not the full-frame FE 50mm model. |
| [Srishti Digilife](https://www.srishtidigilife.co.in/products/sony-fe-50mm-f-1-8-lens) | 1 | New FE 50mm F1.8, manufacturer SKU identifies the variant; direct variant link. |
| [Pooja Electronics](https://poojaelectronics.in/product/sony-50mm-f1-8-lens-online-buy-mumbai-india/) | 1 | New FE 50mm F1.8; product price and stock, excluding the separate list-price field. |
| [Amazon India](https://www.amazon.in/s?k=sony+50mm+f1.8+lens) | 4 | Reviewed Sony/Sigma ASINs and displayed search-result prices, with direct product links. MRP and conditional coupons excluded. Stock and actual merchant require confirmation. |
| [RK Deals](https://www.rkdeals.co.in/product-page/sony-fe-50mm-f-1-8-prime-lens-for-sony-e-mount-full-frame-cameras) | 1 | Product JSON-LD price and stock; direct product page. |
| [Camera Club India](https://cameraclub.in/pages/lens) | 9 | Three Sony products; separately priced condition variants retain variant URLs and stock states. |
| [ShopAtSC](https://shopatsc.com/collections/camera-lenses) | 3 | New Sony product data. Sold-out prices are explicitly labelled. |

Counts reflect the committed snapshot and change after refresh. The **Stores & coverage** panel reflects the loaded snapshot. No partnership, affiliate relationship, inspection or exhaustive search is claimed. Purchases happen on the seller site. Product cards and details use no photographs or placeholder illustrations. Seller photos, reviews and long product descriptions are not reproduced.

## Refresh and failure handling

Install `tools/requirements.txt` and run `python tools/refresh_sources.py`. It reads fixed reviewed URLs, with timeouts, response-size bounds and small request delays. It does not use credentials, scraping proxies, identity rotation or challenge bypass. Missing expected data, foreign currency or access failure fails that source instead of creating a guessed price.

All configured pages for a source must parse before replacing its snapshot. A failed source retains previous rows at their original observation times; check time and successful observation time are separate. The collector atomically replaces `catalogue/live.json`; Java checks the local file every minute. Reload the browser to update coverage information. Network collection is **on demand**, not a recurring crawler. The 24-hour stale label is not a freshness guarantee.

Successful source snapshots hide disappeared listings without declaring them sold or deleting history. Changes to the configured source scope need review because reducing the scope can hide older offers. Source errors remain visible in the coverage panel; raw diagnostics stay in the local snapshot.

## Matching and disclosure boundaries

The FE 50mm F1.8 mapping to SEL50F18F is reviewed against [Sony specifications](https://www.sony.co.in/electronics/camera-lenses/sel50f18f/specifications). The APS-C E 50mm F1.8 OSS is a [different model](https://www.sony.co.in/electronics/camera-lenses/sel50f18/specifications). Incomplete metadata on other products stays incomplete and cannot produce a confident cross-seller match. Display names are not proof of interchangeability.

“Good” or “Excellent” does not mean fungus-free or scratch-free: undisclosed optical fields remain `UNKNOWN`. Missing shipping, warranty and returns remain null. New, used and refurbished are separate filters and comparison rows. Camera Club grade variants are not separately identified physical copies. Amazon observations are platform product listings; the merchant may change between observations. Checkout totals may differ by location, shipping, coupon or eligibility.

## Owner import

`POST /api/admin/import` is disabled unless `ADMIN_TOKEN` is configured. Use `Authorization: Bearer <token>` and `{ "batchId": "unique-id", "observations": [...] }` with 1–200 rows matching `SourceObservation`. `catalogue/live.json` contains real examples, but its outer wrapper also contains `sources` and `generatedAt`, so the whole file is not an API request body.

Identical batch replay is idempotent. Reusing a batch ID for different data fails. Equal observation times with conflicting data are quarantined. The owner batch API commits valid siblings and does not reconcile disappeared listings. The local snapshot loader adds a transaction: any rejected row rolls back the complete snapshot update.

Prices use integer INR paise, including fractional rupees. `listingType` is `NEW`, `USED` or `REFURBISHED`; legacy imports default to `USED`. Optical states are `PRESENT`, `ABSENT` or `UNKNOWN`; stock is `IN_STOCK`, `OUT_OF_STOCK`, `BACKORDER` or `UNKNOWN`. Numeric unknowns are null. Every real row has `demo:false`, an actual successful retrieval time and an HTTPS destination.

## Extending coverage

Contribute a bounded adapter with source-specific tests, stable item/variant identity, exact INR prices, verified destination links and a reviewed model mapping. Prefer official feeds when available. Review source terms and reuse rights before operating at larger scale; this repository does not grant third-party rights. No seller outreach was performed.

UI research: [ClickYiz](https://www.clickyiz.com/), [UsedLens](https://used-lens.com/) and [gebraucht.io](https://gebraucht.io/). Components are original.

## Retail-only admission

`backend/src/main/resources/retailers.json` is the shared source and exact HTTPS hostname registry. Real imports reject unregistered sources and mismatched destinations. Each adapter is reviewed for individual retail product destinations and a checkout purchase path; the registry does not automatically discover or certify new shops. Sold-out variants remain clearly labelled reference prices.

Tapprs is excluded at the user's request. Old Tapprs rows are deactivated on snapshot load, preserving private observation history; public detail and comparison endpoints no longer expose inactive offers. Facebook, OLX, Quikr, community classifieds, private sellers, rentals and enquiry-only catalogues are excluded. Marketplace checkout is permitted, but inclusion does not certify the merchant, brand authorization or India warranty.

Live owner imports cannot submit demo rows. New source candidates and outstanding checks are documented in [source review](source-review.md).

Fotocentre and Just Canon were added after successful ordinary HTTPS reads and browser checkout-control verification. Earlier Fotocentre fetch errors were transient; no bypass or proxy was used. Just Canon remains a one-product adapter; Fotocentre now covers four product families and seven mount offers. Explicit Canon RF, RF-S, EF and EF-S parsing keeps mounts distinct; only populated mounts are offered in the UI. Accessory titles (adapters, caps, filters, hoods and extenders) are rejected. Unknown manufacturer codes and policies remain unconfirmed.

## Availability and product reviews

The catalogue API defaults to `includeSoldOut=false`. The UI exposes **Show sold-out listings** for reference prices; **Listed in stock** excludes unknown stock and backorders as well. Direct details and saved comparison links retain active sold-out offers and their history. No item is deleted merely because it is sold out.

`productRating` is an optional observation object: `{ "value": 4.4, "count": 7128, "countType": "ratings" }`. Only 1–5 scores and exact positive counts are accepted. The API exposes `product_rating`, `product_rating_count`, and `product_rating_count_type` alongside the offer's seller, URL and observation time. A later observation without a rating clears the displayed score; delayed observations cannot overwrite newer ratings.

Product JSON-LD aggregates are read from the exact Product object. Organization/store aggregates are excluded. A ProductGroup rating may be inherited only by its own nested product variants and is explicitly labelled as product-family evidence. `ratingCount` is preferred over `reviewCount`, and the corresponding label is preserved. Amazon scores are tied to reviewed ASIN result cards and exact accessible counts; abbreviated counts such as 7.1K are not converted into fabricated exact totals. Unsupported scales or incomplete aggregates are omitted without discarding a valid price offer.

Review coverage varies with each refresh; product-family scores may be shared by condition variants. This is source-reported data, not independent review verification. Stores may pool product variants; these scores do not establish the condition of a used copy or retailer service quality. No cross-store average or rating-based ranking is calculated.

## Expanded brand and mount handling

Selected mount URLs take priority over multi-mount family text. An ambiguous or unsupported mount is rejected rather than defaulted to Sony E. Lens manufacturer comes from the reviewed title, not the shop name or compatible camera brand. Nikon Z and Fujifilm X are separate filters; DX, DC and Di III-A crop lenses remain APS-C even when the mount supports full-frame cameras. Fujifilm GF medium-format lenses are outside this pilot.

Fotocentre WooCommerce variant stock text is checked against JSON-LD. `BackOrder` and the exact selected variation’s “Available on backorder” text become `BACKORDER`, never `IN_STOCK`. Single-product stock is read only inside the product summary, excluding related products. Backorders remain visible with an explicit label and no delivery-date promise. No manufacturer authorization or India warranty is inferred for Fotocentre; it remains labelled Retailer.


## Evidence-scoped detail extraction — 1 November 2026

`tools/listing_details.py` enriches product observations with warranty claims, conditional extensions, return categories, supplied accessories, explicit focus/stabilisation specifications, advertised India shipping rates and product review widgets. The collector additionally checks the configured retailers’ linked return-policy pages. A policy fetch failure does not discard a successful price observation, and the source status reports the policy gap. Policies are checked again during hourly refreshes; no policy duration is permanently hardcoded.

`listingDetails` contains `warrantyType`, `returnPolicy`, `returnDetails`, `ratingStatus` and an evidence list. Each evidence entry has `field`, `text`, `sourceUrl` and `scope` (`PRODUCT`, `PRODUCT_FAMILY`, `STORE_POLICY`). The observation timestamp applies to that refresh. Summaries derived from reviewed policy text are labelled store policies; they are not individual checkout guarantees. The Java import validates statuses, evidence count/size and retailer-host URLs, persists the object, and returns it as `listing_details`. Pages publishes the same structure. Delayed observations cannot replace newer evidence; a newer successful observation without details clears old details.

Warranty duration is populated only when explicit and unambiguous. Fujifilm’s conditional 2+1-year statement becomes a 24-month base duration with the registration condition preserved. Conflicting durations produce no numeric duration and expose both statements. Missing warranty extraction is labelled **Warranty not verified**. Grade charts are not evidence of a particular used item’s warranty or accessories.

Return categories distinguish restricted returns, conditional returns, replacement-only, no returns, cancellation-only information, conflicts and unknown policies. A 7-day replacement statement is not advertised as 7-day refundable returns. Refund-processing times and damage-reporting deadlines are not return windows. Opened-lens/backorder exclusions and approval requirements remain visible in linked policy summaries. Cashify’s conflicting rendered/schema refund windows remain unconfirmed.

Product-specific Judge.me and WooCommerce review widgets supplement product JSON-LD. A zero-review product widget or explicit product-review empty state is labelled **No product reviews yet**, while failed or unsupported extraction remains **Product rating unavailable**. Global shop medals and store ratings are excluded. Scores are not merged across stores.

Optical condition is read only from explicit seller-authored optical claims within a used product’s description. Generic condition charts, QC promises, customer reviews and body scratches do not establish glass condition. Family descriptions across condition variants do not establish individual-copy condition. New listings omit the used-lens optical checklist. Missing optical claims remain unknown and are labelled **Not captured**.

Some fields will remain missing: retailers may not publish them, may render them only interactively, or may contradict themselves. No AI inference is used to fill these gaps. Known manufacturer model mappings remain conservative; more specifications do not automatically establish cross-store variant equivalence.
