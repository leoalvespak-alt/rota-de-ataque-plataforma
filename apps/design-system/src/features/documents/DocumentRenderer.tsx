import type { DocumentData, DocumentBlock } from './types'
import { DocumentCanvas } from '@/components/brand'
import { BrandText, BrandDivider, BrandCallout, BrandQuote, BrandTable } from '@/components/brand'
import { cn } from '@/lib/utils'

interface DocumentRendererProps {
  document: DocumentData
  zoom?: number
  exportMode?: boolean
  className?: string
}

export function DocumentRenderer({ document: doc, zoom, exportMode, className }: DocumentRendererProps) {
  const dark = doc.dark ?? false

  return (
    <div className={cn('flex flex-col gap-6 items-center', className)}>
      {doc.pages.map((page, pageIndex) => (
        <DocumentCanvas
          key={page.id}
          dark={dark}
          zoom={zoom}
          pageNumber={doc.showPageNumbers !== false ? pageIndex + 1 : undefined}
          exportMode={exportMode}
        >
          <div className="flex flex-col gap-4">
            {pageIndex === 0 && doc.header && (
              <div className="text-center pb-4 border-b" style={{ borderColor: dark ? 'var(--dark-border)' : '#e0e0e0' }}>
                <BrandText variant="eyebrow" dark={dark} style={{ color: 'var(--red)' }}>
                  {doc.header}
                </BrandText>
              </div>
            )}
            {pageIndex === 0 && (
              <div className="text-center py-4">
                <BrandText variant="heading" dark={dark} className="text-2xl">
                  {doc.title}
                </BrandText>
                {doc.author && (
                  <BrandText variant="caption" dark={dark} className="mt-2">
                    {doc.author} {doc.date ? `— ${doc.date}` : ''}
                  </BrandText>
                )}
              </div>
            )}
            {page.blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} dark={dark} />
            ))}
          </div>
        </DocumentCanvas>
      ))}
    </div>
  )
}

function BlockRenderer({ block, dark }: { block: DocumentBlock; dark: boolean }) {
  switch (block.type) {
    case 'heading': {
      const tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'
      const size = block.level === 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : 'text-base'
      return (
        <BrandText variant="heading" as={tag} dark={dark} className={size}>
          {block.content}
        </BrandText>
      )
    }
    case 'paragraph':
      return (
        <BrandText variant="body" dark={dark} className="text-sm leading-relaxed">
          {block.content}
        </BrandText>
      )
    case 'list':
      return (
        <ul className="flex flex-col gap-1 pl-5">
          {(block.items ?? []).map((item, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span style={{ color: 'var(--red)' }} className="font-bold text-sm">•</span>
              <BrandText variant="body" dark={dark} className="text-sm">{item}</BrandText>
            </li>
          ))}
        </ul>
      )
    case 'callout':
      return (
        <BrandCallout variant="tip" dark={dark}>
          {block.content}
        </BrandCallout>
      )
    case 'quote':
      return <BrandQuote dark={dark}>{block.content}</BrandQuote>
    case 'table':
      return (
        <BrandTable
          headers={(block.data?.headers as string[]) ?? []}
          rows={(block.data?.rows as string[][]) ?? []}
          dark={dark}
        />
      )
    case 'divider':
      return <BrandDivider variant="accent" dark={dark} />
    case 'reference':
      return (
        <div className="text-xs pl-4 border-l-2" style={{ borderColor: 'var(--ui-muted)', color: dark ? 'var(--dark-muted)' : 'var(--light-muted)' }}>
          {block.content}
        </div>
      )
    default:
      return (
        <BrandText variant="body" dark={dark} className="text-sm">
          {block.content}
        </BrandText>
      )
  }
}
