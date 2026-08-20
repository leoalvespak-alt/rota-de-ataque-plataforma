import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Provider endpoints and credentials are intentionally configured only on the server. */
export function ModelFormDialog({ editingId, onClose }: { editingId: string | null; onClose: () => void }) {
  return (
    <Dialog open={editingId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Catálogo administrado pelo servidor</DialogTitle></DialogHeader>
        <p className="text-sm text-ui-muted">
          Modelos, URLs permitidas e credenciais são definidos no ambiente da API. O navegador armazena somente a preferência do modelo ativo.
        </p>
      </DialogContent>
    </Dialog>
  )
}
