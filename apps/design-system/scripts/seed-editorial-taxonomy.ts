import { editorialAngles, editorialDepthLevels, editorialIntents } from '../src/db/editorial-schema'
import { db, pool } from '../src/server/api/db'

const intents = ['educar', 'provocar', 'posicionar', 'quebrar-objecao', 'demonstrar-autoridade', 'gerar-identificacao', 'apresentar-prova', 'explicar-metodo', 'alertar', 'comparar', 'inspirar', 'converter', 'convidar', 'resumir', 'aprofundar']
const angles = ['erro-comum', 'mito', 'verdade-desconfortavel', 'passo-a-passo', 'comparacao', 'antes-e-depois', 'lista', 'bastidor', 'diagnostico', 'consequencia', 'causa', 'objecao', 'prova', 'estudo-de-caso', 'analogia', 'checklist', 'framework', 'opiniao-forte', 'previsao', 'alerta', 'pergunta', 'historia', 'contrarian-take', 'faq', 'resumo', 'aplicacao-pratica']
const depths = ['awareness', 'introdutorio', 'intermediario', 'avancado', 'revisao', 'opiniao', 'prova', 'execucao']
const label = (value: string) => value.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ')
async function main() { await db.insert(editorialIntents).values(intents.map((name, position) => ({ name, label: label(name), position }))).onConflictDoNothing(); await db.insert(editorialAngles).values(angles.map((name, position) => ({ name, label: label(name), position }))).onConflictDoNothing(); await db.insert(editorialDepthLevels).values(depths.map((name, position) => ({ name, label: label(name), position }))).onConflictDoNothing(); console.log('Taxonomia editorial semeada.') }
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => pool.end())
