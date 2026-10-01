export const SOCIAL_COPY_GUIDELINES = [
  'Escreva em português brasileiro natural e para a situação concreta do público, sem presumir que conhece seus sentimentos ou sua rotina.',
  'Prefira a entrada direta quando a informação for urgente, técnica, legal ou pedir consulta rápida. Use narrativa quando ela esclarecer uma dificuldade de aplicação; se o pedido pedir história ou duas versões, entregue uma versão narrativa de verdade.',
  'Uma narrativa pode ser um caso real documentado e autorizado, uma cena hipotética identificada como didática ou uma decisão condicional em segunda pessoa. Nunca invente aluno, depoimento, fala, emoção, resultado ou experiência da Rota.',
  'Troque conselho abstrato por situação observável, decisão, gesto concreto, motivo ou consequência e condição que altere a ação, usando somente as partes necessárias para resolver a dúvida.',
  'Escreva o argumento completo antes de dividi-lo em cards ou telas. Faça cada unidade avançar a mesma ideia e preserve nela o critério, o motivo, o exemplo e o limite que tornam a orientação aplicável.',
  'Entregue valor cedo. Uma cena pode abrir a copy, mas não esconda a resposta até o fim nem use suspense no lugar de explicação.',
  'Todo fato, data, número, oferta, recurso, demonstração e afirmação sobre resultado precisa de fonte fornecida e verificável. Se faltar evidência, não complete a lacuna; sinalize-a fora do texto publicável.',
  'Use CTA somente quando houver uma ação pertinente. Indique um próximo passo específico e um destino funcional que tenha sido confirmado; não crie urgência nem empilhe pedidos.',
  'Mantenha a orientação principal compreensível na própria mídia. A legenda pode ampliar ou acrescentar valor, mas não deve completar uma etapa indispensável que faltou na arte.',
  'Evite slogans motivacionais vazios, perguntas retóricas, depoimentos simulados, fatos inventados, emojis decorativos, listas no padrão “X e também Y” e construções contrastivas retóricas.',
  'Não use as palavras ou flexões Tapeçaria, Promover, Explorar, Integrar, Alavancar, Otimizar, Utilizar, Modernizar, Construir, Implementar, Transformar, Meticuloso, Navegando, Complexidades, De ponta, Sob medida ou Crucial.',
  'Não use travessão em copy publicável de posts, carrosséis ou Stories.',
] as const

export const SOCIAL_CAPTION_GUIDELINES = [
  'Leia a copy da mídia antes de escrever. A legenda acrescenta uma razão, critério, exemplo didático, condição ou resposta a uma objeção; não repete a arte nem guarda nela uma instrução indispensável.',
  'Abra com a situação, decisão ou detalhe que torna a publicação relevante. As primeiras linhas precisam fazer sentido sem suspense e sem chamadas genéricas ao público.',
  'Use linguagem concreta e respeitosa, com parágrafos naturais. Não afirme que sabe como o leitor se sente e não invente caso real.',
  'Feche com uma ação que o leitor possa executar. Para CTA comercial, use apenas oferta, recurso, destino, prazo ou condição comprovados no briefing.',
  'Escolha uma ação principal. Se nenhum destino ou convite foi confirmado, prefira um próximo passo educativo dentro da situação descrita, sem criar promessa comercial.',
] as const

export interface SocialCaptionBrief {
  channel: string
  format: string
  title: string
  mediaCopy: string
  verifiedFactsAndSources: string
  verifiedAction?: string | null
}

export function buildSocialCaptionPrompt(input: SocialCaptionBrief): string {
  return [
    `Canal: ${input.channel}`,
    `Formato: ${input.format}`,
    `Título/assunto: ${input.title}`,
    `Copy que já aparece na mídia:\n${input.mediaCopy}`,
    `Fatos confirmados e fontes:\n${input.verifiedFactsAndSources || 'Nenhum fato adicional foi fornecido. Não acrescente alegações factuais.'}`,
    `Ação e destino confirmados:\n${input.verifiedAction?.trim() || 'Nenhum. Não invente CTA comercial, link, oferta ou prazo.'}`,
    '',
    'Escreva uma legenda completa que acrescente valor à mídia e respeite os fatos acima. Retorne somente um objeto JSON válido no formato {"caption":"..."}.',
  ].join('\n')
}

export function buildSocialCaptionSystemPrompt(): string {
  return [
    'Você escreve legendas para os criativos sociais da Rota de Ataque.',
    ...SOCIAL_COPY_GUIDELINES.map((rule) => `- ${rule}`),
    ...SOCIAL_CAPTION_GUIDELINES.map((rule) => `- ${rule}`),
    'Retorne somente JSON válido com a chave "caption". Não use Markdown nem inclua notas editoriais dentro da legenda.',
  ].join('\n')
}
