import { CopyableSwatch } from './CopyableSwatch'

const AUDIENCE_TAGS = [
  'Carreiras Fiscais',
  'Carreiras Policiais',
  'Tribunais',
  'Receita Federal',
  'TCU / TCE',
  'Polícia Federal',
  'PRF / PCDF',
]

const PILLARS = [
  { icon: '🎯', title: 'Tático', desc: 'Cada comunicação é direta ao alvo. Sem rodeios, sem motivação vazia. O estudo é tratado como uma campanha militar com objetivos claros.' },
  { icon: '⚡', title: 'Decisivo', desc: 'A marca age como um sargento instrutor: dá o comando e espera execução. Verbos no imperativo: ATAQUE, EXECUTE, CONQUISTE, CUMPRA A META.' },
  { icon: '🔥', title: 'Sem desculpas', desc: 'O inimigo nomeado é a procrastinação. A marca posiciona o aluno como o único responsável por sua vitória — e fornece as ferramentas para garanti-la.' },
]

const BRAND_RED_GROUP = [
  { hex: '#C1121F', name: 'Brand Red' },
  { hex: '#A00F1A', name: 'Hover' },
  { hex: '#8B0000', name: 'Pressed' },
  { hex: '#E33640', name: 'Light / Accent' },
]

const LIGHT_GROUP = [
  { hex: '#F5F5F0', name: 'Card Background', textColor: '#0A0A0A' },
  { hex: '#EAEAE5', name: 'Card Background Alt', textColor: '#0A0A0A' },
  { hex: '#D4D4CF', name: 'Line / Border', textColor: '#0A0A0A' },
  { hex: '#0A0A0A', name: 'Text Primary' },
  { hex: '#3D3D3D', name: 'Text Secondary' },
  { hex: '#D9D9D4', name: 'Image Slot Fill', textColor: '#0A0A0A' },
]

const DARK_GROUP = [
  { hex: '#0A0A0A', name: 'Black (Fundo App)' },
  { hex: '#151515', name: 'Ink (Alt BG)' },
  { hex: '#171717', name: 'Surface 1 (Cards)' },
  { hex: '#1F1F1F', name: 'Surface 2' },
  { hex: '#F0F0F0', name: 'Text Primary' },
  { hex: '#B0B0B0', name: 'Text Secondary' },
]

const SPECIAL_GROUP = [
  { hex: '#D4A017', name: 'Gold (Elite/Fiscal)', textColor: '#0A0A0A' },
  { hex: '#22C55E', name: 'Success', textColor: '#0A0A0A' },
  { hex: '#F59E0B', name: 'Warning', textColor: '#0A0A0A' },
  { hex: '#3B82F6', name: 'Info' },
]

const TOKENS = [
  { name: '--radius-sm', value: '8px', desc: 'Botões, tags, badges' },
  { name: '--radius-md', value: '10px', desc: 'Base padrão da marca, caixas de texto' },
  { name: '--radius-card', value: '12px', desc: 'Cards de conteúdo' },
  { name: '--radius-marketing', value: '16px', desc: 'Cards de marketing/landing' },
  { name: '--radius-pill', value: '9999px', desc: 'Badges, etiquetas pill' },
  { name: '--accent-bar', value: '6–8px', desc: 'Barra de acento no topo dos cards' },
  { name: '--margin-card', value: '70–90px', desc: 'Margem externa mínima nos cards' },
  { name: '--tracking-title', value: '0.04em', desc: 'Espaçamento de letras em títulos' },
  { name: '--tracking-eyebrow', value: '0.08em', desc: 'Espaçamento em eyebrows e tags' },
  { name: '--texture-opacity', value: '7%', desc: 'Opacidade do grid tático de fundo' },
]

const LOGOS = [
  { bg: '#000', src: '01 ATAQUE LOGO - FUNDO PRETO.jpg', download: '01 LOGO ATAQUE - SEM FUNDO.png', name: 'Logo Horizontal — Fundo Preto', desc: 'Uso em fundos escuros, materiais impressos escuros' },
  { bg: '#fff', src: '03 ATAQUE LOGO - FUNDO BRANCO.jpg', download: '03 LOGO ATAQUE - SEM FUNDO.png', name: 'Logo Horizontal — Fundo Branco', desc: 'Uso em fundos claros, materiais impressos claros' },
  { bg: '#000', src: '02 ATAQUE LOGO - FUNDO PRETO.jpg', download: '02 LOGO ATAQUE - SEM FUNDO.png', name: 'Logo Compacto — Fundo Preto', desc: 'Avatares, ícones de app, favicon' },
  { bg: '#fff', src: '04 ATAQUE LOGO - FUNDO BRANCO.jpg', download: '04 LOGO ATAQUE - SEM FUNDO.png', name: 'Logo Compacto — Fundo Branco', desc: 'Uso em materiais claros' },
  { bg: '#C1121F', src: 'ATAQUE.png', download: 'ATAQUE.png', name: 'Símbolo Isolado', desc: 'Ícone da ponta de lança — uso standalone' },
]

