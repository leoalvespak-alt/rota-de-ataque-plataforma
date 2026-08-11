import { promptTemplates } from '../src/db/editorial-schema'
import { db, pool } from '../src/server/api/db'
const types = ['structure-thesis', 'generate-plan', 'generate-brief', 'generate-post', 'generate-carousel', 'generate-story', 'review-content', 'rewrite-content', 'generate-visual-direction', 'generate-image-prompt', 'adapt-format']
async function main() { await db.insert(promptTemplates).values(types.map((type) => ({ name: type, type, template: `Você é o motor editorial da Rota de Ataque. Execute ${type} usando a tese {{thesis}}, o contexto {{context}} e retorne JSON válido.`, variables: ['thesis', 'context'], outputSchema: { type: 'object' } }))).onConflictDoNothing(); console.log('Prompts editoriais semeados.') }
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => pool.end())
