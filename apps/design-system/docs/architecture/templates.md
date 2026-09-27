# Templates

`src/features/templates/registry.ts` is the current registry for 26 templates: 12 square, 6 portrait and 8 carousel. Each entry binds an ID to defaults, a React renderer and controls. Some entries also declare field schemas, capabilities and visual variants.

The registry is consumed by creation flows and gallery previews. Thumbnail rendering reuses each template's own renderer. Format-specific components and defaults are grouped in `square/`, `portrait/` and `carousel/`.

The plan's adaptive catalog of 50 approved compositions is not present yet. The current registry count and its capabilities should be treated as the code truth until that work is completed and inspected.
