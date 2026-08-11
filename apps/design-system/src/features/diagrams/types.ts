export interface DiagramNode {
  id: string
  label: string
  type?: 'default' | 'accent' | 'highlight' | 'muted'
  description?: string
}

export interface DiagramEdge {
  source: string
  target: string
  label?: string
  animated?: boolean
}

export interface DiagramData {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
}
