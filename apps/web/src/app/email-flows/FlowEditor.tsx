'use client'

import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EmptyState } from '@plataforma/ui-bridge'

export default function FlowEditor({ nodes }: { nodes?: Array<{ id: string; type: string; label: string }> }) {
  if (!nodes || nodes.length === 0) return <EmptyState message="Nenhum nó no fluxo." />

  const flowNodes = nodes.map((node, i) => ({
    id: node.id,
    position: { x: 250, y: i * 150 + 50 },
    data: { label: node.label },
    type: 'default',
  }))

  const flowEdges = nodes.slice(0, -1).map((node, i) => ({
    id: `e${node.id}-${nodes[i+1]!.id}`,
    source: node.id,
    target: nodes[i+1]!.id,
  }))

  return (
    <div style={{ width: '100%', height: '400px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
