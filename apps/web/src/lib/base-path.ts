const configured = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
export const basePath = configured === '/' ? '' : configured.replace(/\/$/, '')
export function appPath(path:string){const normalized=path.startsWith('/')?path:`/${path}`;return `${basePath}${normalized}`}
