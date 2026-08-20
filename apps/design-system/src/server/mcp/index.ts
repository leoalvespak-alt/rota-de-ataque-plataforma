import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { z as zod } from 'zod/v4'
import { TEMPLATES, getTemplateById, getDefaultElements } from '../../features/templates/registry'
import { templateMetadataSchema } from '../../features/templates/schemas'

const server = new McpServer({
  name: 'rota-design-system',
  version: '1.0.0',
})

type McpSchema = AnySchema & { describe(description: string): AnySchema; optional(): McpSchema }
const asMcpSchema = (schema: AnySchema): McpSchema => schema as McpSchema
const z = {
  string: () => asMcpSchema(zod.string() as unknown as AnySchema),
  boolean: () => asMcpSchema(zod.boolean() as unknown as AnySchema),
}
const mcpString = (description: string): AnySchema => z.string().describe(description)
const mcpBoolean = (description: string): AnySchema => z.boolean().optional().describe(description)

server.tool(
  'list_templates',
  'Lista todos os templates disponíveis com seus metadados e schemas Zod.',
  {},
  async () => {
    const templates = TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      filter: t.filter,
      format: t.format,
      tags: t.tags,
      fieldSchema: t.fieldSchema ?? null,
      capabilities: t.capabilities ?? null,
      variants: t.variants ?? null,
    }))

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(templates, null, 2) }],
    }
  },
)

server.tool(
  'get_template_schema',
  'Retorna o schema Zod e os defaults de um template específico pelo ID.',
  { templateId: mcpString('ID do template (ex: sq-cover, cr-slide, pt-content)') },
  async ({ templateId }) => {
    const tpl = getTemplateById(String(templateId))
    if (!tpl) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Template "${templateId}" não encontrado.` }) }],
        isError: true,
      }
    }

    const result = {
      id: tpl.id,
      name: tpl.name,
      format: tpl.format,
      filter: tpl.filter,
      tags: tpl.tags,
      defaults: tpl.defaults,
      fieldSchema: tpl.fieldSchema ?? null,
      capabilities: tpl.capabilities ?? null,
      variants: tpl.variants ?? null,
      qualityRules: tpl.qualityRules ?? null,
      layoutRules: tpl.layoutRules ?? null,
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.tool(
  'get_default_elements',
  'Retorna os elementos default de um template para preencher o canvas.',
  { templateId: mcpString('ID do template') },
  async ({ templateId }) => {
    const elements = getDefaultElements(String(templateId))
    if (Object.keys(elements).length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Template "${templateId}" não encontrado.` }) }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(elements, null, 2) }],
    }
  },
)

server.tool(
  'validate_template_metadata',
  'Valida um objeto de metadados contra o schema Zod de template.',
  { metadata: mcpString('JSON string dos metadados do template para validar') },
  async ({ metadata }) => {
    try {
      const parsed = JSON.parse(String(metadata))
      const result = templateMetadataSchema.safeParse(parsed)
      if (result.success) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ valid: true, data: result.data }, null, 2) }],
        }
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            valid: false,
            errors: result.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          }, null, 2),
        }],
      }
    } catch (e) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'JSON inválido', detail: String(e) }) }],
        isError: true,
      }
    }
  },
)

server.tool(
  'write_creative_json',
  'Gera um JSON estruturado pronto para alimentar o editor com um template e conteúdo.',
  {
    templateId: mcpString('ID do template'),
    elements: z.string().describe('JSON string com os elementos (campos de texto, configurações)'),
    darkMode: mcpBoolean('Modo escuro do card'),
  },
  async ({ templateId, elements, darkMode }) => {
    const templateIdValue = String(templateId)
    const tpl = getTemplateById(templateIdValue)
    if (!tpl) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Template "${templateId}" não encontrado.` }) }],
        isError: true,
      }
    }

    try {
      const parsedElements = JSON.parse(String(elements))
      const mergedElements = { ...tpl.defaults as Record<string, unknown>, ...parsedElements }

      const creative = {
        templateId: templateIdValue,
        format: tpl.format,
        filter: tpl.filter,
        darkMode: typeof darkMode === 'boolean' ? darkMode : false,
        elements: mergedElements,
        generatedAt: new Date().toISOString(),
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(creative, null, 2) }],
      }
    } catch (e) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Falha ao processar elements JSON', detail: String(e) }) }],
        isError: true,
      }
    }
  },
)

server.tool(
  'list_template_filters',
  'Lista os filtros de formato disponíveis (square, portrait, carousel) com contagem de templates.',
  {},
  async () => {
    const counts: Record<string, number> = {}
    for (const t of TEMPLATES) {
      counts[t.filter] = (counts[t.filter] ?? 0) + 1
    }
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(
          Object.entries(counts).map(([filter, count]) => ({ filter, count })),
          null, 2,
        ),
      }],
    }
  },
)

server.tool(
  'get_zod_schemas',
  'Retorna a descrição dos schemas Zod registrados no sistema de templates.',
  {},
  async () => {
    const schemaDescriptions = {
      templateMetadataSchema: 'Schema completo de metadados de um template (id, name, category, filter, format, tags, slots, variants, constraints, equivalents, qualityRules, layoutRules, capabilities, fieldSchema)',
      slotDefinitionSchema: 'Schema de um slot dentro do template (id, type, label, required, editable, constraints, defaultValue)',
      slotConstraintSchema: 'Schema de restrições de um slot (minWidth, minHeight, maxWidth, maxHeight, aspectRatio, allowedTypes, maxFileSize)',
      templateConstraintsSchema: 'Schema de restrições gerais do template (minTextLength, maxTextLength, maxImages, safeArea, density)',
      fieldDefSchema: 'Schema de definição de campo (name, semantic, type, required, maxLength, bindable)',
      templateCapabilitiesSchema: 'Schema de capacidades do template (image, cta, list, resize, styles)',
      templateVariantSchema: 'Schema de variante do template (id, label, density, itemCount, hasImage, ctaPosition)',
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(schemaDescriptions, null, 2) }],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
