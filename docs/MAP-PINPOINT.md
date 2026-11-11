# Optional house pinpoint map

## Use

Open **Simulator → Lokasi & atap → Lokasi & arah bangunan**. The default is still the explicitly labelled Bandung example, not the device's location.

1. Activate the optional OpenStreetMap map after reading its privacy notice.
2. Use **Dekati kota** for an approximate city center, or start from the current manual coordinates. The city list only moves the map. It does not select a house, change the city field, or infer a timezone.
3. Pan and zoom, then tap/click the house's roof, or use **Pasang titik di tengah**. The manual latitude/longitude fields and 3D Sun view update together.
4. Choose the front-of-building direction with eight compass shortcuts, and refine with the heading slider. Heading is clockwise from true north; moving the camera is separate.

Keyboard: focus the map, use arrow keys to pan, plus/minus to zoom, Enter to select the center, and Home to return to the selected house. Browser modifier shortcuts are not intercepted. Touch dragging pans; use the visible buttons to zoom. There is no pinch gesture or wheel interception in this map.

Manual coordinates work offline without opening the map. Map zoom is limited to 3–19, and Web Mercator display to about ±85.05113° latitude. The coordinate and Sun inputs still support ±90°. Location is represented to six decimal places after a map selection; this is precision of the saved number, not a claim of measured accuracy.

## Integration and persistence

`map-picker.js` mounts inside `roof-view.js`, calls its existing Sun-change callback, and follows manual coordinate changes. Selection updates latitude/longitude only, not heading, city, roof shape, or timezone. The application separately connects these values to energy only when the optional geographic energy model is enabled. The map does not download weather or irradiance, calibrate yield, detect roof faces, or measure shadows.

Activation is not saved. Each newly opened view requires activation again. Disabling removes the tile images and stops future tile creation; it cannot retract requests already sent. Disposing the view removes listeners and cancels pending redraw/time-out callbacks. The ordinary **Simpan di browser** action controls persistence of the coordinates. Snapshot behavior follows the host energy-model contract, not this widget.

## Privacy, service policy and hosting

No geolocation API, remote JavaScript, remote CSS, geocoding, search query, or map request is used on initial load. Only explicit map activation creates tile image requests. OpenStreetMap receives the user's IP address, browser request details, originating site, and requested map tile area. That area can reveal the neighborhood being viewed, including the selected location's vicinity. No name or address is sent, and exact selected coordinates are not encoded in page URLs or transmitted to a reverse-geocoder.

Service: OpenStreetMap Standard raster tiles, `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. There is no API key or commercial SLA. Map coverage/accuracy varies and the service can be unavailable or block use. Do not portray it as a survey, satellite imagery, or guaranteed building coverage.

The implementation follows the documented [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) checked on 2026-11-11:

- Visible linked © OpenStreetMap contributors attribution remains on the map.
- Browser-native image requests use the browser User-Agent and `referrerPolicy="origin"`, exposing only the originating site rather than path/query. This intentionally overrides the app's default no-referrer setting for these tile images, as OSM requires a valid Referer.
- Ordinary browser HTTP caching is left intact. No cache-busting, fetch cache bypass, proxies, manual prefetch, offline tile download, or service-worker tile archive is implemented.
- Only tiles intersecting the visible viewport are requested. During a drag, existing images are translated; new tiles are requested only for the final viewport on release.
- Terms, privacy, copyright and map-issue links are visible. For production scale, use an appropriate provider/service agreement and publish an operator contact; the community endpoint is best-effort.

References: [OSMF Privacy Policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy), [OSMF Terms of Use](https://wiki.osmfoundation.org/wiki/Terms_of_Use), [copyright/attribution](https://www.openstreetmap.org/copyright).

The local server permits only `https://tile.openstreetmap.org` as the additional external image host; script/connect/worker policy remains local-only and geolocation permission remains disabled. Any static hosting deployment must also allow this image host and preserve the image's origin referrer policy. Hosted policy has not been verified by this component task. No map/provider keys should be invented or embedded.

## Verification and limits

`node --test tests/map-*.test.js` covers:

- Web Mercator round trips, Indonesian city centers, antimeridian wrapping, polar clipping, viewport-to-coordinate conversion and visible-tile bounds.
- Zero image requests before activation, activation/disable, origin referrer policy, repeated actions and disposal.
- Loaded-tile selection, failed/loading tile fallback without silently changing coordinates.
- Drag without intermediate tile requests, canceled gestures, keyboard controls, browser shortcuts, city navigation without accidental selection, and zoom limits.
- Eight intuitive front-heading shortcuts and true-north/camera separation copy.

These are pure math, HTML, and mocked-DOM tests; no test pulls a real OSM tile. An attempted local Chromium UI run was blocked by the execution environment (`socket() failed: Operation not permitted`), including an approved escalation. Therefore actual browser layout, touch behavior, network loading, referrer delivery and hosted CSP must still be checked in a real browser. Existing roof/solar automated integration tests also pass after the new hooks.
