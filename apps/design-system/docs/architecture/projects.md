# Projects

The Hono `/api/projects` routes read and mutate `creative_projects` through Drizzle. Every read, update and delete is scoped to the authenticated user ID; request bodies are validated with Zod. The project service is mounted behind the API authentication middleware.

In the browser, `ProjectSessionProvider` uses `ProjectRepository`, converts editor state to a versioned project document and schedules autosaves. `useProjectSessionStore` tracks the selected project and save/recovery state.

Project persistence remains within the Design System database. Cross-product creative IDs, a shared revision ledger and Prospector-owned approval/publication authority are future migration work.
