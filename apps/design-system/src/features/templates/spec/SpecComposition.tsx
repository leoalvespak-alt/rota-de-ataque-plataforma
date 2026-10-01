import { Fragment, type ReactNode } from 'react'
import type { TemplateRenderProps } from '../types'
import { TBody } from '../primitives/TBody'
import { TEyebrow } from '../primitives/TEyebrow'
import { TTitle } from '../primitives/TTitle'

export type SpecLayout =
  | 'feed-editorial-column'
  | 'feed-proof-macro'
  | 'feed-method-map'
  | 'feed-decision-tree'
  | 'feed-side-by-side'
  | 'feed-open-sequence'
  | 'feed-exam-anatomy'
  | 'feed-date-line'
  | 'feed-mistake-diagnosis'
  | 'feed-principle-rule'
  | 'feed-annotated-example'
  | 'feed-single-cta'
  | 'story-entry-any-frame'
  | 'story-scenario-branch'
  | 'story-step-rail'
  | 'story-source-focus'
  | 'story-answer-ladder'
  | 'story-action-safe-zone'
  | 'carousel-case-walkthrough'
  | 'carousel-evidence-led'
  | 'carousel-decision-path'
  | 'carousel-misconception-check'
  | 'carousel-comparison-matrix'
  | 'carousel-application-lab'

export interface SpecElements extends Record<string, unknown> {
  eyebrow: string
  title: string
  body: string
  proof: string
  source: string
  action: string
  condition: string
  statement: string
  correction: string
  question: string
  answer: string
  leftTitle: string
  leftBody: string
  rightTitle: string
  rightBody: string
  step1: string
  step2: string
  step3: string
  step4: string
  row1Label: string
  row1Left: string
  row1Right: string
  row2Label: string
  row2Left: string
  row2Right: string
  row3Label: string
  row3Left: string
  row3Right: string
  proofImage?: string
}

type Props = TemplateRenderProps<SpecElements> & { layout: SpecLayout }

function Title({ value, dark = false, className = '', fontSize = 76 }: { value: string; path?: string; dark?: boolean; className?: string; fontSize?: number }) {
  return (
    <TTitle fontSize={fontSize} dark={dark} className={className}>
      {value}
    </TTitle>
  )
}

function Copy({ value, dark = false, className = '' }: { value: string; path?: string; dark?: boolean; className?: string }) {
  return (
    <TBody fontSize={32} dark={dark} className={className}>
      {value}
    </TBody>
  )
}

function Detail({ value, dark = false, className = '' }: { value: string; path?: string; dark?: boolean; className?: string }) {
  return (
    <TBody fontSize={23} dark={dark} className={className}>
      {value}
    </TBody>
  )
}

function Eyebrow({ value }: { value: string; dark?: boolean }) {
  if (!value) return null
  return (
    <TEyebrow fontSize={24}>
      {value}
    </TEyebrow>
  )
}

function Proof({ el, dark = false, className = '' }: { el: SpecElements; dark?: boolean; className?: string }) {
  return (
    <div className={`flex min-h-40 flex-col justify-center gap-4 border border-ui-border p-7 ${className}`}>
      {el.proofImage ? (
        <img src={el.proofImage} alt="Prova visual escolhida para esta composição" className="h-full max-h-[500px] w-full object-contain" />
      ) : (
        <Copy value={el.proof} path="proof" dark={dark} />
      )}
      <Detail value={el.source} path="source" dark={dark} />
    </div>
  )
}

function Pair({ el, dark = false, open = false }: { el: SpecElements; dark?: boolean; open?: boolean }) {
  const surface = open ? '' : 'border border-ui-border p-6'
  return (
    <div className="grid grid-cols-2 gap-7">
      <div className={`flex flex-col gap-4 ${surface}`}>
        <Title value={el.leftTitle} path="leftTitle" dark={dark} fontSize={48} />
        <Copy value={el.leftBody} path="leftBody" dark={dark} />
      </div>
      <div className={`flex flex-col gap-4 ${surface}`}>
        <Title value={el.rightTitle} path="rightTitle" dark={dark} fontSize={48} />
        <Copy value={el.rightBody} path="rightBody" dark={dark} />
      </div>
    </div>
  )
}

function Steps({ el, dark = false, horizontal = false }: { el: SpecElements; dark?: boolean; horizontal?: boolean }) {
  const steps = [el.step1, el.step2, el.step3, el.step4]
  return (
    <div className={horizontal ? 'grid grid-cols-4 gap-5' : 'flex flex-col gap-8'}>
      {steps.map((value, index) => (
        <div key={index} className={`flex ${horizontal ? 'flex-col' : 'items-start'} gap-4`}>
          <span className="font-heading text-[32px] font-bold text-brand-red">{index + 1}</span>
          <Copy value={value} path={`step${index + 1}`} dark={dark} />
        </div>
      ))}
    </div>
  )
}

function Frame({ dark, children, className = '' }: { dark: boolean; children: ReactNode; className?: string }) {
  return <div className={`relative z-[2] flex h-full flex-col gap-8 p-20 ${dark ? 'text-white' : 'text-ui-primary'} ${className}`}>{children}</div>
}

