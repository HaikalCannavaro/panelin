# Sun-aware roof studio · version 0.3.0

**Version 0.4.0 update:** the earlier “visual only” behavior described below remains the default, but is no longer universal. Explicitly enabling geographic calculation links the same location, heading, selected roof normals, and face areas to the annual estimation proxy. See `GEO-PRODUCTION.md` for the exact reference-yield contract, assumptions, and limits. Date/time/camera remain visual-only. Active geographic inputs now persist in numerical snapshots; offline simple mode remains separate. Optional map behavior is documented in `MAP-PINPOINT.md`.


## What changes

The 3D viewer now calculates the Sun's direction from explicit latitude, longitude, date, local time and timezone. It renders directional face lighting, a Sun direction marker, true-north compass labels, and projected ground shadows. A daily elevation chart and per-roof-face incidence angles make the geometry inspectable.

- Default is an explicitly labeled Bandung example: latitude −6.9175°, longitude 107.6191°, 11 November 2026, 09:00 WIB. It is not detected from the device or inferred from the city field.
- Latitude is north-positive; longitude is east-positive. Both can be edited directly. No coordinates leave the app.
- Civil time uses explicit WIB (UTC+7), WITA (UTC+8), or WIT (UTC+9), never the device timezone. The date is validated in the Gregorian calendar, 2000–2100. Time has minute resolution.
- Sun azimuth is clockwise from true north: 0° north, 90° east, 180° south, 270° west. Elevation is relative to a flat horizon.
- Building heading is the direction of its front door. Default 180° means front south. Local +X is east, +Y is up, +Z is south at this default. Moving the camera does not change heading or the Sun's astronomical position.
- Date, minute slider, exact time field, four time presets, coordinates, timezone and heading can be changed without recalculating the energy engine.
- In the incidence readout, 0° is perpendicular to the roof face. A face facing away from the Sun receives no direct-light term. The readout is not percentage power or yield.

## Astronomical model

`src/sun-model.js` uses NOAA's Julian-century / Meeus-style equations for mean solar longitude and anomaly, equation of center, corrected obliquity, declination and equation of time. Local civil time is converted explicitly to a UTC instant, then to local solar hour angle. The direction vector is transformed into the building's local axes.

This is approximate **geometric solar-center position**, without atmospheric refraction, terrain horizon, parallax/elevation correction, cloud cover or measured irradiance. It is intended for visual exploration, not a survey or technical design. A one-decimal display is a readability choice, not a certified accuracy claim. Near the zenith, azimuth is inherently sensitive and has little directional meaning.

Primary references:

- NOAA calculation details: https://gml.noaa.gov/grad/solcalc/calcdetails.html
- NOAA reference equations: https://gml.noaa.gov/grad/solcalc/main.js
- NREL Solar Position Algorithm report, Table A5.1 reference case: https://digital.library.unt.edu/ark:/67531/metadc1416160/m2/1/high_res_d/15003974.pdf

The NREL reference is used as an independent validation point, not as a claim that this implementation is the full NREL SPA. The test permits 0.2° to account for the app's minute-only input and its simplified algorithm.

## Rendering scope

All roof, panel, wall and tree face normals use the calculated Sun vector. A fixed ambient term keeps surfaces readable and is **not** modeled diffuse irradiance. Night has no direct sunlight or Sun marker; low ambient light intentionally keeps the house visible.

Roof/wall and decorative tree geometry is projected opposite sunlight onto a horizontal ground plane at −0.175 m. Those projected polygons are clipped to the displayed lawn. This illustrates ground shadow direction; it is not ray-traced shading on roof faces or panels. Shadows are suppressed at solar elevation ≤3° to avoid near-horizon projection singularities. Nearby buildings, terrain, obstructions, self-shading, panel-to-panel shadows, atmospheric effects, module efficiency, irradiance and losses are not simulated. Decorative tree positions are examples, not measured site obstructions.

The same geometry, lighting and shadow functions feed local WebGL and the software Canvas fallback. Camera framing does not change with time or heading, so time scrubbing does not resize the house.

## Energy and storage boundaries

The existing monthly-yield/hourly-load energy and finance engines are unchanged. Sun position, building heading, roof pitch/shape/dimensions and visual panel layout do **not** modify production, costs, savings or numerical feasibility. Numerical roof metadata and city/timezone remain independent. Integrating these physically would require an irradiance/weather dataset and a validated plane-of-array and shading model; a cosine alone is not an energy model.

Solar visual settings use the separate key `suryajelas:sun:v1`. They are saved only by the same explicit local-save action or opt-in as other input and deleted by the existing local-delete action. Snapshot JSON retains the original numerical contract, excludes 3D solar settings, and resets those settings to the labeled example upon replay.

## Verification · 11 November 2026

- `npm test`: 62 tests pass, including astronomy, invalid/leap dates, explicit timezone/date crossings, seasonal/polar cases, building coordinate transforms, incidence, shadow projection/clipping, outward normals, low-angle shadow brightness, software rendering for all roof types at day/night and multiple headings, mounted-control event handling, invalid-input retention, explicit save/reload/delete, snapshot resets, and existing numerical/snapshot regressions.
- `npm run check`: all eight app/server JavaScript modules pass syntax checks.
- Independent static integration review found a low-angle shadow brightness defect. It was fixed and covered by a regression test.
- The actual Canvas renderer was executed locally and its morning/afternoon model output was visually inspected. The accompanying comparison image is an actual model render, **not a screenshot of the complete browser UI**.
- New live browser UI QA was blocked: the provided browser could not reach the isolated local preview server. A local headless browser launch was also unavailable under its socket restrictions. No restrictions were bypassed.
- Consequently, actual WebGL rendering, browser interaction/layout, mobile layout, touch gestures, full UI screenshot, screen-reader accessibility, print pagination and device performance remain unverified for this release. Mounted event tests use a minimal DOM boundary, not a real browser.

No public deployment or repository publication was performed.
