/**
 * Dialog / Drawer component stories
 */
import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { ConfirmDialog } from './dialogs'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'ui-bridge/ConfirmDialog',
  component: ConfirmDialog,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof ConfirmDialog>

export const Default: Story = {
  args: {
    open: true,
    title: 'Confirmar ação',
    description: 'Tem certeza que deseja prosseguir? Esta ação não pode ser desfeita.',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onOpenChange: () => {},
    onConfirm: () => console.log('Confirmed'),
    variant: 'primary',
  },
}

export const Danger: Story = {
  args: {
    open: true,
    title: 'Excluir permanentemente',
    description: 'Esta ação irá excluir todos os dados vinculados. Não pode ser revertida.',
    confirmText: 'Excluir',
    cancelText: 'Cancelar',
    onOpenChange: () => {},
    onConfirm: () => console.log('Deleted'),
    variant: 'danger',
  },
}
