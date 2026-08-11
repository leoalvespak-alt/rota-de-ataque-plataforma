'use client'

import { EmptyState, PageHeader, ThreePaneLayout, TimelineFeed } from '@plataforma/ui-bridge'
import { useCallback, useEffect, useState } from 'react'

interface ReviewItem { id:string; item_type:string; reason:string|null; suggested_action:Record<string,unknown>; context:Record<string,unknown>; created_at:string }
export function ReviewInboxClient({ initialItems, decidedToday }: { initialItems: ReviewItem[]; decidedToday: number }) {
  const [items, setItems] = useState(initialItems)
  const [index, setIndex] = useState(0)
  const current = items[index]
  const decide = useCallback(async (action:'approve'|'edit'|'reject'|'block'|'snooze') => {
    if (!current) return
    const response = await fetch(`/prospector/api/review-inbox/${current.id}/${action}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(action==='snooze'?{snoozeUntil:new Date(Date.now()+86_400_000).toISOString()}:{}) })
    if (response.ok && action !== 'edit') { setItems((value) => value.filter((item) => item.id !== current.id)); setIndex(0) }
  }, [current])
  useEffect(() => {
    const handler = (event:KeyboardEvent) => { if ((event.target as HTMLElement)?.matches('input,textarea')) return; const key=event.key.toLowerCase(); if(key==='a')void decide('approve');else if(key==='e')void decide('edit');else if(key==='r')void decide('reject');else if(key==='b')void decide('block');else if(key==='.')void decide('snooze');else if(key==='j')setIndex((value)=>Math.min(items.length-1,value+1));else if(key==='k')setIndex((value)=>Math.max(0,value-1));else if(['1','2','3'].includes(key)&&current)setIndex(Number(key)-1<items.length?Number(key)-1:index) }
    window.addEventListener('keydown',handler); return()=>window.removeEventListener('keydown',handler)
  }, [current, decide, index, items.length])
  return <div className="page"><PageHeader title="Review Inbox" subtitle="Triagem humana com trilha de auditoria" />
    {!current ? <EmptyState message={`Nada para revisar agora 🎉 · ${decidedToday} decisões hoje`} /> : <ThreePaneLayout
      list={<><h2>Pendentes ({items.length})</h2>{items.map((item,i)=><button className="review-list-item" aria-current={i===index?'true':undefined} key={item.id} onClick={()=>setIndex(i)}><strong>{item.item_type}</strong><small>{item.reason}</small></button>)}</>}
      detail={<><p className="eyebrow">{current.item_type}</p><h2>{current.reason ?? 'Revisão necessária'}</h2><pre className="json-preview">{JSON.stringify(current.suggested_action,null,2)}</pre><div className="review-actions"><button onClick={()=>void decide('approve')}>A · Aprovar</button><button onClick={()=>void decide('edit')}>E · Editar</button><button onClick={()=>void decide('reject')}>R · Rejeitar</button><button onClick={()=>void decide('block')}>B · Bloquear</button><button onClick={()=>void decide('snooze')}>. · Adiar</button></div></>}
      context={<><h2>Contexto</h2><pre className="json-preview">{JSON.stringify(current.context,null,2)}</pre><h3>Histórico</h3><TimelineFeed events={[]} /></>}/>} 
  </div>
}
