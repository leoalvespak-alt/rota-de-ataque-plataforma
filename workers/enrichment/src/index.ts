import {createWorker,type WorkerSpec} from '@plataforma/shared/worker';export const spec={queue:'enrichment'} satisfies WorkerSpec;export const processJob=createWorker(spec);
