import type { DiagramData } from './types'
import { cn } from '@/lib/utils'

interface BrandSvgDiagramProps {
  data: DiagramData
  dark?: boolean
  width?: number
  height?: number
  className?: string
}

export function BrandSvgDiagram({
  data,
  dark,
  width = 800,
  height = 400,
  className,
}: BrandSvgDiagramProps) {
  const nodeWidth = 160
  const nodeHeight = 48
  const padding = 60
  const cols = Math.ceil(Math.sqrt(data.nodes.length))
  const hGap = (width - padding * 2) / Math.max(cols, 1)
  const vGap = 100

  const positions = data.nodes.map((_, i) => ({
    x: padding + (i % cols) * hGap + hGap / 2,
    y: padding + Math.floor(i / cols) * vGap + vGap / 2,
  }))

  const posMap = new Map(data.nodes.map((n, i) => [n.id, positions[i]!]))

  const colors = {
    bg: dark ? '#0A0A0A' : '#F5F5F0',
    node: dark ? '#171717' : '#FFFFFF',
    text: dark ? '#F0F0F0' : '#0A0A0A',
    border: dark ? '#262626' : '#D4D4CF',
    line: dark ? '#B0B0B0' : '#3D3D3D',
    accent: '#C1121F',
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <rect width={width} height={height} fill={colors.bg} rx="8" />

      {data.edges.map((edge, i) => {
        const from = posMap.get(edge.source)
        const to = posMap.get(edge.target)
        if (!from || !to) return null
        return (
          <line
            key={`edge-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={colors.line}
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
        )
      })}

      {data.nodes.map((node, i) => {
        const pos = positions[i]!
        const isAccent = node.type === 'accent'
        return (
          <g key={node.id}>
            <rect
              x={pos.x - nodeWidth / 2}
              y={pos.y - nodeHeight / 2}
              width={nodeWidth}
              height={nodeHeight}
              fill={isAccent ? colors.accent : colors.node}
              stroke={isAccent ? colors.accent : colors.border}
              strokeWidth={2}
              rx={8}
            />
            <text
              x={pos.x}
              y={pos.y + 5}
              textAnchor="middle"
              fill={isAccent ? '#FFFFFF' : colors.text}
              fontSize={13}
              fontWeight={600}
            >
              {node.label}
            </text>
          </g>
        )
      })}

      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={colors.line} />
        </marker>
      </defs>
    </svg>
  )
}
