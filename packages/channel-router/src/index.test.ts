import { describe, expect, it } from 'vitest'
import { chooseChannel } from './index.js'
describe('channel router', () => it('honors the global cadence before picking the strongest channel', () => expect(chooseChannel({email:90,whatsapp:70,instagram:0,threads:0,intent:1,relationship:1},['email','whatsapp'],{cadenceSeconds:86400,lastOutboundAt:new Date()})).toBe('none')))
