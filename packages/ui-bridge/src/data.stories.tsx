/**
 * DataGrid stories
 * Covering sorting, selection, pagination and row actions
 */
import type { Meta, StoryObj } from '@storybook/react'
import { DataGrid, createColumnHelper } from './data'

// @ts-expect-error
const helper = createColumnHelper<any>()

const columns = [
  helper.accessor('name', { header: 'Nome', cell: (info: any) => <strong>{info.getValue()}</strong> }),
  helper.accessor('status', { header: 'Status' }),
  helper.accessor('score', { header: 'Score', cell: (info: any) => <span>{info.getValue()}</span> }),
]

const data = [
  { id: '1', name: 'Alice Silva', status: 'active', score: 87 },
  { id: '2', name: 'Bruno Costa', status: 'pending', score: 54 },
  { id: '3', name: 'Carla Lima', status: 'blocked', score: 20 },
  { id: '4', name: 'Diego Mota', status: 'active', score: 95 },
  { id: '5', name: 'Eva Nunes', status: 'pending', score: 62 },
]

const meta: Meta<typeof DataGrid> = {
  title: 'ui-bridge/DataGrid',
  component: DataGrid,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof DataGrid>

export const Default: Story = {
  args: {
    columns,
    data,
    enableSorting: true,
    enableSelection: false,
  },
}

export const WithSelection: Story = {
  args: {
    columns,
    data,
    enableSorting: true,
    enableSelection: true,
    onSelectionChange: (ids) => console.log('Selected:', ids),
  },
}

export const Empty: Story = {
  args: {
    columns,
    data: [],
    enableSorting: true,
    enableSelection: false,
  },
}

export const Loading: Story = {
  args: {
    columns,
    data: [],
    loading: true,
    enableSorting: false,
    enableSelection: false,
  },
}
