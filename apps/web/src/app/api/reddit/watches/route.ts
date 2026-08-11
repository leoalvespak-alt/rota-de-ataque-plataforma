import { createDatabase } from '@plataforma/db'
import { createQueueRegistry, enqueueOnce } from '@plataforma/queue'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/permissions'

const Input = z.object({ campaignId:z.string().uuid(),kind:z.enum(['subreddit','search_query','user','keyword_across']),value:z.string().trim().min(1).max(300),active:z.boolean().default(true) })
export async function GET(){await requireRole('viewer');const {pool}=createDatabase(process.env.DATABASE_URL!);try{return NextResponse.json({items:(await pool.query(`SELECT watch.*,campaign.name campaign FROM reddit_watches watch JOIN campaigns campaign ON campaign.id=watch.campaign_id ORDER BY watch.active DESC,watch.next_run_at NULLS FIRST`)).rows})}finally{await pool.end()}}
export async function POST(request:Request){const user=await requireRole('operator');const input=Input.parse(await request.json());const {pool}=createDatabase(process.env.DATABASE_URL!);const registry=createQueueRegistry(process.env.REDIS_URL!);try{const row=(await pool.query<{id:string}>(`INSERT INTO reddit_watches(campaign_id,kind,value,active,next_run_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(kind,value) DO UPDATE SET campaign_id=EXCLUDED.campaign_id,active=EXCLUDED.active,next_run_at=now() RETURNING id`,[input.campaignId,input.kind,input.value,input.active])).rows[0]!;await pool.query(`INSERT INTO audit_log(actor_id,action,target,after) VALUES($1,'reddit_watch.upsert',$2,$3::jsonb)`,[user.email??'unknown',row.id,JSON.stringify(input)]);await enqueueOnce(registry.queues['reddit-intelligence'],'reddit-intelligence',[row.id,'manual'],{watchId:row.id});return NextResponse.json({ok:true,id:row.id},{status:201})}finally{await pool.end();await registry.connection.quit()}}
