import { NextResponse } from 'next/server'
import { Redis } from 'ioredis'
import { requireRole } from '@/lib/permissions'
export async function GET(){await requireRole('viewer');const redis=new Redis(process.env.REDIS_URL!);try{return NextResponse.json({enabled:await redis.get('kill-switch:global')==='1'})}finally{await redis.quit()}}
export async function POST(request:Request){const user=await requireRole('admin'),{accountId,enabled}=await request.json() as {accountId?:string;enabled:boolean},redis=new Redis(process.env.REDIS_URL!);try{const key=accountId?`kill-switch:account:${accountId}`:'kill-switch:global';if(enabled)await redis.set(key,'1');else await redis.del(key);await redis.xadd('audit:runtime','*','actor',user.email??'unknown','action','kill-switch','target',accountId??'global','enabled',String(enabled));return NextResponse.json({ok:true,key,enabled})}finally{await redis.quit()}}
