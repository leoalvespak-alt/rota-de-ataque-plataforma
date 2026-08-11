import type { EmailEventKind } from '@plataforma/email-provider'
import { createWorker,type WorkerJob,type WorkerResult,type WorkerSpec } from '@plataforma/shared/worker'
export const spec={queue:'email-events-consumer',requiresMetaToken:false} satisfies WorkerSpec
export interface EmailEventPayload{provider:'resend'|'ses';externalEventId:string;kind:EmailEventKind;messageId?:string;email?:string;occurredAt:string;metadata:Record<string,unknown>}
export interface EmailEventRepository{consume(event:EmailEventPayload,traceId:string):Promise<{inserted:boolean;subscriberId?:string;leadId?:string}>}
export function createEmailEventConsumer(repository:EmailEventRepository){const gate=createWorker<EmailEventPayload>(spec);return async(job:WorkerJob<EmailEventPayload>):Promise<WorkerResult>=>{const base=await gate(job);const result=await repository.consume(job.payload,base.traceId);return{...base,event:{kind:'email-event.consumed',payload:{...result,kind:job.payload.kind}}}}}
