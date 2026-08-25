/** Compatibilidade por uma release. A operação canônica vive em /api/market-watches. */
import { GET as marketWatchesGet, POST as marketWatchesPost } from '@/app/api/market-watches/route'

export async function GET(_request: Request) { return marketWatchesGet() }
export async function POST(request: Request) { return marketWatchesPost(request) }
