# Requirements status: bounded estimation tool

Review date: 11 November 2026. Sources: supplied SuryaJelas SRS 1.0 and SDD 1.0 (the application is now named Panelin) (28 October 2026), implementation, and local automated tests. This is a scope map, not full SRS acceptance or certification. UI integration fixes and browser acceptance are separate from passing domain tests.

| Requirement | Current coverage | Remaining work / qualification |
|---|---|---|
| F-001–002: anonymous use and three segments | Implemented in UI; local worker computation | End-to-end browser acceptance required; segment presets are assumptions |
| F-003–006: consumption, energy-charge conversion, manual tariff, validation | Annual 12-month values or one-month extrapolation; flat positive tariff conversion; domain validates inputs | Partial: not arbitrary 1–12 monthly records; no full PLN invoice/token inversion. Explicit extrapolation selection and UI/domain validation integration require acceptance |
| F-007: location and roof unknowns | City, three Indonesian zones, nullable roof metadata | Area is a simple bound. Tilt, azimuth, shading and structure do not affect yield |
| F-008–009: editable load and normalization | Active-day/hour schedule, holidays, base load, monthly normalization | No arbitrary hourly editing or overnight blocks; preview must match domain weights |
| F-010–012: production provenance and timeline | Synthetic demo and manual B monthly AC yield, local-clock hourly timeline | Partial: no A source adapter, live geographic source, source licensing verification or outage fallback. Manual data is unverified |
| F-013–018: candidate capacity and interval energy | Integer modules, DC/AC distinction, roof/budget bounds, hourly self/import/surplus, two ratios, zero surplus credit, energy-only savings | No inverter clipping, electrical design or technical feasibility determination |
| F-019–022: finance | Fixed + variable CAPEX, annual OPEX, one replacement, degradation, nominal discount/escalation, NPV, first cumulative payback | Not arbitrary itemized cost graph or multiple replacement schedules. First payback can later reverse |
| F-023–026: comparisons, sensitivity, baseline, labels | Illustrative demo options; conditional manual ranking; zero-solar baseline; ±15% independent sensitivities; disclosures | UI output mapping and visibility must be tested; no personal investment recommendation |
| F-027–028: snapshots | Versioned, hashed JSON with lossless resolved arrays, candidate definitions and recomputed results | Only bundled model version replayable. Unknown version inspection is unverified. Hash is not source authentication |
| F-029–030: print and optional local storage | Browser print stylesheet; JSON download/import; explicit browser save/delete controls | Print pagination and browser persistence flows need browser acceptance; no server-side report generation |
| F-031–033: directory and verification | Honest empty directory with no fictional providers or badges | Deferred: actual filterable dataset, provider evidence review, expiry and suspension logic |
| F-034: leads/contact | No automatic contact or lead transmission | No live contact workflow |
| F-035–037: admin, publication and audit | Not implemented; /api routes unavailable | Deferred: authentication, RBAC, immutable parameter publication, atomic audit storage |
| F-038–040: errors, token restrictions, emissions | Domain errors; no total-token inference; emissions disabled | UI field errors and unsupported-version handling need browser acceptance |
| N-001: performance | Worker architecture and fast local fixture runs | No prescribed p95 device/workload benchmark conducted |
| N-002–003: responsive and accessibility | Responsive styles, semantic labels, chart descriptions and table alternatives, status region | No full viewport, contrast, screen-reader or WCAG 2.2 AA audit; focus handling requires testing |
| N-004–005: server access and limits | Static asset allowlist, security headers, GET/HEAD only, bounded snapshot/domain inputs | No private backend or role matrix exists. Production rate limits, auth and deployment hardening deferred |
| N-006–009: reproducibility, privacy, independence, testability | Deterministic domain fixtures; checksum/replay; local computations; no analytics or external adapters in app | Cross-browser numeric replay and deployed logging need validation; hosting may have independent access logs |
| N-010–011: pilot and disaster recovery | Not implemented | No ≥10-person usability pilot, operator backup or recovery drill |
| P1 monitoring / CSV ingestion | Not implemented | Device adapters, ownership, stale/gap handling, deduplication, CSV quality checks, revocation and retention deferred |

## Version 0.4.0 estimation update (11 November 2026)

This section supersedes earlier table qualifications only where stated:

- F-007, F-010–012: optional shared 3D coordinates/heading/roof now feed a documented astronomical and isotropic geometry proxy. This is not verified local weather or a validated production-accuracy improvement. Simple monthly mode remains available without detailed location.
- F-008–009, F-010–012: strict local CSV import accepts full-year hourly whole-building demand and/or AC production per DC kWp with explicit timestamps/units/source. No automatic source authentication, provider adapter, or partial-year conversion.
- F-013–018: an hourly-average AC inverter cap is applied. Efficiency curves and subhourly clipping remain outside scope.
- F-027–028: the new model version includes geo inputs/imported data and replays them. Prior model outputs remain archives rather than being silently upgraded.
- Optional map is explicit opt-in, separate from GPS and weather. Its privacy and network requirements are documented in MAP-PINPOINT.md.
- Unit/state tests cover added numerical invariants, CSV rejection/alignment, reference-yield semantics, timezone synchronization, stale results, and exact source metadata. These checks do not replace browser/phone/engineering acceptance.

## Production release gates

Complete UI integration and keyboard tests; verify responsive and print output; run defined performance and comprehension trials; validate model results against an independent reference; obtain approved real source and tariff policies; implement and test provider/admin/backend security and operational controls before claiming full P0 delivery. The Node server is a small local-preview server, not a complete production application backend.

## Version 0.2.0 visual update

An interactive roof/house studio is now available. It is intentionally separate from the numerical model and does not satisfy physical layout, shading, structural, or orientation-aware production requirements. See `ROOF-3D.md` for the exact scope and new verification evidence.
