import type { Meta, StoryObj } from '@storybook/react-vite'
import { BrandCallout } from './BrandCallout'

const meta: Meta<typeof BrandCallout> = {
  title: 'Brand/BrandCallout',
  component: BrandCallout,
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'warning', 'danger', 'success', 'tip', 'law', 'concept'],
    },
    dark: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof BrandCallout>

export const Tip: Story = {
  args: {
    variant: 'tip',
    dark: false,
    children: 'Memorize os artigos mais cobrados pela banca.',
  },
}

export const Law: Story = {
  args: {
    variant: 'law',
    dark: true,
    children: 'Art. 37. A administracao publica obedecera aos principios de legalidade, impessoalidade, moralidade, publicidade e eficiencia.',
  },
}

export const Concept: Story = {
  args: {
    variant: 'concept',
    dark: false,
    children: 'Competencia tributaria e a aptidao para criar tributos por meio de lei.',
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    dark: true,
    children: 'Atencao: este tema foi cobrado nas ultimas 5 provas consecutivas.',
  },
}
