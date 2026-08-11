import { createDatabase } from '@plataforma/db'
import { requireRole } from '@/lib/permissions'

export const dynamic='force-dynamic'
export async function GET(request:Request){
  await requireRole('viewer')
  const encoder=new TextEncoder(); const { pool }=createDatabase(process.env.DATABASE_URL!); let timer:ReturnType<typeof setInterval>; let since=new Date()
  const stream=new ReadableStream({start(controller){
    const send=async()=>{try{const result=await pool.query(`SELECT id,payload,created_at FROM events WHERE created_at>$1 AND payload->>'type' LIKE 'engagement.%' ORDER BY created_at ASC LIMIT 100`,[since]);for(const event of result.rows){since=new Date(event.created_at);controller.enqueue(encoder.encode(`event: engagement\ndata: ${JSON.stringify(event)}\n\n`))}controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({at:new Date().toISOString()})}\n\n`))}catch{controller.enqueue(encoder.encode(`event: error\ndata: {"retry":true}\n\n`))}}
    void send();timer=setInterval(()=>void send(),5_000);request.signal.addEventListener('abort',()=>{clearInterval(timer);void pool.end();try{controller.close()}catch{}},{once:true})
  },cancel(){clearInterval(timer);void pool.end()}})
  return new Response(stream,{headers:{'content-type':'text/event-stream','cache-control':'no-cache, no-transform','connection':'keep-alive'}})
}
