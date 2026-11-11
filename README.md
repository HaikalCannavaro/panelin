# Panelin

An Indonesian rooftop-solar estimation tool for households, schools, and small businesses. Calculations run locally in a browser without an account. Results are estimates for discussion, not a design, quotation, installation approval, or guaranteed savings.

## Run and verify

Node.js 20 or newer is needed only for the included static preview server:

```sh
npm start
npm test
npm run check
```

Open `http://localhost:3000`. ES modules and the calculation worker need HTTP(S), not `file://`. The application can also be hosted as static files. A public deployment must serve `index.html`, `src/`, and `public/`, preserve worker/module paths, and apply the headers required by the optional map. The bundled server is not an account, provider-directory, or audit backend.

## Choose how much information to provide

1. **Simple estimate:** enter consumption, tariff, roof-area/budget bounds, activity hours, and cost assumptions. Monthly AC yields are distributed into a synthetic 06:00–18:00 local profile. Initial yields, costs, and tariff are explicitly synthetic assumptions, not current local measurements or prices.
2. **Optional geography and 3D link:** select a house position manually or with the optional map, set timezone and front-facing direction, then adjust roof shape/pitch/selected face. Explicitly enable the link to energy calculations. The same coordinates, heading, and roof normals feed the visualization and annual calculation. Solar position is evaluated throughout the model year; the displayed date/time is only for visual exploration.
3. **Optional hourly data:** advanced users may import a strict CSV of hourly AC production per DC kWp and/or whole-building load. Exact timestamps, units, complete local year, source, and calendar are required. This bypasses synthetic timing for the imported series. It does not authenticate the source.

The built-in walkthrough explains each visible step. Unknown geographic details may be skipped; the app never needs GPS permission.

## Important reference-yield distinction

With geography **off**, monthly yield is AC energy for the user's intended system. With geography **on**, it is an AC **horizontal-reference yield** for the location. The geographic approximation changes that reference for roof orientation using solar geometry, isotropic diffuse light, and ground reflection. Do not reapply it to a yield already corrected for the actual roof. The UI discloses this change of interpretation.

Diffuse fraction 0.5 and ground reflectance 0.2 are editable scenario assumptions, not weather data. No live weather or geographic-yield source is fetched. The proxy has not been calibrated against site production, so geographic detail does not justify an accuracy percentage. Nearby obstructions, thermal behavior, electrical mismatch, and structural suitability remain outside its scope.

Hourly AC imports are mutually exclusive with the geographic production correction, to prevent double application. Whole-building hourly load alone can be combined with geography. See `docs/HOURLY-IMPORT.md` and `docs/GEO-PRODUCTION.md`.

## Financial and physical limits

The engine evaluates integer module counts subject to the explicit area and budget. It balances generation and demand each hour, values surplus at zero, reruns degradation and production sensitivities, and computes annual cashflows, first cumulative payback, and NPV. AC production is capped at the inverter's hourly-average rating. This cap is not a full inverter-efficiency or subhourly clipping model. Hourly balancing can overestimate self-use within variable hours.

The illustrated panel grid is not a packing, structural, or electrical design. Geographic mode weights capacity by selected 3D face area, which may differ from discrete visual panel placement. The separate effective-roof-area constraint remains only a simple screening bound.

## Project name and compatibility

The application is now **Panelin** (previously SuryaJelas). The supplied SRS/SDD retain their original document names. Existing browser-storage keys, snapshot contracts, model versions, hosting project ID and public URL remain unchanged so saved inputs and existing links continue to work. New JSON downloads use the Panelin name.

## Privacy and persistence

Numerical calculations and CSV parsing stay in the browser. Browser storage is optional. The online OpenStreetMap background loads only after explicit activation; its provider receives IP address, site origin, and requested map area. No device geolocation is requested. Map access and location searching are not necessary to calculate.

JSON snapshots retain the exact versioned numerical assumptions, imported hourly data, and geographic roof configuration when enabled, along with lossless resolved series and checksums. Camera and visual date/time are not part of the energy model. Replay recomputes results locally; a hash is not proof of data authenticity. Earlier model snapshots open only as unverified archives.

## Verification scope

Automated checks cover calendars, energy conservation, source alignment, geographic invariants, monetary fixtures, inverter limits, degradation/sensitivity, snapshot replay, and UI state synchronization. Unit tests do not establish actual production accuracy, official tariff validity, WCAG conformance, live map availability, or real-phone/WebGL performance. Public-host browser, phone, print, and independent reference-data validation remain release checks. See the documents in `docs/` for precise methods and remaining limitations.