const VOICE_DO = [
  'Frases curtas e imperativas: "Execute o plano de hoje."',
  'Verbos de ação: ATAQUE, EXECUTE, CONQUISTE, CUMPRA',
  'Confiança em dados: "10+ ferramentas integradas"',
  'Inimigo nomeado: "A procrastinação não passa aqui."',
  'Títulos em MAIÚSCULAS com tracking generoso',
  'Metáfora militar quando natural e direta',
  'Provas sociais com números concretos',
]

const VOICE_DONT = [
  'Emojis — nunca usados em textos de marca',
  'Linguagem motivacional vaga: "Você consegue!"',
  'Perguntas retóricas sem resposta direta',
  'Tom condescendente ou professoral demais',
  'Gírias ou termos que datam rapidamente',
  'Excesso de exclamações: "Aprove-se!!!"',
  'Corpo de texto em MAIÚSCULAS (só títulos)',
]

/**
 * Espelha #brand-view do Gerador/index.html original (linhas 1378-1834) — as 8 seções
 * (00 Público-Alvo … 07 Contraste), texto idêntico. Tabela de tokens gerada a partir
 * dos mesmos valores documentados no HTML original (item de melhoria futura: ligar
 * isso à mesma fonte de tokens do CSS, hoje ambos derivam do valor fixo em index.css).
 */
