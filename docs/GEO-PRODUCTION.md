# Optional geography and 3D roof production proxy

This mode is opt-in. `input.geo = null` (or absent for direct helper calls) disables it. Users who do not know their coordinates or roof dimensions can continue using the simple model. Coordinates are never guessed by the production helper. Geographic production is a scenario estimate, not a measured resource assessment or validated accuracy improvement.

## Contract

`estimateGeographicProduction(input, timeline, panelCount?)` returns `null` when disabled; otherwise `{productionWeights, monthlyMultipliers, metadata}`. Production weights are hourly AC kWh per installed kWp. Metadata and surface normals are plain serializable objects/arrays. `validateGeo(geo)` returns an array of error strings. Invalid values are rejected, not silently clamped or coerced. `geographicSurfaces(geo)` exposes the selected face normals, true 3D areas, tilt and area fractions.

Required geographic fields:

- `latitude`: -90 to 90 degrees, north positive.
- `longitude`: -180 to 180 degrees, east positive.
- `heading`: integer 0–359 degrees clockwise from true north, describing the building front (+local Z).
- `roof`: `type` (flat/gable/hip/l), `width` 4–20 m, `length` 4–24 m, `pitch` 10–45 degrees, `orientation` (portrait/landscape), and `surface` (all or a valid face ID). Optional `panels` 0–300 integer is accepted for visual configuration compatibility but ignored by this model. Flat and L roofs remain horizontal regardless of pitch, matching their 3D geometry.
- `diffuseFraction`, `albedo`, `additionalLoss`: fractions from 0 to 1. A UI may suggest diffuse 0.5 and albedo 0.2, but these are editable scenario assumptions, not sourced regional measurements. Additional loss should default to zero.

The main input supplies year (2000–2100), Indonesian timezone, and 12 monthly reference yields (0–500). The timeline must be a full, ordered local-calendar year with matching month/date/hour, including leap day when appropriate. A positive yield in a month with no sampled daylight is rejected rather than inventing production at night. Zero-yield/no-daylight months return zero production and multiplier zero.

## Reference yield and equations

**With geography active, `monthlyYield` means AC yield for a horizontal reference surface, before the explicitly entered additional loss.** It is not already a yield for the actual tilted roof. Reusing a roof-specific yield would double-apply orientation effects. General system losses already included in the reference AC yield must not be entered again as additional loss.

At each of six 10-minute midpoint samples (minutes 5, 15, 25, 35, 45, 55) per hour, use NOAA/Meeus geometric solar position, with no atmospheric refraction. All irradiance proxies are zero when the solar center is at or below the horizon. Otherwise:

- GHI proxy = cos(zenith) = upward component of solar direction.
- DHI proxy = diffuseFraction × GHI proxy.
- DNI proxy = 1 − diffuseFraction.
- Direct POA = DNI proxy × max(0, dot(roof normal, solar direction)).
- Diffuse POA = DHI proxy × (1 + cos(roof tilt)) / 2.
- Ground POA = GHI proxy × albedo × (1 − cos(roof tilt)) / 2.

These are dimensionless proxies, not irradiance measurements in W/m². The geometric solar direction is transformed into the same local coordinate frame as the roof: +X has compass heading front heading minus 90 degrees, +Y up, +Z front. At heading 180 degrees, +X is east and +Z south.

Average the samples within each hour. Scale hourly POA by that month's reference yield divided by the monthly sum of the horizontal proxy, then multiply by `(1 − additionalLoss)`. The monthly multiplier is monthly POA proxy divided by horizontal proxy, times the same loss factor. A horizontal roof with zero additional loss conserves the supplied monthly yield. No second normalization erases tilt/heading effects; there is no artificial multiplier clamp. Geometry may increase or decrease the reference energy.

## Roof allocation and feasibility

Use the actual normals and polygon areas of `roofGeometry`. Installed capacity is distributed over selected faces in proportion to 3D face area, equivalent to uniform installed kWp density. This assumption is explicit and independent of the drawn panel grid or optional panel count. No installed panels disappear from energy accounting if they exceed visual packing capacity. Width/length can change the face-area mix (particularly for hip roofs), but scaling a building without changing face mix does not change per-kWp output. Panel portrait/landscape orientation does not affect normal or per-kWp production in this model.

This is **not** a panel-placement optimizer or a physical-fit check. Visual placement may distribute discrete panels differently. The financial model's separate roof-area constraint remains authoritative for its own simple capacity screening. Neither is structural validation.

## Limitations

No measured weather, clouds, irradiance data, seasonal diffuse fraction, temperature, atmospheric attenuation, terrain horizon, nearby obstructions, self/inter-panel shading, electrical mismatch, inverter clipping, wiring model or module performance curve is included. Roof geometry affects tilt, direction and selected-face weighting; projected 3D shadows are not an energy-loss measurement. DNI being constant during daylight and linear irradiation-to-AC scaling are deliberately simple assumptions. At extreme latitudes, low horizon angles can generate large multipliers; these are not bankable estimates. The underlying solar-position approximation is specified for 2000–2100.

Tests check mathematical invariants, coordinates, calendars and regression behavior, not agreement with actual production. A real engineering estimate needs verified location, roof survey, local irradiation/weather and system-specific losses.

## Primary formula references

- NOAA solar calculation details: https://gml.noaa.gov/grad/solcalc/calcdetails.html
- Sandia PVPMC beam POA: https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-beam/
- Sandia PVPMC isotropic diffuse: https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-sky-diffuse/isotropic-sky-diffuse-model/
- Sandia PVPMC reflected ground: https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-ground-reflected/
