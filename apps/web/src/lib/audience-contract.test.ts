import { describe, expect, it } from 'vitest'
import { conversationsQuery } from './dashboard-data'

describe('contrato de Público', () => {
  it('reutiliza a consulta canônica multicanal e não referencia uma tabela inexistente', () => {
    expect(conversationsQuery).toContain('own_dm_threads')
    expect(conversationsQuery).toContain('whatsapp_conversations')
    expect(conversationsQuery).not.toMatch(/FROM\s+conversations\b/u)
  })

  it('mantém o escopo da campanha nas duas origens de conversa', () => {
    expect(conversationsQuery).toMatch(/thread\.participant_username/u)
    expect(conversationsQuery).toMatch(/score\.campaign_id=\$1/u)
    expect(conversationsQuery).toMatch(/conversation\.lead_id/u)
  })
})
