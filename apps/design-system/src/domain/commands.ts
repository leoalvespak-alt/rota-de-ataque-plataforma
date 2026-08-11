export interface AppCommand {
  id: string
  title: string
  category: string
  shortcut?: string
  enabled?: () => boolean
  execute: () => void | Promise<void>
}

const reserved = new Set(['ctrl+w', 'ctrl+r', 'ctrl+l', 'meta+w', 'meta+r', 'meta+l'])
export function normalizeShortcut(input: string): string { return input.toLowerCase().replaceAll(' ', '') }

export class CommandRegistry {
  private commands = new Map<string, AppCommand>()
  register(command: AppCommand): void {
    const shortcut = command.shortcut && normalizeShortcut(command.shortcut)
    if (shortcut && reserved.has(shortcut)) throw new Error('Esse atalho é reservado pelo navegador ou sistema.')
    const duplicate = [...this.commands.values()].find((item) => item.id !== command.id && item.shortcut && normalizeShortcut(item.shortcut) === shortcut)
    if (duplicate) throw new Error(`Atalho já usado por “${duplicate.title}”.`)
    this.commands.set(command.id, { ...command, shortcut })
  }
  search(query = ''): AppCommand[] {
    const normalized = query.toLocaleLowerCase('pt-BR')
    return [...this.commands.values()].filter((command) => `${command.title} ${command.category}`.toLocaleLowerCase('pt-BR').includes(normalized))
  }
  async run(id: string): Promise<void> {
    const command = this.commands.get(id)
    if (!command) throw new Error('Comando não encontrado.')
    if (command.enabled && !command.enabled()) return
    await command.execute()
  }
}

export function shouldHandleGlobalShortcut(event: KeyboardEvent): boolean {
  const target = event.target
  return !(target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('[role="dialog"]')))
}
