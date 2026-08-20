/**
 * Feedback component stories (StatusBadge, PriorityChip, ScoreBadge, etc.)
 */
import type { Meta, StoryObj } from '@storybook/react'
import { StatusBadge, PriorityChip, LiveBadge } from './patterns'
import { ScoreBadge } from './data'

// --- StatusBadge ---
const statusMeta: Meta<typeof StatusBadge> = {
  title: 'ui-bridge/StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'centered' },
}
export default statusMeta

type StatusStory = StoryObj<typeof StatusBadge>

export const Active: StatusStory = { args: { status: 'active' } }
export const Pending: StatusStory = { args: { status: 'pending' } }
export const Failed: StatusStory = { args: { status: 'failed' } }
export const Blocked: StatusStory = { args: { status: 'blocked' } }
export const Published: StatusStory = { args: { status: 'published' } }
export const Draft: StatusStory = { args: { status: 'draft' } }
