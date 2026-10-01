const HEARTBEAT_TTL_MS = 90_000

export interface HealthHeartbeat {
  worker: string
  last_beat_at: string
  state: string
}

export interface DesiredWorker {
  worker: string
  desired: boolean
}

export function summarizeWorkerHealth(
  heartbeats: HealthHeartbeat[],
  workers: DesiredWorker[],
  currentTime: number,
  executorReady: boolean,
) {
  const expectedWorkers = new Set([
    ...workers.filter((worker) => worker.desired).map((worker) => worker.worker),
    ...(executorReady ? ['editorial-executor'] : []),
  ])
  let active = 0
  let stale = 0
  let missing = 0

  for (const worker of expectedWorkers) {
    const running = heartbeats.filter((heartbeat) => heartbeat.worker === worker && heartbeat.state === 'running')
    if (running.some((heartbeat) => currentTime - new Date(heartbeat.last_beat_at).getTime() < HEARTBEAT_TTL_MS)) {
      active += 1
    } else if (running.length > 0) {
      stale += 1
    } else {
      missing += 1
    }
  }

  return { active, stale, missing }
}
