# Contributing

Please keep the first product focused on useful used-lens comparison. Small, demonstrable improvements are preferable to speculative infrastructure.

1. Run the application and the backend tests described in README.md.
2. Describe a concrete listing or user interaction that currently fails. Use synthetic/relicensed fixtures; exclude personal seller details, secrets and unapproved scraped data.
3. Add a focused test for matching/import changes, or browser verification for user-visible changes.
4. Keep unknown values unknown. Never infer a defect's absence, universal condition grade, manufacturer compatibility, shipping price or warranty.
5. Do not add trackers, accounts, paid calls, new dealer integrations or external image dependencies without discussing the user impact and data access first.

Useful starter tasks: model alias review fixtures, keyboard navigation improvements, Hindi translations, source-contract validators, real PostgreSQL integration tests, and accessible comparison on small screens.

Dealer adapters must document the authorized access method, observation time semantics, stable physical-item identity, failure/retry behavior and explicit sold status. Keep original disclosure text alongside extracted fields. Propose uncertain matches for review rather than automatically merging them.

## Real-source adapters

Public source adapters live in `tools/refresh_sources.py`; the latest selected observations are in `catalogue/live.json`. Add regression tests in `tools/test_sources.py`. Preserve integer paise, observation timestamps, explicit stock and source identity. Never promote a generic condition grade to an optical-health claim. Do not include credentials, private account data, source HTML dumps, copied reviews or seller photographs in a contribution. Run the adapter tests plus the Java tests for contract changes.

Only retail businesses and platforms with direct product checkout are eligible. Register the reviewed hostname in `backend/src/main/resources/retailers.json` before adding an adapter. Exclude Tapprs, rental/enquiry-only listings, Facebook, OLX, Quikr and community/private-seller classifieds. Do not infer authorized-dealer status or warranty coverage from registry inclusion.
