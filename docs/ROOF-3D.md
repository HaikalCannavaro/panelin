# Interactive roof studio, version 0.2.0

**Version 0.4.0 update:** the earlier “visual only” behavior described below remains the default, but is no longer universal. Explicitly enabling geographic calculation links the same location, heading, selected roof normals, and face areas to the annual estimation proxy. See `GEO-PRODUCTION.md` for the exact reference-yield contract, assumptions, and limits. Date/time/camera remain visual-only. Active geographic inputs now persist in numerical snapshots; offline simple mode remains separate. Optional map behavior is documented in `MAP-PINPOINT.md`.


Version 0.3.0 adds sun-aware visual geometry. See `SUN-POSITION.md` for current features and verification limitations. The verification below is historical coverage of version 0.2.0, not a claim of repeated browser QA for 0.3.0.

## Scope

Added a local 3D geometry viewer to the location/roof wizard step and a new results tab. Existing energy, finance, worker and snapshot engines are unchanged. Four parameterized templates are available: flat rectangle, gable rectangle, hip rectangle, and an L footprint composed of two flat roof wings. Wall footprints and roof profiles are generated together.

Width is bounded to 4–20 m and length to 4–24 m. Gable/hip pitch is 10–45 degrees. The sketch has fixed 3.2 m walls. These controls are separate from effective roof area, roof metadata, and numeric simulation input. Values are normalized on local hydration; arrays and malformed input cannot supply dimensions.

Panel rectangles use the numerical module area and assumed aspect ratio 1:1.7. Each face has a planar local coordinate system. Rectangular grid candidates must have all four corners inside the convex face and at least 0.4 m from edges; gaps are 0.12 m. These are illustrative offsets only. The algorithm is not an optimized packing solver and does not verify structural, electrical, obstruction, wind, fire, access or mounting requirements. Results show the requested and drawn count separately and never change financial outputs to match a visual shortage. A zero-candidate result still permits a zero-panel roof preview.

Renderer: local orthographic 3D projection with depth testing, flat shading, panel cell lines, walls/windows and contextual landscaping. WebGL is preferred. A Canvas 2D software triangle/line depth buffer renders the same scene when WebGL is unavailable. No external libraries or network requests were introduced.

Controls: pointer drag, two-pointer pinch, explicit rotation/zoom/top/reset buttons, keyboard arrows and +/-/Home while focused. Modifier-key shortcuts are not intercepted. Camera bounds adapt to geometry and rotation at default zoom. Explicit zoom may intentionally crop the model. No automatic animation. ResizeObserver and scheduled draws are disposed when views change.

Storage: visual settings use `suryajelas:visual:v1`, saved only by the same explicit save action or save-checkbox opt-in as numerical input. Local delete removes both keys. Numerical snapshot exports are unchanged and exclude visual settings. Replay resets the visual template rather than pretending that the imported snapshot contains it.

## Verification, 11 November 2026

- `npm test`: 42 passing tests, including 15 new geometry/layout/immutability tests.
- `npm run check`: syntax checks for all seven app/server JavaScript modules pass.
- Independent source review caught array normalization using array length as a dimension; fixed and covered by regression.
- Browser checked at desktop viewport in the provided Chrome environment: demo calculation; full four-step wizard through results; all four templates; dimension extremes; pitch controls; zero and overflowing visual counts; portrait/landscape; single/all face selection; result panel count changes with candidate; rotation, drag, keyboard rotation, top view and reset; save/reload and clear/reload; repeated tab/view transitions.
- The provided browser does not expose WebGL, so visual verification exercised the software depth-buffer fallback. Hardware WebGL rendering remains unverified in a real supported browser.
- Desktop screenshots document the gable and L templates. Mobile CSS layouts are implemented, but an actual narrow viewport and two-finger pinch were not verified by the available browser controls. Print pagination, screen-reader behavior, formal accessibility and device performance benchmarks remain unverified.
- Browser logs contained extension metadata errors outside the app origin; no app-origin JavaScript errors were observed during the tested flow.

No public hosting, repository publication or external data transmission was performed.
