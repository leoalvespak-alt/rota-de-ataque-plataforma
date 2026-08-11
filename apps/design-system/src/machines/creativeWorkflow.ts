import { setup, assign } from 'xstate'

interface CreativeContext {
  templateId: string | null
  error: string | null
  progress: number
  retryCount: number
  exportFormat: string
  generatedText: Record<string, string>
  generatedImageUrl: string | null
}

type CreativeEvent =
  | { type: 'SELECT_TEMPLATE'; templateId: string }
  | { type: 'EDIT' }
  | { type: 'REQUEST_COPY' }
  | { type: 'COPY_GENERATED'; fields: Record<string, string> }
  | { type: 'COPY_FAILED'; error: string }
  | { type: 'REQUEST_IMAGE' }
  | { type: 'IMAGE_GENERATED'; url: string }
  | { type: 'IMAGE_FAILED'; error: string }
  | { type: 'VALIDATE' }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED'; error: string }
  | { type: 'RENDER' }
  | { type: 'RENDER_COMPLETE' }
  | { type: 'RENDER_FAILED'; error: string }
  | { type: 'EXPORT'; format: string }
  | { type: 'EXPORT_COMPLETE' }
  | { type: 'EXPORT_FAILED'; error: string }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'CANCEL' }

export const creativeWorkflowMachine = setup({
  types: {
    context: {} as CreativeContext,
    events: {} as CreativeEvent,
  },
}).createMachine({
  id: 'creativeWorkflow',
  initial: 'idle',
  context: {
    templateId: null,
    error: null,
    progress: 0,
    retryCount: 0,
    exportFormat: 'png',
    generatedText: {},
    generatedImageUrl: null,
  },
  states: {
    idle: {
      on: {
        SELECT_TEMPLATE: {
          target: 'editing',
          actions: assign({
            templateId: ({ event }) => event.templateId,
            error: () => null,
          }),
        },
      },
    },
    editing: {
      on: {
        REQUEST_COPY: 'generatingCopy',
        REQUEST_IMAGE: 'generatingImage',
        VALIDATE: 'validating',
        EXPORT: {
          target: 'rendering',
          actions: assign({ exportFormat: ({ event }) => event.format }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            templateId: () => null,
            error: () => null,
            progress: () => 0,
            generatedText: () => ({}),
            generatedImageUrl: () => null,
          }),
        },
      },
    },
    generatingCopy: {
      on: {
        COPY_GENERATED: {
          target: 'editing',
          actions: assign({
            generatedText: ({ event }) => event.fields,
          }),
        },
        COPY_FAILED: {
          target: 'failed',
          actions: assign({ error: ({ event }) => event.error }),
        },
        CANCEL: 'editing',
      },
    },
    generatingImage: {
      on: {
        IMAGE_GENERATED: {
          target: 'editing',
          actions: assign({
            generatedImageUrl: ({ event }) => event.url,
          }),
        },
        IMAGE_FAILED: {
          target: 'failed',
          actions: assign({ error: ({ event }) => event.error }),
        },
        CANCEL: 'editing',
      },
    },
    validating: {
      on: {
        VALIDATION_PASSED: 'editing',
        VALIDATION_FAILED: {
          target: 'failed',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    rendering: {
      entry: assign({ progress: () => 0 }),
      on: {
        RENDER_COMPLETE: 'exporting',
        RENDER_FAILED: {
          target: 'failed',
          actions: assign({ error: ({ event }) => event.error }),
        },
        CANCEL: 'editing',
      },
    },
    exporting: {
      on: {
        EXPORT_COMPLETE: 'completed',
        EXPORT_FAILED: {
          target: 'failed',
          actions: assign({ error: ({ event }) => event.error }),
        },
        CANCEL: 'editing',
      },
    },
    completed: {
      on: {
        EDIT: 'editing',
        RESET: {
          target: 'idle',
          actions: assign({
            templateId: () => null,
            error: () => null,
            progress: () => 0,
            retryCount: () => 0,
          }),
        },
      },
    },
    failed: {
      on: {
        RETRY: {
          target: 'editing',
          actions: assign({
            error: () => null,
            retryCount: ({ context }) => context.retryCount + 1,
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            templateId: () => null,
            error: () => null,
            progress: () => 0,
            retryCount: () => 0,
          }),
        },
      },
    },
  },
})
