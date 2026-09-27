# Editor

`src/app/CreateTab.tsx` composes the creation flow. Template renderers and controls live under `src/features/templates`; the editor canvas and text controls live under `src/features/editor`.

Zustand stores hold editor, decoration, series, wizard and UI state. `src/domain/adapters.ts` converts the current editor/slide state into the versioned project document model. `ProjectSessionProvider` subscribes to editor changes, schedules autosaves and flushes on visibility changes. A recovery notice reports recoverable project state.

The session provider is an opt-in bridge around the existing editor stores. Its local project selection and current database project API are not yet the unified editorial revision authority from the plan.
