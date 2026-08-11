import type { Meta, StoryObj } from '@storybook/react-vite'
import { BrandText } from './BrandText'

const meta: Meta<typeof BrandText> = {
  title: 'Brand/BrandText',
  component: BrandText,
  argTypes: {
    variant: {
      control: 'select',
      options: ['heading', 'body', 'eyebrow', 'caption', 'numeral', 'quote'],
    },
    dark: { control: 'boolean' },
    uppercase: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof BrandText>

export const Heading: Story = {
  args: { variant: 'heading', children: 'ROTA DE ATAQUE', dark: false },
}

export const HeadingDark: Story = {
  args: { variant: 'heading', children: 'ROTA DE ATAQUE', dark: true },
}

export const Body: Story = {
  args: { variant: 'body', children: 'Texto do corpo com fonte IBM Plex Sans.', dark: false },
}

export const Eyebrow: Story = {
  args: { variant: 'eyebrow', children: 'CONCURSO FISCAL', dark: false },
}

export const Caption: Story = {
  args: { variant: 'caption', children: 'Legenda com fonte leve e tamanho reduzido.', dark: true },
}

export const Numeral: Story = {
  args: { variant: 'numeral', children: '1.234.567', dark: false },
}

export const Quote: Story = {
  args: { variant: 'quote', children: 'A disciplina e a ponte entre metas e conquistas.', dark: true },
}
