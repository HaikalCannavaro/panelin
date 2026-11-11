# Panelin static hosting

`npm run build` copies the current browser application into `dist/`. It has no external build dependencies and does not publish anything. Only `index.html`, browser JavaScript/styles and public assets are included; tests, documentation, the development server and private configuration are excluded.

The tracked `.openai/hosting.json` records this Site's identity and `dist` as its static directory. Reuse that project ID for all future versions. A Site registration is not a deployment or proof of a live URL.

## Security and map policy

`hosting/_headers` contains the response policies for compatible static hosts. The build additionally inserts a matching document CSP and default referrer policy into `dist/index.html`; `frame-ancestors` remains response-header-only. The CSP keeps scripts, connections and Web Workers same-origin. Only `https://tile.openstreetmap.org` is allowed as an additional image source, and map images explicitly use `referrerPolicy="origin"` for the OSM tile policy. No map requests occur until the visitor activates the optional map.

Headers imposed by a hosting platform can be more restrictive than the application policy. Check the actual deployed response and optional tile loading after publication, not just these files. The local Node preview already sets the same security headers.

All app URLs and the calculation worker use root-relative paths. Deploy this bundle at the Site origin, not under an arbitrary subdirectory. HTTPS or a trusted localhost context is needed for the Web Crypto snapshot digest.

## Before publishing

1. Finish review and stop source changes during version packaging.
2. Run `npm run check`, `npm test` and `npm run build` against the final source.
3. Use the Sites workflow to push that exact source and package its matching build.
4. Save and deploy the matching version when publication is authorized.
5. Preserve the intended audience. The live Site is public; verify its current access policy before every deployment. The Panelin rename preserves the original Site identity and `https://suryajelas.workspace-100082.chatgpt.site` URL.
6. After deployment succeeds, verify the returned production URL, root-relative modules, calculation worker, snapshot export and optional OSM tile loading. A local preview does not verify hosted access or headers.

The estimates remain assumptions-based. Hosting does not add measured weather, official tariff updates, structural validation, vendor services or a backend.
