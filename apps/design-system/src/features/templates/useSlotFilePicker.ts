import { useCallback, useRef } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'

/**
 * Espelha triggerFileInput()/handleImgUpload() do Gerador/index.html original
 * (linhas 3331-3363): cria um <input type="file"> temporário, e ao selecionar
 * um arquivo grava o Object URL em `state.elements[slotId]`.
 *
 * Retorna um `onSlotClick(slotId)` compatível com o `onClick` do primitivo <TSlot>.
 */
export function useSlotFilePicker() {
  const setElementField = useEditorStore((s) => s.setElementField)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onSlotClick = useCallback(
    (slotId: string) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/jpg,image/webp'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const url = URL.createObjectURL(file)
        setElementField(slotId.split('.'), url)
      }
      inputRef.current = input
      input.click()
    },
    [setElementField],
  )

  return onSlotClick
}
