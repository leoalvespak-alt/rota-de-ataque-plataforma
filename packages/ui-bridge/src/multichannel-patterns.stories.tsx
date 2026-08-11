import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas, MarketSignalCard, VariantPreview } from './patterns.js'

const meta = { title:'Plataforma/Multicanal/VariantPreview', component:VariantPreview, args:{ channel:'threads', text:'Uma ideia\nem duas linhas', status:'ready' } } satisfies Meta<typeof VariantPreview>
export default meta
export const Default:StoryObj<typeof meta> = {}
export const Loading:StoryObj<typeof meta> = { args:{ text:'Carregando…', status:'loading' } }
export const Empty:StoryObj<typeof meta> = { args:{ text:'Sem variante gerada', status:'empty' } }
export const Error:StoryObj<typeof meta> = { args:{ text:'Falha ao gerar', status:'error' } }
export const Dense:StoryObj<typeof meta> = { parameters:{ density:'compact' } }
export const Signal = () => <MarketSignalCard label="Dor recorrente" kind="pain_point" velocity={12} evidenceCount={4}/>
export const Flow = () => <FlowCanvas nodes={[{id:'entry',type:'Entry',label:'Opt-in'},{id:'send',type:'Send',label:'Boas-vindas'},{id:'exit',type:'Exit',label:'Sair'}]}/>
