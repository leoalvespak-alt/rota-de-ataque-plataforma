# Design System architecture

These notes describe the current Design System implementation. The unified editorial target architecture remains in [the flow plan](../../../../../Docs/PLANO-FLUXO-EDITORIAL-UNIFICADO-2026-09-26.md); it is not yet the production state.

## Areas

- [Overview](overview.md): browser app, API and runtime boundaries.
- [Editor](editor.md): editing stores, adapters and autosave.
- [Templates](templates.md): the current template registry.
- [Projects](projects.md): project API and session ownership.
- [AI](ai.md): provider configuration and generation routes.
- [Exports and rendering](exports-and-rendering.md): browser and server render paths.
- [Data and jobs](data-and-jobs.md): PostgreSQL schemas, migrations and task state.
- [UI](ui.md): routing, shell and design tokens.

Update the relevant note when a module boundary, data flow or runtime contract changes. Do not describe planned unification as deployed behavior.
