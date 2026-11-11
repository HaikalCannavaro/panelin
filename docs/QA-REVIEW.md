# Independent bounded QA review

Date: 11 November 2026. Scope: static source review of `src/app.js`, `src/domain.js`, `src/worker.js`, `server.mjs`, `index.html`, styles and supplied SRS/SDD requirements. No browser, screen reader, penetration test, production load test or full accessibility audit was performed by this reviewer.

## Executed checks

- `npm test`: 21 tests passed, 0 failed at the initial review checkpoint.
- `npm run check`: all four JavaScript syntax checks passed at that checkpoint.
- Fixtures include timing-sensitive balance, leap-year/local timezone calendar, monthly normalization, zero-load handling, invalid domain input, roof/budget constraints, conservation, manual ranking, degradation, money/NPV/payback, zero CAPEX, independent sensitivity, versioned replay and checksum tampering.
- These passing tests initially did **not** catch UI/domain integration defects. Test success is not equivalent to wizard acceptance.

## Findings sent to implementer

The following were verified against the initial implementation. Corrections were being applied concurrently; treat this list as a review record, not an assertion that each issue remains in the final tree. Re-run checks and browser acceptance after changes.

1. **Blocking schema mismatch:** wizard collection added `consumptionSourceMonth`, absent from allowed domain input, making final validation fail. Preserve the period through a validated schema field rather than silently discard it.
2. **Shading mismatch:** UI supplied text enums while domain required null or numeric 0–1. Preserve unknown versus zero and use human-readable labels.
3. **Per-step validation:** domain returned strings but UI expected `.field`/`.path`; step filtering discarded errors. Map all validation errors consistently, including cross-field rules.
4. **Sensitivity rendering:** UI expected CAPEX, first-year savings and self-consumption ratio missing from sensitivity outputs. Add recalculated fields, not presentation guesses.
5. **Cashflow chart:** year-one point was labeled year zero; prepend negative CAPEX to plotted cumulative values.
6. **Load preview:** active-hour preview showed `1 + baseLoad`, whereas engine used `1`. Table and chart must use exact engine weights.
7. **Form bounds:** UI base-load and several financial limits disagreed with domain bounds. Align both; do not accept then silently reject at the final step.
8. **Payback reversal disclosure:** engine computed `paybackRecross`, but results did not clearly warn when cashflow became negative after first payback. Show alongside payback.
9. **Skip navigation:** `href="#main"` collided with hash routing and navigated home. Keep route unchanged and focus the current main region.
10. **Busy-dialog focus:** modal ARIA alone did not transfer/trap focus or make background inert. Ensure keyboard cancellation and correct focus restoration.
11. **Extrapolation:** fresh wizard consent was prechecked. SRS requires the user to choose extrapolation; fresh consent should be unchecked.
12. **Mobile navigation:** desktop nav was hidden below 800px without equivalent provider navigation. Keep all main destinations reachable.
13. **Directory markup:** Jawa Barat was text outside an option; correct the option even though directory data is currently empty.

## Security observations

- User text is escaped before insertion into HTML; charts use domain numeric values. No snapshot code or source URLs are executed.
- Snapshot input is bounded, version-checked and validated. SHA-256 verifies content consistency, not identity/authenticity; replay recomputes results rather than trusting imported metrics.
- Calculations use a worker. No consumption upload, analytics, lead submission or third-party request is present in the reviewed app code.
- Static server restricts methods and asset names and adds CSP, nosniff, no-referrer and disabled camera/microphone/geolocation policies. CSP permits inline styles; this is not a comprehensive production hardening audit.
- No authentication, evidence storage, admin operations or private backend exist. Their security requirements are deferred, not passed.

## Required remaining manual checks

Complete demo and manual wizard paths; blank and zero values; non-default shading; one-month consent; full-year input; zero feasible candidates; every results tab; negative NPV and payback recross; cancellation; save/reload/delete; export/reimport/tampering/unknown model; mobile navigation; keyboard-only flow and screen-reader announcements; focused errors; chart/table parity; PDF pagination; and absence of console errors or unintended network requests. Also test stale/cancelled worker jobs and rapid route changes. Formal WCAG conformance, p95 benchmarks, model calibration and usability pilot remain unverified.
