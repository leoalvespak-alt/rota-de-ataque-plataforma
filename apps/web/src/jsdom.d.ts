declare module 'jsdom' {
  interface JSDOMWindow {
    document: Document
    Node: typeof Node
    Element: typeof Element
    HTMLElement: typeof HTMLElement
    close(): void
  }
  export class JSDOM {
    constructor(html?: string)
    window: JSDOMWindow
  }
}