export function SpecComposition({ layout, elements: el, dark }: Props) {
  switch (layout) {
    case 'feed-editorial-column':
      return <Frame dark={dark} className="justify-start pt-40"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><div className="max-w-[760px]"><Copy value={el.body} dark={dark} /></div><Detail value={el.condition} path="condition" dark={dark} /></Frame>
    case 'feed-proof-macro':
      return <Frame dark={dark} className="grid grid-cols-[1.7fr_1fr] items-center gap-10"><Proof el={el} dark={dark} className="h-[860px]" /><div className="flex flex-col gap-8"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><Copy value={el.body} dark={dark} /></div></Frame>
    case 'feed-method-map':
      return <Frame dark={dark} className="justify-center"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><div className="grid grid-cols-2 gap-x-24 gap-y-10"><div className="flex items-start gap-5"><span className="font-heading text-[32px] font-bold text-brand-red">1</span><Copy value={el.step1} path="step1" dark={dark} /></div><div className="mt-12 flex items-start gap-5"><span className="font-heading text-[32px] font-bold text-brand-red">2</span><Copy value={el.step2} path="step2" dark={dark} /></div><div className="-mt-8 flex items-start gap-5"><span className="font-heading text-[32px] font-bold text-brand-red">3</span><Copy value={el.step3} path="step3" dark={dark} /></div><div className="mt-4 flex items-start gap-5"><span className="font-heading text-[32px] font-bold text-brand-red">4</span><Copy value={el.step4} path="step4" dark={dark} /></div></div></Frame>
    case 'feed-decision-tree':
      return <Frame dark={dark} className="justify-center"><Title value={el.question || el.title} path={el.question ? 'question' : 'title'} dark={dark} /><div className="grid grid-cols-2 gap-12"><div className="flex flex-col gap-5 border-l-2 border-ui-border pl-7"><Detail value={el.condition} path="condition" dark={dark} /><Copy value={el.leftBody} path="leftBody" dark={dark} /></div><div className="flex flex-col gap-5 border-l-2 border-ui-border pl-7"><Detail value={el.rightTitle} path="rightTitle" dark={dark} /><Copy value={el.rightBody} path="rightBody" dark={dark} /></div></div></Frame>
    case 'feed-side-by-side':
      return <Frame dark={dark} className="justify-center gap-12"><Title value={el.title} dark={dark} /><Pair el={el} dark={dark} open /></Frame>
    case 'feed-open-sequence':
      return <Frame dark={dark} className="justify-center"><Title value={el.title} dark={dark} /><div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-3">{[el.step1, el.step2, el.step3, el.step4].map((value, index) => <Fragment key={index}><div className="flex flex-col gap-5"><span className="font-heading text-[32px] font-bold text-brand-red">{index + 1}</span><Copy value={value} path={`step${index + 1}`} dark={dark} /></div>{index < 3 && <span className="pt-1 font-heading text-[24px] text-ui-muted" aria-hidden="true">→</span>}</Fragment>)}</div></Frame>
    case 'feed-exam-anatomy':
      return <Frame dark={dark} className="justify-center"><Title value={el.title} dark={dark} /><div className="grid grid-cols-[0.8fr_1.2fr] items-center gap-10"><div className="flex flex-col gap-7"><Copy value={el.body} dark={dark} /><Detail value={el.condition} path="condition" dark={dark} /></div><Proof el={el} dark={dark} className="min-h-[760px]" /></div></Frame>
    case 'feed-date-line':
      return <Frame dark={dark} className="justify-center"><Title value={el.title} dark={dark} /><Steps el={el} dark={dark} horizontal /><Copy value={el.body} dark={dark} /></Frame>
    case 'feed-mistake-diagnosis':
      return <Frame dark={dark} className="justify-center"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><div className="grid grid-cols-2 gap-12"><div className="flex flex-col gap-5"><Detail value={el.leftTitle} path="leftTitle" dark={dark} /><Copy value={el.leftBody} path="leftBody" dark={dark} /></div><div className="flex flex-col gap-5"><Detail value={el.rightTitle} path="rightTitle" dark={dark} /><Copy value={el.rightBody} path="rightBody" dark={dark} /></div></div></Frame>
    case 'feed-principle-rule':
      return <Frame dark={dark} className="justify-center"><div className="max-w-[830px]"><Title value={el.statement || el.title} path={el.statement ? 'statement' : 'title'} dark={dark} /></div><div className="grid grid-cols-[1fr_0.7fr] gap-12"><Copy value={el.body} dark={dark} /><Detail value={el.condition} path="condition" dark={dark} /></div></Frame>
    case 'feed-annotated-example':
      return <Frame dark={dark} className="grid grid-cols-[1.3fr_1fr] items-center"><div className="flex flex-col gap-7"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><Proof el={el} dark={dark} /></div><div className="flex flex-col gap-8"><Copy value={el.body} dark={dark} /><Detail value={el.condition} path="condition" dark={dark} /></div></Frame>
    case 'feed-single-cta':
      return <Frame dark={dark} className="justify-center"><div className="max-w-[800px]"><Title value={el.title} dark={dark} /></div><Copy value={el.body} dark={dark} /><div className="mt-4 max-w-[720px] border border-ui-border p-7"><Copy value={el.action} path="action" dark={dark} /></div></Frame>
    case 'story-entry-any-frame':
      return <Frame dark={dark} className="justify-center px-20 py-[300px]"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><Copy value={el.body} dark={dark} /><Detail value={el.condition} path="condition" dark={dark} /></Frame>
    case 'story-scenario-branch':
      return <Frame dark={dark} className="justify-center px-20 py-[300px]"><Title value={el.question || el.title} path={el.question ? 'question' : 'title'} dark={dark} /><Pair el={el} dark={dark} open /></Frame>
    case 'story-step-rail':
      return <Frame dark={dark} className="justify-center px-20 py-[300px]"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><Steps el={el} dark={dark} /></Frame>
    case 'story-source-focus':
      return <Frame dark={dark} className="justify-center px-20 py-[280px]"><Title value={el.title} dark={dark} /><Proof el={el} dark={dark} className="min-h-[650px]" /><Copy value={el.body} dark={dark} /></Frame>
    case 'story-answer-ladder':
      return <Frame dark={dark} className="justify-center px-20 py-[300px]"><Detail value={el.question} path="question" dark={dark} /><Title value={el.answer || el.title} path={el.answer ? 'answer' : 'title'} dark={dark} /><Copy value={el.body} dark={dark} /><Detail value={el.condition} path="condition" dark={dark} /></Frame>
    case 'story-action-safe-zone':
      return <Frame dark={dark} className="justify-center px-20 py-[300px]"><div className="max-w-[820px]"><Title value={el.title} dark={dark} /></div><Copy value={el.body} dark={dark} /><div className="mt-3 border border-ui-border p-7"><Copy value={el.action} path="action" dark={dark} /></div></Frame>
    case 'carousel-case-walkthrough':
      return <Frame dark={dark} className="justify-center"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><Copy value={el.body} dark={dark} /><Detail value={el.condition} path="condition" dark={dark} /></Frame>
    case 'carousel-evidence-led':
      return <Frame dark={dark} className="justify-center"><Proof el={el} dark={dark} className="min-h-[650px]" /><div className="grid grid-cols-[1.2fr_0.8fr] items-start gap-9"><Title value={el.title} dark={dark} /><Copy value={el.body} dark={dark} /></div></Frame>
    case 'carousel-decision-path':
      return <Frame dark={dark} className="justify-center"><Title value={el.question || el.title} path={el.question ? 'question' : 'title'} dark={dark} /><Steps el={el} dark={dark} horizontal /><Detail value={el.condition} path="condition" dark={dark} /></Frame>
    case 'carousel-misconception-check':
      return <Frame dark={dark} className="justify-center gap-12"><div className="max-w-[880px]"><Title value={el.statement || el.title} path={el.statement ? 'statement' : 'title'} dark={dark} /></div><div className="grid grid-cols-2 gap-12"><div className="flex flex-col gap-5"><Detail value={el.leftTitle} path="leftTitle" dark={dark} /><Copy value={el.leftBody} path="leftBody" dark={dark} /></div><div className="flex flex-col gap-5"><Detail value={el.rightTitle || 'CORREÇÃO'} path="rightTitle" dark={dark} /><Copy value={el.correction} path="correction" dark={dark} /></div></div><Detail value={el.source} path="source" dark={dark} /></Frame>
    case 'carousel-comparison-matrix':
      return <Frame dark={dark} className="justify-center gap-8"><Title value={el.title} dark={dark} /><div className="grid grid-cols-[0.8fr_1fr_1fr] items-start gap-x-7 gap-y-5"><div /><Detail value={el.leftTitle} path="leftTitle" dark={dark} /><Detail value={el.rightTitle} path="rightTitle" dark={dark} /><Detail value={el.row1Label} path="row1Label" dark={dark} /><Copy value={el.row1Left} path="row1Left" dark={dark} /><Copy value={el.row1Right} path="row1Right" dark={dark} /><Detail value={el.row2Label} path="row2Label" dark={dark} /><Copy value={el.row2Left} path="row2Left" dark={dark} /><Copy value={el.row2Right} path="row2Right" dark={dark} /><Detail value={el.row3Label} path="row3Label" dark={dark} /><Copy value={el.row3Left} path="row3Left" dark={dark} /><Copy value={el.row3Right} path="row3Right" dark={dark} /></div></Frame>
    case 'carousel-application-lab':
      return <Frame dark={dark} className="justify-center"><Eyebrow value={el.eyebrow} dark={dark} /><Title value={el.title} dark={dark} /><div className="grid grid-cols-2 gap-8"><Copy value={el.body} dark={dark} /><Proof el={el} dark={dark} /></div><Detail value={el.action} path="action" dark={dark} /></Frame>
  }
}
