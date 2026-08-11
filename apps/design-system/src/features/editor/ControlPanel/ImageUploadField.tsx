import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'

interface ImageUploadFieldProps {
  onFileSelected: (file: File) => void
}

/**
 * Espelha imgUpload() do Gerador/index.html original (linha 2842) — mesma função
 * (escolher PNG/JPG/WEBP para um slot), agora com drag-and-drop via react-dropzone
 * além do clique (o original só suportava clique).
 */
export function ImageUploadField({ onFileSelected }: ImageUploadFieldProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (file) onFileSelected(file)
    },
    [onFileSelected],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/png': [], 'image/jpeg': [], 'image/webp': [] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-3.5 text-center transition-colors ${
        isDragActive ? 'border-brand-red bg-brand-red/5' : 'border-ui-border hover:border-brand-red hover:bg-brand-red/5'
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="mx-auto mb-1.5 text-ui-muted" size={18} />
      <div className="text-xs text-ui-muted">
        <strong className="block text-[13px] text-brand-red">Escolher Arquivo</strong>
        PNG, JPG, WEBP
      </div>
    </div>
  )
}
