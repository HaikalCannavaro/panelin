# Estimation model and reproducibility

Current model: `sj-estimate-geo-hourly-2.0.0` in `src/domain.js`. This changes the previous model's output because inverter limits and monetary arithmetic have changed. Old snapshots are not silently replayed with the new engine.

Reference requirements: the original SuryaJelas SRS/SDD (the application is now named Panelin) 1.0, 28 October 2026, especially SRS §5.2–5.3 and SDD §5.1–5.5. The tool supports bounded estimates, not verified installation feasibility or a complete P0 backend.

## Energy contract

- One-hour Float64 energy, 8,760/8,784 intervals in the selected local Indonesian year. UTC timestamps identify interval starts. Three supported zones have fixed UTC+7/+8/+9 offsets.
- Default load uses active-day/hour and closed-day/base-load weights, normalized to exactly the entered monthly totals. Positive consumption with zero profile weight fails. Optional imported load is used without rescaling and must be whole-building demand, not net grid import.
- Simple monthly AC yield is kWh per installed DC kWp. A sine profile distributes it over 06–18 local clock, conserving each month before an inverter cap.
- Optional geographic production uses the exact shared 3D coordinates, heading, and roof normals to transform a **horizontal-reference AC yield**. Six 10-minute midpoint samples per hour approximate astronomical timing. Selected roof faces receive area-proportional capacity. See `GEO-PRODUCTION.md` for equations and limits.
- Optional hourly production replaces the synthetic/geographic curve with user-supplied interval AC kWh per DC kWp. It cannot be combined with geographic correction. Source losses and orientation are not applied twice. See `HOURLY-IMPORT.md` for strict validation.
- For each candidate/hour, `G = min(reference_hourly_kWh_per_kWp × capacity_kWp × production_factor, inverter_kW × 1 hour)`. This is an hourly-average AC cap, not an inverter conversion model. `annualClippedEnergy` is the difference from the uncapped curve, not a measured clipping loss. Already-clipped AC source data cannot reconstruct clipped DC energy under a different DC/AC ratio.
- Self-use is `min(G,L)`; imports are `L−self`, potential surplus `G−self`. Totals conserve both production and load. Zero-denominator ratios are null. Hourly averaging may overstate simultaneous self-use when real flows vary within the hour.
- Monthly/annual values refer to the first model year. Surplus credit is zero by assumption. Savings are avoided energy charges only, excluding taxes, fixed/minimum charges, token-invoice inversion, and changes in regulations. No claim is made that exports are universally prohibited.

## Capacity and finance

Candidates are discrete panels within 0.5–30 kWp, at most 200, screened against user area and budget. DC module rating and AC inverter rating are separate. The area allowance, visual packing, and geometry are not technical feasibility certificates.

Every projected year applies production degradation to the uncapped curve and then repeats the inverter cap and hourly energy balance. This preserves clipping relief as production degrades. Loads repeat unchanged; tariff and OPEX escalation are explicit nominal assumptions. CAPEX is fixed plus per-kWp, OPEX annual, and one inverter replacement occurs at its selected year. Neither prices nor tariff defaults are official/current quotes.

Monetary values serialize as fixed micro-IDR decimal strings. Decimal representations of Number factors are converted to BigInt fractions and rounded when multiplied, avoiding the previous 1e-9 rate quantization. Energy sums and exponential discount/escalation factors still originate in Float64; this is not arbitrary-precision transcendental arithmetic. Annual aggregation occurs before monetary conversion.

NPV discounts yearly net cashflow; first cumulative payback interpolates the first crossing of the undiscounted balance. Later reversal is flagged. Zero CAPEX and negative-flow cases are tested explicitly. Manual options select minimum CAPEX, a lowest-CAPEX candidate achieving at least 90% of maximum positive NPV where available, and greatest NPV, removing duplicates. Synthetic default options are illustrative rather than ranked recommendations.

Independent production and CAPEX ±15% sensitivities rerun balance and finances. These are stress scenarios, not probability intervals or a claim of ±15% accuracy.

## Snapshots

The schema carries model version, all numerical inputs including optional geographic/CSV data, lossless Float64 little-endian base64 load (`kWh`) and normalized production (`kWh/kWp`) series, candidate definitions, choice outputs, source provenance, warnings, and SHA-256 of canonical JSON. The app bounds JSON at 10 MiB. Replay checks the model, schema, input, hash, exact series consistency, candidates, and recomputed outputs. It never executes URLs/code from a file. A checksum is not a signature or proof of correctness.

Inputs saved before optional fields were added remain usable with the optional paths disabled. Prior model snapshots open as unverified read-only archives because their monetary/energy outputs belong to a different numerical contract.

## Accuracy and release limits

Primary formula references are documented with the geographic model. Inverter limiting and its subhourly limitation are consistent with NLR SAM's public model descriptions:
- https://samrepo.nlr.gov/help/pvwatts_system_design.html
- https://samrepo.nlr.gov/help/pv_losses.html

These references justify formulas, not the app's default yields, prices, regional diffuse assumptions, or measured accuracy. No live weather/tariff adapter, independent annual-production calibration, source authentication, installed-system monitoring, provider verification, legal approval process, or engineering signoff is implemented. Real site forecasts need verified weather/location/roof/system inputs and external comparison.

## Regulatory and tariff references

The zero-credit baseline is consistent with ESDM's official explanation of Permen ESDM 2/2024 for new rooftop installations. It does not resolve grandfathering, applications, quota, service-specific conditions, or future rule changes. Existing-customer transitional treatment requires separate confirmation. See https://esdm.go.id/id/media-center/arsip-berita/aturan-terbaru-plts-atap-terbit-kini-kapasitas-pemasangan-tidak-dibatasi and https://www.esdm.go.id/id/media-center/arsip-berita/revisi-permen-esdm-plts-atap-skema-jual-beli-listrik-dihapuskan- .

Tariffs remain explicit manual inputs rather than a silently selected class or outdated rate. The UI links PLN's official tariff information: https://www.pln.co.id/penyesuaian-tarif-id . The initial Rp1,500/kWh is still marked as a synthetic assumption and is not replaced by an inferred customer tariff.
