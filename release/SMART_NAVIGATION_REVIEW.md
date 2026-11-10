# Focused directory navigation, 10 November 2026

Local build for review before publication. No push, deployment, or production data change has been performed.

## Baseline and scope

- Based on verified production `main` at `0cfdf4ddc72ac96110798fc7b3c620c40a7ec975`.
- Isolated branch: `ux/focused-directory-navigation-20261110`.
- Runtime changes are limited to `app.js`, `index.html`, `styles.css`, and `dialog-accessibility.js`.
- Apps Script files/manifest, Firestore rules, logo assets and protected signature regions are unchanged.
- Frontend cache keys for the three changed script/style resources are coordinated as `20261110-navigation-v1`.

## Behavior

- Home retains category and monthly shortcuts. Lists keep only the search field and compact scope row sticky; the count/Home/selection toolbar scrolls with results.
- The scope selector provides other categories, a searchable department picker, and Home without requiring a return to the top of a long list.
- Department header/search/close stay visible while only the department options scroll. Search is local, supports multiple words, has a clear/no-results state and does not summon the mobile keyboard on opening. New controls have at least 44px touch targets; department rows retain 48px. Search and native selectors use 16px text to avoid mobile Safari focus zoom.
- Laboratories can be filtered to All, Schneider, Beilinson or Other. The filter intersects the existing lab category and search. Unknown/mobile/other prefixes remain discoverable in All and Other.
- Existing hospital classification by normalized telephone prefix is retained, not replaced with an inferred data migration. Beilinson's display spelling is consistent between selector and heading.
- Changing a category or hospital starts at the results heading below the sticky card. Existing text is deliberately retained, consistent with previous category behavior. The search placeholder names its scope and an explicit global-search action keeps the text while clearing category/hospital filters.
- Clearing text within a category retains that category; clearing global search returns Home. Home retains resumable selected contact identities. Explicitly finishing selection retains its existing behavior.
- Contact details, Escape and browser Back restore the underlying list's position. Details-to-report/update transitions share the original position. The shared dialog coordinator temporarily owns scroll restoration, then restores the browser setting after the dialog history entry settles. Intentional category scrolling runs afterward, avoiding the native Back race.
- This is not a new category-routing system: existing dialog Back/Forward behavior is preserved, including not replaying a stale person/form on Forward.

## Verification

- All 22 executable Node regression scripts pass.
- All 26 simulated DOM dialog checks pass. jsdom's scroll simulation is explicitly labeled; real scroll geometry is covered by browser tests.
- Existing headless Chrome browser suites pass: combined 56 checks, compact Home 101 checks, dialogs 26 checks, signup 150 checks, and admin-import/pharmacology flows at 320/375/390/430/960px.
- The new long-list suite covers 240 synthetic contacts and 91 department choices at 320/375/390/430/960px plus a 390x420 short viewport. It checks exact scroll restoration, picker cancellation/selection, Back/Forward, report/update transitions, compact sticky geometry, 44px targets, hospital/query intersections, explicit global search, no-results recovery and stable selection identity.
- All 228 new-suite checks pass against the final code, including seven mixed phone-classification fixtures and the 16px native-selector text check.
- Mobile-width results, desktop results and the short department sheet have been visually inspected.
- Syntax, whitespace, unchanged backend/assets/signature comparisons pass. An independent read-only runtime review found no remaining actionable defect.

## Reproduction

Use an existing Playwright installation via `PLAYWRIGHT_MODULE` and installed Chrome via `CHROME_EXECUTABLE`. Run `node qa/smart-navigation-browser.js`, `node qa/browser-regressions.js`, `node qa/signup-browser.js`, `node qa/admin-import-browser.js`, and `node qa/pharmacology-browser.js`. Set `QA_SCREENSHOT_DIR` to a local output directory as desired. Run all `tests/*.js` except the shared `dialog-test-cases.js` module, and `tests/dialog-accessibility.cjs` with an existing jsdom installation on `NODE_PATH`.

The browser runners intercept requests and block every external destination. All records and service responses are synthetic. The desktop sandbox required permission to launch the already-installed headless browser; no packages or browsers were installed.

## Limits and publication handoff

No physical phone, iOS virtual keyboard, live Firebase/email integration, real production contact mutation, or mobile Contacts import was tested. A short viewport checks layout under reduced height, not a physical keyboard. Chrome was used for this build; native Safari was not rerun.

Keep the work local until publication is authorized. Before any later publication, verify remote `main` again and reconcile newer changes rather than overwriting them; rerun affected checks. Publish the four runtime files together through the normal frontend workflow and verify the exact remote commit and served cache keys. No backend or data deployment is needed by this change.
