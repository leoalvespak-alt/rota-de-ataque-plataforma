import{runWorker}from'@plataforma/queue/runtime';import{processJob,spec}from'./index.js';runWorker(spec.queue,processJob);
