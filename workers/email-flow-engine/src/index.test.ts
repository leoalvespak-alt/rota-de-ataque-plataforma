import { describe, expect, it } from 'vitest'
import { executeFlowStep, type FlowState } from './index.js'

describe('email flow', () => {
  it('advances after a compliant send', async () => {
    let next:string|undefined
    const state:FlowState={subscriberId:'s',flowId:'f',email:'a@b.com',steps:[{id:'one',type:'send',preheader:'Resumo diferente',message:{from:'x@y.com',subject:'Assunto claro',html:'<a href="https://example.com">Abrir</a>',plain:'Veja https://example.com',kind:'transactional'}},{id:'end',type:'end'}],eventKinds:[],suppressed:false,doubleOptin:true}
    await executeFlowStep(state,{due:async()=>[],sent:async()=>undefined,advance:async(_s,value)=>{next=value},affinity:async()=>undefined},{send:async()=>({provider:'resend',messageId:'m'}),parseWebhook:()=>[]})
    expect(next).toBe('end')
  })
  it('routes a noncompliant send to review', async () => {
    let reviewed=false
    const state:FlowState={subscriberId:'s',flowId:'f',email:'a@b.com',steps:[{id:'one',type:'send',message:{from:'x@y.com',subject:'s',html:'h',plain:'sem chamada',kind:'transactional'}}],eventKinds:[],suppressed:false,doubleOptin:true}
    await expect(executeFlowStep(state,{due:async()=>[],sent:async()=>undefined,advance:async()=>undefined,affinity:async()=>undefined,review:async()=>{reviewed=true}},{send:async()=>({provider:'resend',messageId:'m'}),parseWebhook:()=>[]})).rejects.toMatchObject({reasonCode:'HUMANIZATION_REVIEW_REQUIRED'})
    expect(reviewed).toBe(true)
  })
})
