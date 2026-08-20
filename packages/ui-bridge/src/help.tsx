import React from 'react'
import { Drawer } from './dialogs'

export interface HelpContentData {
  title: string
  what: string
  whenToUse: string
  metrics?: { name: string; explanation: string }[]
  steps: { title: string; description: string }[]
  dataSources: { name: string; frequency: string }[]
  integrations?: string[]
  permissions?: string[]
  limitations?: string[]
  shortcuts?: { key: string; action: string }[]
  relatedLinks?: { label: string; href: string }[]
}

export const ResourceHelpDrawer = ({
  open,
  onClose,
  content,
  defaultTab = 'how-to'
}: {
  open: boolean
  onClose: () => void
  content?: HelpContentData
  defaultTab?: 'how-to' | 'about'
}) => {
  const [tab, setTab] = React.useState(defaultTab)

  React.useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  if (!content) return null

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <div className="bridge-help-drawer">
        <header>
          <h2>{content.title}</h2>
          <div className="bridge-help-tabs">
            <button 
              type="button" 
              className={tab === 'how-to' ? 'active' : ''} 
              onClick={() => setTab('how-to')}
            >
              Como usar
            </button>
            <button 
              type="button" 
              className={tab === 'about' ? 'active' : ''} 
              onClick={() => setTab('about')}
            >
              Sobre
            </button>
          </div>
        </header>

        <div className="bridge-help-content">
          {tab === 'how-to' && (
            <section>
              <h3>Passo a passo</h3>
              <ol>
                {content.steps.map((step, i) => (
                  <li key={i}>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </li>
                ))}
              </ol>

              {content.shortcuts && (
                <>
                  <h3>Atalhos</h3>
                  <table className="bridge-help-table">
                    <tbody>
                      {content.shortcuts.map((s, i) => (
                        <tr key={i}>
                          <td><kbd>{s.key}</kbd></td>
                          <td>{s.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          )}

          {tab === 'about' && (
            <section>
              <h3>O que é</h3>
              <p>{content.what}</p>

              <h3>Quando usar</h3>
              <p>{content.whenToUse}</p>

              {content.metrics && (
                <>
                  <h3>Métricas principais</h3>
                  <ul>
                    {content.metrics.map((m, i) => (
                      <li key={i}>
                        <strong>{m.name}:</strong> {m.explanation}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3>Fontes de dados</h3>
              <ul>
                {content.dataSources.map((ds, i) => (
                  <li key={i}>
                    <strong>{ds.name}</strong> ({ds.frequency})
                  </li>
                ))}
              </ul>

              {content.integrations && (
                <>
                  <h3>Integrações necessárias</h3>
                  <ul>
                    {content.integrations.map((int, i) => <li key={i}>{int}</li>)}
                  </ul>
                </>
              )}
              
              {content.permissions && (
                <>
                  <h3>Permissões necessárias</h3>
                  <ul>
                    {content.permissions.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </>
              )}

              {content.limitations && (
                <>
                  <h3>Limitações conhecidas</h3>
                  <ul>
                    {content.limitations.map((lim, i) => <li key={i}>{lim}</li>)}
                  </ul>
                </>
              )}

              {content.relatedLinks && (
                <>
                  <h3>Links úteis</h3>
                  <ul>
                    {content.relatedLinks.map((link, i) => (
                      <li key={i}>
                        <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </Drawer>
  )
}
