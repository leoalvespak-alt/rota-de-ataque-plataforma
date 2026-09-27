# UI

`src/app/AppShell.tsx` provides the shared shell; `src/app/router.tsx` lazy-loads major tabs and editorial subroutes. Page components use semantic UI tokens and utility classes. Token sources live in `src/tokens/primitives` and `src/tokens/semantic`; generated outputs are under `src/tokens/build`.

The editorial analytics view lives at `/teses/metricas`. It reports loading and API error states, offers retry, and distinguishes a missing valid quality score from a score of zero.

Keep navigation in the router, shared layout in the shell and feature-specific state in its feature/store modules. Verify narrow and wide layouts when adding new surfaces.
