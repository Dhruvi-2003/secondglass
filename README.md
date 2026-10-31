# SecondGlass

[Website](https://Dhruvi-2003.github.io/secondglass/) · [Architecture](docs/architecture.md) · [Source coverage](docs/data-sources.md)

The GitHub Pages site is a **read-only retailer snapshot**. Search, filters, shortlist, comparison and seller links run in the browser. Each price keeps its actual observation date. The Java backend remains in this repository for ingestion, transactional history, anonymous feedback and optional AI; those server features are not deployed by GitHub Pages.


A small India-focused new, used and refurbished camera-lens comparison application. Java 17 + Spring Boot, React, SQL and Flyway. The pilot covers selected Sony, Canon, Nikon, Fujifilm, Sigma and Tamron lenses. No signup or AI API key needed.

**Real source data is the default.** The collector covers selected listings from **Sigma India / Shetala, Fujifilm X India, Foto Centre India, Just Canon, Amazon India, Flipkart, Cashify, Dacby, RK Deals, Camera Club India, ShopAtSC, Srishti Digilife and Pooja Electronics**. The latest snapshot lives on `catalogue-data`; the checked-in `main` snapshot is a local bootstrap. This is not full inventory from every Indian website. Prices are retrieved from public pages; some offers are sold out or available only on backorder. Purchases happen on the seller’s website.

Sigma India's selected listing is a single **mount-unconfirmed product-family price**, not four inferred mount offers. **Stores & coverage** also links to Nikon India's official catalogue, Tamron India's distributor directory and Vijay Sales, clearly separated from comparison sources where direct lens checkout has not been verified.

GitHub Actions attempts to refresh and publish the snapshot every hour. This is not a guaranteed real-time feed: retailers can block requests or change their pages. Each offer keeps its own observation timestamp; observations older than 24 hours are labelled stale. Open **Stores & coverage** to inspect source scope and last successful reads.

## Run locally

Requirements: Java 17+, Maven 3.9+, Node 20+ and npm. Node 22 is used in the container build.

```sh
./dev.sh
```

Open http://127.0.0.1:8086. The script installs the locked frontend dependencies, builds the React bundle into Spring's static resources, packages the backend, then starts it. It does not load `.env` automatically. Export any overrides in your shell; `.env.example` documents them. Compose reads `.env` itself.

Alternatively, build in separate steps:

```sh
cd frontend
npm ci
npm run build
cd ../backend
mvn test
mvn -DskipTests package
java -jar target/catalog-0.1.0.jar
```

Run the jar from `backend/`. Live data defaults to `../catalogue/live.json` and the H2 database `backend/data/secondglass-false`. Set `LIVE_DATA_PATH` to override the snapshot. Set `DEMO_MODE=true` for the isolated fictional test catalogue (`secondglass-true`); the earlier `secondglass` database is preserved.

### Refresh real prices

From the project root:

```sh
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/refresh_sources.py
```

The collector reads a bounded set of public pages, writes `catalogue/live.json` atomically, and retains the previous source rows if a source fails. The running backend detects a changed file within 60 seconds. Reload the browser to update coverage information. No signup, scraping proxy, AI call or paid data service is required. If a source presents a challenge or changes its markup, the adapter reports failure instead of bypassing it or inventing values.

## What you can try

* Search a model, manufacturer code or brand; combine budget, prime/zoom, brand, sensor coverage, availability and optical-disclosure filters.
* Compare up to three source listings. Same manufacturer code and complete matching specifications produce a matching-variant verdict. Seller condition is always compared independently.
* Search `FE 50mm` to compare new Amazon pricing with used offers from RK Deals and Camera Club. Use purchase-type and store filters. Sold-out condition variants are explicit.
* View an individual listing's source summary, shipping/total-price uncertainty, warranty, accessories and price observations.
* Save listings locally and reload; share comparison URLs with someone using the same running server. A localhost link is not accessible on someone else's machine.
* Describe a search, e.g. `Full-frame prime below 25k`. Review and explicitly apply the suggested filters. The default parser is rule-based, not AI. It ignores unsupported intentions and says so.
* Give category-based anonymous feedback. Optional automatic usage counting respects DNT/GPC and can be disabled in Privacy & usage.

## AI (optional)

Export `AI_API_KEY`, `AI_MODEL`, and optionally `AI_BASE_URL` for an OpenAI-compatible Chat Completions endpoint that supports JSON mode and `max_tokens`. Users must opt in before their search text is sent externally. Keys stay on the server. The app does not retain query text, and no dealer catalogue data is sent.

The provider only suggests a small set of filters. The server validates types, ranges and allowed values; prices and listings always come from SQL. The user reviews filters before applying them. Timeout, invalid output, or an exhausted daily request cap falls back to the basic parser. Reservations count failed calls toward the cap. No automatic retry is used. There is no guaranteed free provider tier or zero-cost claim. The adapter has been tested with mocked provider responses/failures; an actual paid provider call is not part of local verification.

## Data and API

See [architecture](docs/architecture.md), [source contract and import walkthrough](docs/data-sources.md), and [verification](docs/verification.md).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/catalog` | Filtered/paginated offers; store and purchase-type filters |
| GET | `/api/sources` | Actual source coverage, refresh results and timestamps |
| GET | `/api/offers/{id}` | Latest recorded listing |
| GET | `/api/offers/{id}/history` | Observations for this listing's current variant |
| GET | `/api/compare?ids=id1,id2` | Validated variant verdict and full offer details |
| GET | `/api/search/capabilities` | Whether optional AI has configuration |
| POST | `/api/search/interpret` | `{ "text": "prime under 25k", "useAi": false }` |
| POST | `/api/events` | Allowlisted aggregate usage/feedback category |
| GET | `/api/health` | Database-backed health check |
| POST | `/api/admin/import` | Owner-only bounded observation batch |
| GET | `/api/admin/summary` | Owner-only batches, rejection reasons, daily counts |

Owner endpoints are disabled unless `ADMIN_TOKEN` is set; clients use `Authorization: Bearer <token>`. No owner secret is stored in the frontend. This pilot deliberately has no public admin dashboard or arbitrary URL-fetch feature.

## Containers and deployment

```sh
# Set DATABASE_PASSWORD in your shell or a local .env first.
docker compose up --build
```

Compose uses PostgreSQL and a persistent volume, with only the app exposed on loopback. The Docker daemon was unavailable during initial development, so these container/deployment templates are provided separately from verified local execution. PostgreSQL execution needs its own integration test; H2 compatibility mode is not proof of PostgreSQL parity.

The Kubernetes template in `deploy/kubernetes.yaml` targets an existing PostgreSQL database through a Secret and exposes an internal service only. It is a starting point, not a deployed or production-hardened cluster. Before a public release: establish authorized data access, test PostgreSQL, add edge request/body limits and trusted-proxy configuration, deployment-level observability, backups and alerting, and independently review security/privacy. Do not run multiple pods against the H2 file database.

## Open-source contribution scope

Good first contributions: tests for tricky model aliases, accessible comparison layouts, translations, and reviewed mappings from permitted dealer data to the source contract. See [CONTRIBUTING.md](CONTRIBUTING.md). Source code is supplied under the MIT license; third-party product facts, dealer content and manufacturer trademarks are not licensed by this project.

Retail sources must have product pages and a purchase path through store or platform checkout. Tapprs, rental/enquiry-only catalogues and person-to-person marketplaces are excluded. See [source coverage](docs/data-sources.md) and [candidate review](docs/source-review.md).

Sold-out listings are hidden from search by default; enable **Show sold-out listings** for reference prices. Stock-unknown offers remain labelled, and **Listed in stock** is stricter. Product ratings are store-reported scores with exact ratings/reviews counts and source links; missing scores stay unavailable. Ratings are not combined across stores or treated as item-condition scores.

## GitHub Pages

In GitHub repository Settings → Pages, choose **GitHub Actions** as the publishing source. `.github/workflows/pages.yml` runs the frontend tests, builds the static snapshot and deploys after pushes to `main`. It also refreshes retailer pages hourly at **17 minutes past each UTC hour (47 minutes past each hour in India)**. No API keys or credentials are included in the browser bundle.

The scheduled run tests the collector, reads the reviewed product URLs with bounded requests, validates and builds the candidate catalogue, commits only `catalogue/live.json` to the separate **`catalogue-data` branch**, then deploys Pages in the same run. Automated refreshes never commit to `main`. The data branch has independent history containing only the catalogue; keep `main` as the default branch for code reviews and releases. Every Pages build (including code pushes and manual redeploys) loads the latest data branch snapshot first, so code deployments cannot revert prices to the bootstrap snapshot on `main`. The first run bootstraps from the checked-in catalogue if the data branch does not exist. Bot commits do not trigger another push workflow. Overlapping runs are serialized and data pushes never force-overwrite a concurrent update. No personal access token or running laptop is needed.

Failed stores retain their previous listings and original timestamps. If every store fails, the collector exits unsuccessfully without replacing the snapshot. Tests, build, push or deployment failures leave the live site on its previous deployment. Each refresh writes a per-store report to the Actions run summary. The static site's database history, feedback and AI remain unavailable.

To refresh now, open **Actions → Deploy GitHub Pages → Run workflow**, choose `main`, and leave **Refresh retailer pages before publishing** enabled. Disable that option to redeploy the existing snapshot. To pause hourly collection while retaining push deployments, remove the `schedule` block in `.github/workflows/pages.yml`.

[GitHub schedules are best effort](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule): runs can be delayed or dropped, and public-repository schedules can be disabled after 60 days without repository activity. Monitor failed runs and **Stores & coverage** for retained/stale data.

```sh
cd frontend
npm ci
npm test
npm run build:pages
```

The output is `docs-site/`; serve it over HTTP to preview. Relative asset links also work under `/secondglass/`. You can still refresh `catalogue/live.json` locally with the bounded collector and commit the result. Deployment never relabels old observations as fresh. Frontend behavior tests use a recorded fixture, while a separate validation test checks the changing live catalogue without assuming fixed prices or counts. The public static site does not collect app usage/feedback or invoke AI. GitHub may keep hosting access logs. Historical database records are not exported; the Pages detail view shows only the published observation.
