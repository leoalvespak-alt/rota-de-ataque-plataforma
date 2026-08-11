import { useCallback } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'

/**
 * Espelha handleImgUpload() do Gerador/index.html original (linha 3331): cria um
 * Object URL para o arquivo escolhido e grava em `state.elements[slotId]`
 * (ou `state.elements['img_' + slotId]` para slots que não são o fundo — aqui
 * simplificado para uma única convenção de chave por slotId, definida por cada template).
 */
export function useImageSlot(fieldPath: string) {
  const setElementField = useEditorStore((s) => s.setElementField)

  return useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      setElementField(fieldPath.split('.'), url)
    },
    [fieldPath, setElementField],
  )
}
