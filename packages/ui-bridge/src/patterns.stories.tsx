import type { Meta, StoryObj } from '@storybook/react'
import { FilterBar, KanbanBoard } from './patterns'
import { KpiCard } from './data'

const meta = {
  title: 'Plataforma/KpiCard',
  component: KpiCard,
  args: { label: 'Leads P0', value: 42, delta: 12 }
} satisfies Meta<typeof KpiCard>

export default meta

export const Default: StoryObj<typeof meta> = {}
export const Dense: StoryObj<typeof meta> = { parameters: { density: 'compact' } }
