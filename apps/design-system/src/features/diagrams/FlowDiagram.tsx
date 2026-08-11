import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DiagramData } from './types'

interface FlowDiagramProps {
  data: DiagramData
  dark?: boolean
  className?: string
}

export function FlowDiagram({ data, dark, className }: FlowDiagramProps) {
  const nodeColor = useCallback(
    (type?: string) => {
      switch (type) {
        case 'accent':
          return { bg: '#C1121F', text: '#FFFFFF', border: '#8B0000' }
        case 'highlight':
          return { bg: '#D4A017', text: '#0A0A0A', border: '#B8860B' }
        case 'muted':
          return dark
            ? { bg: '#1F1F1F', text: '#B0B0B0', border: '#262626' }
            : { bg: '#EAEAE5', text: '#3D3D3D', border: '#D4D4CF' }
        default:
          return dark
            ? { bg: '#171717', text: '#F0F0F0', border: '#262626' }
            : { bg: '#F5F5F0', text: '#0A0A0A', border: '#D4D4CF' }
      }
    },
    [dark],
  )

  const nodes: Node[] = useMemo(
    () =>
      data.nodes.map((n, i) => {
        const colors = nodeColor(n.type)
        return {
          id: n.id,
          position: { x: i * 200, y: 0 },
          data: { label: n.label },
          style: {
            background: colors.bg,
            color: colors.text,
            border: `2px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '12px 20px',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            fontSize: '13px',
          },
        }
      }),
    [data.nodes, nodeColor],
  )

  const edges: Edge[] = useMemo(
    () =>
      data.edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated,
        style: { stroke: dark ? '#B0B0B0' : '#3D3D3D' },
        labelStyle: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '11px' },
      })),
    [data.edges, dark],
  )

  return (
    <div className={className} style={{ height: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color={dark ? '#262626' : '#D4D4CF'} gap={40} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
