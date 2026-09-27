# Exports and rendering

Template previews are React components. The server renderer in `src/server/render/playwrightRenderer.ts` keeps a Chromium browser instance, opens a page for each render, waits for network and fonts by default, and closes the page in `finally`. `renderHtml` supports PNG, JPEG and PDF; `renderUrl` currently returns image screenshots.

The browser also has image/export helpers for client-side flows. These paths are not yet proven to produce identical preview and exported bytes for every template. The unified plan requires one canonical Chromium path and visual inspection of real output before the Design catalog is accepted.

The API server closes its database pools on `SIGTERM`; the renderer exposes `closeBrowser()` for process shutdown. Per-render pages are closed after success or failure.