export function BrandView() {
  return (
    <div className="flex-1 overflow-y-auto bg-ui-bg">
      <div className="mx-auto max-w-[1100px] px-12 pt-12 pb-20">
        {/* Hero */}
        <div className="relative mb-12 overflow-hidden rounded-2xl border border-ui-border p-15" style={{ background: 'var(--dark-ink)' }}>
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-brand-red" />
          <div className="relative z-10">
            <div className="mb-5 flex items-center gap-2.5 font-heading text-[13px] font-bold tracking-[0.15em] text-brand-red uppercase before:h-0.5 before:w-7.5 before:bg-brand-red">
              Sistema de Design
            </div>
            <h1 className="mb-4 font-heading text-[56px] leading-[1.05] font-bold tracking-[0.04em] text-white uppercase">
              Rota de <span className="text-brand-red">Ataque</span>
            </h1>
            <p className="mb-7.5 max-w-150 text-base leading-relaxed text-[#B0B0B0]">
              Plataforma de estudos para concursos públicos. A marca é tratada como um
              quartel-general que planeja a missão do aluno até a aprovação. O posicionamento
              é tático, militar e direto.
            </p>
            <div className="inline-block rounded-lg border border-brand-red/30 bg-brand-red/10 px-7 py-4.5 text-[15px] text-white italic">
              <strong className="text-brand-red not-italic">Promessa central: </strong>
              "Planejamos. Você executa e conquista."
            </div>
          </div>
        </div>

        {/* 00 Público-Alvo */}
        <BrandSection num="00" title="Público-Alvo">
          <div className="flex items-start gap-5 rounded-xl border border-ui-border bg-ui-panel2 p-6">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border border-brand-red/25 bg-brand-red/12">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-red">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="mb-1.5 font-heading text-lg font-bold tracking-wide uppercase">
                Candidatos a Concursos Públicos
              </div>
              <div className="text-sm leading-relaxed text-ui-muted">
                Estudantes focados em carreiras de alto prestígio e alta exigência. Buscam
                estrutura, eficiência e clareza no plano de estudos. Tratam a preparação como
                um investimento de carreira sério.
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {AUDIENCE_TAGS.map((tag) => (
                  <span key={tag} className="rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 font-heading text-xs font-bold tracking-wide text-ui-muted uppercase">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </BrandSection>

        {/* 01 Posicionamento */}
        <BrandSection num="01" title="Posicionamento da Marca">
          <div className="grid grid-cols-3 gap-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-xl border border-t-3 border-ui-border bg-ui-panel2 p-6" style={{ borderTopColor: 'var(--red)' }}>
                <div className="mb-3 text-[28px]">{p.icon}</div>
                <div className="mb-2 font-heading text-[17px] font-bold tracking-wide uppercase">{p.title}</div>
                <div className="text-[13px] leading-relaxed text-ui-muted">{p.desc}</div>
              </div>
            ))}
          </div>
        </BrandSection>

        {/* 02 Cores */}
        <BrandSection num="02" title="Paleta de Cores">
          <p className="mb-5 text-[13px] leading-relaxed text-ui-muted">
            Clique em qualquer swatch para copiar o código hex. O Vermelho da Marca é usado
            de forma econômica — como uma "mira laser" para a ação mais importante.
          </p>
          <ColorGroup label="Vermelho da Marca (Ação Primária)" colors={BRAND_RED_GROUP} />
          <ColorGroup label="Neutros — Modo Light (Padrão para criativos)" colors={LIGHT_GROUP} />
          <ColorGroup label="Neutros — Modo Dark (Uso sob demanda)" colors={DARK_GROUP} />
          <ColorGroup label="Cores Especiais" colors={SPECIAL_GROUP} />
        </BrandSection>

        {/* 03 Tipografia */}
        <BrandSection num="03" title="Tipografia">
          <div className="flex flex-col gap-4">
            <TypeCard
              name="Rajdhani"
              role="Títulos · Tags · CTAs · Eyebrows"
              sample={
                <>
                  <div className="font-heading text-[52px] leading-[1.1] font-bold tracking-wide text-[#0A0A0A] uppercase">
                    CONQUISTE SUA APROVAÇÃO
                  </div>
                  <div className="mt-2.5 font-heading text-[28px] font-semibold tracking-wide text-brand-red uppercase">
                    CARREIRAS FISCAIS · EXECUTE A MISSÃO
                  </div>
                </>
              }
              meta={['Pesos: 600 SemiBold · 700 Bold', 'Case: SEMPRE MAIÚSCULAS', 'Tracking: 0.04em – 0.08em', 'Uso: Títulos, Botões, Tags, Números grandes']}
            />
            <TypeCard
              name="IBM Plex Sans"
              role="Corpo de Texto · UI Densa · Parágrafos"
              sample={
                <>
                  <div className="text-[32px] leading-relaxed font-light text-[#0A0A0A]">
                    Cada hora de estudo deve ter um objetivo claro. Sem foco, não há aprovação.
                  </div>
                  <div className="mt-4 text-base font-medium text-[#3D3D3D]">
                    Defina sua meta diária e cumpra. Sem exceção. A procrastinação é o seu único inimigo hoje.
                  </div>
                </>
              }
              meta={['Pesos: 300 Light · 400 Regular · 500 Medium · 600 SemiBold', 'Case: Sentence case normal', 'Uso: Corpo de texto, parágrafos, UI densa']}
            />
            <TypeCard
              name="Space Grotesk"
              role="Numerais · Timers · Rankings · Estatísticas"
              sample={
                <>
                  <div className="font-mono text-7xl leading-none font-bold text-[#0A0A0A]">10.482</div>
                  <div className="mt-4 flex gap-10">
                    <div className="font-mono text-4xl font-medium text-brand-red">24/7</div>
                    <div className="font-mono text-4xl font-medium text-[#0A0A0A]">3.847 aprovações</div>
                  </div>
                </>
              }
              meta={['Pesos: 400 · 500 · 700', 'Estilo: Tabular (numerais alinhados)', 'Uso: Cronômetros, rankings, contadores, estatísticas']}
            />
          </div>
        </BrandSection>

        {/* 04 Logotipos */}
        <BrandSection num="04" title="Logotipos">
          <p className="mb-5 text-[13px] leading-relaxed text-ui-muted">
            A logo do Rota de Ataque é um ícone em forma de ponta de lança/flecha com o
            caminho de uma estrada tracejada que sobe pelo centro — simbolizando literalmente
            a <em>rota do ataque</em> e o plano de ascensão.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {LOGOS.map((logo) => (
              <div key={logo.name} className="overflow-hidden rounded-xl border border-ui-border">
                <div className="flex h-35 items-center justify-center p-6" style={{ background: logo.bg }}>
                  <img
                    src={`/logos/${logo.src}`}
                    alt={logo.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
                <div className="border-t border-ui-border bg-ui-panel2 px-3.5 py-2.5">
                  <div className="text-xs font-semibold">{logo.name}</div>
                  <div className="mt-0.5 text-[11px] text-ui-muted">{logo.desc}</div>
                  <div className="mt-2 flex gap-1.5">
                    <a
                      href={`/logos/${logo.download}`}
                      download
                      className="inline-flex items-center gap-1 rounded border border-ui-border bg-ui-panel px-2.5 py-1 text-[11px] text-ui-muted hover:border-brand-red hover:text-brand-red"
                    >
                      ↓ Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-ui-border bg-ui-panel2 px-5 py-4">
            <div className="mb-3 font-heading text-[13px] font-bold tracking-wide text-ui-muted uppercase">
              Regras de Uso da Logo
            </div>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <RuleItem ok text="Usar em fundo preto (#0A0A0A) ou branco (#F5F5F0)" />
              <RuleItem text="Nunca deformar ou inclinar a logo" />
              <RuleItem ok text="Manter a proporção original" />
              <RuleItem text="Nunca alterar as cores da logo" />
              <RuleItem ok text="Espaço de proteção mínimo = metade da altura do ícone" />
              <RuleItem text="Nunca usar sobre fundos com pouco contraste" />
            </div>
          </div>
        </BrandSection>

        {/* 05 Tom de Voz */}
        <BrandSection num="05" title="Tom de Voz">
          <p className="mb-5 text-[13px] leading-relaxed text-ui-muted">
            A marca fala como um <strong className="text-ui-text">sargento instrutor que está do seu lado</strong> —
            direto, motivador, sem enrolação. Use sempre pt-BR, fale com o aluno como "você",
            a plataforma se refere como "nós".
          </p>
          <div className="grid grid-cols-2 gap-4">
            <VoiceCard type="do" items={VOICE_DO} />
            <VoiceCard type="dont" items={VOICE_DONT} />
          </div>
          <div className="mt-6">
            <div className="mb-4 font-heading text-sm font-bold tracking-wide text-ui-muted uppercase">
              Exemplos práticos
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <ExampleLabel good />
                <TextExample good text="&quot;Você tem 3 matérias em atraso esta semana. Execute o plano de revisão agora.&quot;" />
                <ExampleLabel good />
                <TextExample good text="&quot;CONQUISTE A RECEITA FEDERAL — Cronograma personalizado em menos de 5 minutos.&quot;" />
              </div>
              <div>
                <ExampleLabel />
                <TextExample text="&quot;Oi! 😊 Você tá dando o seu melhor? A gente acredita em você! Continue assim!!! 🚀&quot;" />
                <ExampleLabel />
                <TextExample text="&quot;Que tal estudar um pouquinho mais hoje? Talvez você consiga passar no concurso dos seus sonhos!&quot;" />
              </div>
            </div>
          </div>
        </BrandSection>

        {/* 06 Tokens */}
        <BrandSection num="06" title="Tokens de Design">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-ui-border bg-ui-panel2 px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-ui-muted uppercase">Token</th>
                <th className="border-b border-ui-border bg-ui-panel2 px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-ui-muted uppercase">Valor</th>
                <th className="border-b border-ui-border bg-ui-panel2 px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-ui-muted uppercase">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {TOKENS.map((t) => (
                <tr key={t.name} className="hover:bg-white/2">
                  <td className="border-b border-ui-border px-4 py-2.5 font-mono text-xs text-brand-red">{t.name}</td>
                  <td className="border-b border-ui-border px-4 py-2.5 font-mono text-xs text-ui-muted">{t.value}</td>
                  <td className="border-b border-ui-border px-4 py-2.5">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BrandSection>

        {/* 07 Contraste */}
        <BrandSection num="07" title="Regras de Contraste e Acessibilidade">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-ui-border bg-ui-panel2 p-5">
              <div className="mb-3.5 font-heading text-sm font-bold tracking-wide uppercase">Modo Light (Padrão)</div>
              <div className="mb-2 rounded-lg p-4" style={{ background: '#F5F5F0' }}>
                <div className="font-heading text-[22px] font-bold text-[#0A0A0A] uppercase">TÍTULO PRIMÁRIO</div>
                <div className="mt-1.5 text-sm text-[#3D3D3D]">Texto de corpo secundário com boa legibilidade.</div>
                <div className="mt-2 font-heading text-xs font-bold tracking-wide text-brand-red uppercase">TAG FISCAL</div>
              </div>
              <div className="text-xs leading-loose text-ui-muted">
                • Título: #0A0A0A sobre #F5F5F0 → ≥7:1 (WCAG AAA)
                <br />• Corpo: #3D3D3D sobre #F5F5F0 → ≥5:1 (WCAG AA)
                <br />• Nunca usar cinzas claros como texto
              </div>
            </div>
            <div className="rounded-xl border border-ui-border bg-ui-panel2 p-5">
              <div className="mb-3.5 font-heading text-sm font-bold tracking-wide uppercase">Modo Dark</div>
              <div className="mb-2 rounded-lg p-4" style={{ background: '#0A0A0A' }}>
                <div className="font-heading text-[22px] font-bold text-[#F0F0F0] uppercase">TÍTULO PRIMÁRIO</div>
                <div className="mt-1.5 text-sm text-[#B0B0B0]">Texto de corpo secundário com boa legibilidade.</div>
                <div className="mt-2 font-heading text-xs font-bold tracking-wide text-[#E33640] uppercase">TAG FISCAL</div>
              </div>
              <div className="text-xs leading-loose text-ui-muted">
                • Título: #F0F0F0 sobre #0A0A0A → ≥7:1 (WCAG AAA)
                <br />• Corpo: #B0B0B0 sobre #0A0A0A → ≥5:1 (WCAG AA)
                <br />• Nunca usar cinzas escuros como texto
              </div>
            </div>
          </div>
        </BrandSection>
      </div>
    </div>
  )
}

function BrandSection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <div className="mb-6 flex items-center gap-3.5 border-b border-ui-border pb-3.5">
        <span className="rounded border border-brand-red/25 bg-brand-red/12 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wide text-brand-red">
          {num}
        </span>
        <h2 className="font-heading text-[22px] font-bold tracking-wide text-ui-text uppercase">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function ColorGroup({ label, colors }: { label: string; colors: { hex: string; name: string; textColor?: string }[] }) {
  return (
    <>
      <div className="mt-6 mb-3 flex items-center gap-2 font-heading text-[13px] font-bold tracking-wide text-ui-muted uppercase after:h-px after:flex-1 after:bg-ui-border">
        {label}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {colors.map((c) => (
          <CopyableSwatch key={c.hex + c.name} hex={c.hex} name={c.name} textColor={c.textColor} />
        ))}
      </div>
    </>
  )
}

function TypeCard({ name, role, sample, meta }: { name: string; role: string; sample: React.ReactNode; meta: string[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ui-border bg-ui-panel2">
      <div className="flex items-center justify-between border-b border-ui-border bg-ui-panel px-5 py-3">
        <span className="text-[13px] font-semibold">{name}</span>
        <span className="rounded border border-ui-border bg-ui-panel2 px-2 py-0.5 text-[11px] text-ui-muted">{role}</span>
      </div>
      <div className="p-7" style={{ background: 'var(--light-bg)' }}>
        {sample}
      </div>
      <div className="flex flex-wrap gap-5 px-5 py-3">
        {meta.map((m) => (
          <div key={m} className="text-[11px] text-ui-muted">
            {m}
          </div>
        ))}
      </div>
    </div>
  )
}

function VoiceCard({ type, items }: { type: 'do' | 'dont'; items: string[] }) {
  const isDo = type === 'do'
  return (
    <div className="rounded-xl border border-ui-border bg-ui-panel2 p-5">
      <div
        className={`mb-2.5 inline-block rounded px-2 py-0.5 font-heading text-[11px] font-bold tracking-wide uppercase ${
          isDo ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'
        }`}
      >
        {isDo ? '✓ Use' : '✕ Evite'}
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 border-b border-ui-border py-1.75 text-[13px] leading-relaxed last:border-b-0">
            <span className={isDo ? 'text-green-500' : 'text-red-500'}>{isDo ? '✓' : '✕'}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExampleLabel({ good = false }: { good?: boolean }) {
  return (
    <div className={`mb-1.5 text-[10px] font-bold tracking-wide uppercase ${good ? 'text-green-500' : 'text-red-500'}`}>
      {good ? '✓ Certo' : '✕ Errado'}
    </div>
  )
}

function TextExample({ good = false, text }: { good?: boolean; text: string }) {
  return (
    <div
      className={`mb-2 rounded-lg border-l-3 bg-ui-panel2 px-5 py-4 text-sm leading-relaxed ${
        good ? 'border-green-500 text-ui-text' : 'border-red-500 text-ui-muted line-through'
      }`}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  )
}

function RuleItem({ ok = false, text }: { ok?: boolean; text: string }) {
  return (
    <div className={`flex items-start gap-2 ${ok ? 'text-green-500' : 'text-red-500'}`}>
      {ok ? '✓' : '✕'} <span className="text-ui-text">{text}</span>
    </div>
  )
}
