import type { ValidationIssue } from './mutations'

export type BrandLockMode = 'off' | 'warn' | 'block'
export interface BrandPolicy { mode: BrandLockMode; colors: string[]; fonts: string[]; logoAssetIds: string[]; allowedTemplates?: string[] }
export const designTokens = {
  colors: ['#0A0A0A', '#F5F5F0', '#C1121F', '#D4A017'],
  fonts: ['IBM Plex Sans', 'Rajdhani', 'Space Grotesk'],
  spacing: [4, 8, 12, 16, 24, 32, 48, 64],
} as const

export function validateBrand(policy: BrandPolicy, input: { color?: string; font?: string; templateId?: string; logoAssetId?: string }): ValidationIssue[] {
  if (policy.mode === 'off') return []
  const severity = policy.mode === 'block' ? 'error' : 'warning'
  const errors: ValidationIssue[] = []
  if (input.color && !policy.colors.includes(input.color)) errors.push({ code: 'brand-color', message: 'A cor não faz parte da identidade aprovada.', severity })
  if (input.font && !policy.fonts.includes(input.font)) errors.push({ code: 'brand-font', message: 'A fonte não faz parte da identidade aprovada.', severity })
  if (input.templateId && policy.allowedTemplates && !policy.allowedTemplates.includes(input.templateId)) errors.push({ code: 'brand-template', message: 'O template não está liberado para esta campanha.', severity })
  if (input.logoAssetId && !policy.logoAssetIds.includes(input.logoAssetId)) errors.push({ code: 'brand-logo', message: 'O logo não é um asset aprovado.', severity })
  return errors
}
