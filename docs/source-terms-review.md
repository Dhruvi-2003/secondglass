# Source terms and collection review

Reviewed manually on **1 November 2026 (India time)**. This records the engineering decision for the bounded, noncommercial pilot. It is not written retailer permission, a legal clearance, or an endorsement. Reading public terms and robots files is not the same as obtaining a licence. No seller outreach or permission request has been sent.

Prices are collected automatically; they have not been reclassified as manually entered data. **All collectors remain enabled at the owner's explicit request.** This review is advisory and does not implement a pause mechanism or grant collection/reuse permission.

| Retailer | Terms examined | Finding | Review finding |
|---|---|---|---|
| Amazon India | [Conditions of Use](https://www.amazon.in/gp/help/customer/display.html?nodeId=200545940) | Restriction noted | Conditions restrict collecting product listings/prices and automated extraction without permission. |
| Flipkart | [Terms of Use](https://www.flipkart.com/pages/terms) | Restriction noted | Terms explicitly restrict automated page scraping and related acquisition methods. |
| Cashify | [General terms](https://www.cashify.in/terms-conditions), [refurbished terms](https://www.cashify.in/refurbished-terms-conditions), [refurbished terms of use](https://www.cashify.in/refurbished-terms-of-use) | Restriction noted | Systematic retrieval and republication are restricted; no permission is recorded. |
| ShopAtSC | [Terms & conditions](https://shopatsc.com/pages/terms-conditions), [terms of service](https://shopatsc.com/policies/terms-of-service) | Restriction noted | Terms limit use/copying for public purposes without permission. |
| Sigma India / Shetala | [Terms & conditions](https://sigmaindia.in/terms-and-conditions/) | Restriction noted | Public use of site materials requires written permission. |
| Foto Centre India | [Terms & conditions](https://fotocentreindia.com/terms-and-condition/) | Restriction noted | Restrictions on copying site content require clarification before further collection. |
| Pooja Electronics | [Terms & conditions](https://poojaelectronics.in/terms-and-condition/) | Restriction noted | Restrictions on copying site content require clarification before further collection. |
| RK Deals | Product-page links and targeted site search; tested `/terms-and-conditions` returned 404 | Terms unverified | No usable source terms page could be verified. A permissive robots file alone is insufficient. |
| Fujifilm X India | [Terms & conditions](https://fujifilmxindia.com/pages/terms-conditions) | Reviewed, limited pilot | Purchasing/pricing terms examined. No explicit automated-collection prohibition identified; no written permission or reuse licence inferred. |
| Just Canon | [Terms & conditions](https://www.justcanon.in/pages/terms-conditions), [terms of service](https://www.justcanon.in/policies/terms-of-service) | Reviewed, limited pilot | Ownership and commercial-copying restrictions noted. Limited noncommercial factual observations only; no licence or approval inferred. |
| Dacby | [Terms & conditions](https://dacby.com/termsAndCondition) | Reviewed, limited pilot | Platform-use terms examined. No explicit automated-collection prohibition identified; no written permission or reuse licence inferred. |
| Srishti Digilife | [Terms & conditions](https://www.srishtidigilife.co.in/pages/terms-conditions) | Reviewed, limited pilot | Purchase/availability terms examined. No explicit automated-collection prohibition identified; no written permission or reuse licence inferred. |
| Camera Club India | [Terms of service](https://cameraclub.in/policies/terms-of-service) | Reviewed, limited pilot | Published ordering/privacy terms examined. No explicit automated-collection prohibition identified; no written permission or reuse licence inferred. |

## Robots and current operation

The `/robots.txt` file on each of the 13 configured source hosts was read. No applicable disallow rule matched the fixed product URLs during this review. Some files contain rules for specific bots and crawl delays; rules for unrelated bots were not treated as rules for the collector's `SecondGlass` identity. This observation does not override a site's terms or grant a reuse licence.

The collector remains enabled for all sources. It reads fixed reviewed URLs using ordinary HTTPS requests, response-size limits, timeouts and small product-read delays. It does not bypass logins, authentication challenges or access blocks. Failed reads keep previous observations and their original successful-read dates. There is currently **no automatic terms-change monitor or policy-enforcement gate**. This manual review must not be described as one.

## Review limits and follow-up

Terms and robots policies can change. The findings describe the pages checked on 1 November 2026; absence of an explicit scraping clause is not evidence of permission. Clarify restrictions or use an appropriately licensed feed before claiming authorised collection or expanding reuse. RK Deals remains an unresolved terms-review gap. No seller outreach or permission request has been made.

The public [How it works / limits page](https://dhruvi-2003.github.io/secondglass/how-it-works.html) explains the automated data method, manual review work, hourly refresh attempts and intentionally excluded features. Each listing's Details panel exposes its last successful source read in IST, independently of the site publication date.
