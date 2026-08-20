import { createDatabase } from '@plataforma/db'
import { NextResponse } from 'next/server'
import { getIntegrationCapabilities } from '@/lib/integration-capabilities'
import { requireRole } from '@/lib/permissions'

export const dynamic='force-dynamic'
export async function GET(){await requireRole('viewer');const{pool}=createDatabase(process.env.DATABASE_URL!);try{return NextResponse.json({data:await getIntegrationCapabilities(pool),meta:{requestId:crypto.randomUUID(),generatedAt:new Date().toISOString(),sourceStatus:'ready'}})}finally{}}
