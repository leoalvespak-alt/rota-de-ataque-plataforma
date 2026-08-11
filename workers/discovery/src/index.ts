import {createWorker,type WorkerSpec} from '@plataforma/shared/worker';export const spec={queue:'discovery',requiredRole:'collector'} satisfies WorkerSpec;export const processJob=createWorker(spec);
