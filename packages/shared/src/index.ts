import { createMachine } from "xstate";
import { z } from "zod";

export const EMBEDDING_DIM = 384 as const;
export * from "./content.js";
export * from "./theses.js";
export * from "./multichannel-scoring.js";
export * from "./timeline.js";
export * from "./creative-job-schema.js";
export * from "./budget-gate.js";
export * from "./queue-names.js";

export const ActionTypeSchema = z.enum([
  "follow",
  "like_post",
  "like_comment",
  "reply_public",
  "reply_private",
  "dm",
  "view_story",
  "publish",
  "scrape",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;
export const PrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export type Priority = z.infer<typeof PrioritySchema>;
export const ProspectStatusSchema = z.enum([
  "new",
  "approved",
  "rejected",
  "skipped",
  "queued",
  "running",
  "followed",
  "failed",
  "engaged",
  "in_conversation",
  "converted",
]);
export type ProspectStatus = z.infer<typeof ProspectStatusSchema>;
export const StageSchema = z.enum([
  "discovery",
  "qualified",
  "engaged",
  "converted",
]);
export type Stage = z.infer<typeof StageSchema>;
export const ReasonCodeSchema = z.enum([
  "SUCCESS",
  "NO_INPUT",
  "PREREQUISITE_MISSING",
  "ACCOUNT_AUTH_REQUIRED",
  "PROVIDER_NOT_CONFIGURED",
  "BUDGET_NOT_CONFIGURED",
  "MIGRATION_DRIFT",
  "RUNTIME_UNAVAILABLE",
  "SQL_CONTRACT_ERROR",
  "EXTERNAL_PROVIDER_ERROR",
  "POLICY_BLOCKED",
  "HUMAN_APPROVAL_REQUIRED",
  "ALREADY_DONE",
  "PROFILE_UNAVAILABLE",
  "ACTION_REJECTED",
  "AUTH_REQUIRED",
  "CHECKPOINT",
  "NAVIGATION_FAILED",
  "TIMEOUT",
  "RATE_LIMITED",
  "API_ERROR",
  "HUMAN_REJECTED",
  "DM_COLD_BLOCKED",
  "ROLE_MISMATCH",
  "PREFLIGHT_FAILED",
  "SYNTHETIC_EXTERNAL_BLOCKED",
  "UNKNOWN",
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export const ScopeSchema = z.enum(["competitor", "own"]);
export const DirectionSchema = z.enum(["inbound", "outbound", "passive"]);
export const SourceSchema = z.enum(["api", "scrape", "webhook", "manual"]);
export const AccountRoleSchema = z.enum(["collector", "actor"]);
export type AccountRole = z.infer<typeof AccountRoleSchema>;

export const MetaWebhookEventSchema = z.object({
  object: z.string(),
  entry: z.array(z.record(z.string(), z.unknown())),
  signature: z.string().optional(),
});
export const EngagementActionInputSchema = z.object({
  accountId: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid(),
  actionType: ActionTypeSchema,
  targetRefType: z.string(),
  targetRefId: z.string(),
  priority: PrioritySchema,
  executionMode: z.enum(["api", "scrape"]),
  suggestedBy: z.enum(["nba_engine", "user", "rule"]),
  approvedBy: z.string().min(1).optional(),
  synthetic: z.boolean().default(false),
});
export const DmDraftInputSchema = z.object({
  leadId: z.string().uuid(),
  threadId: z.string().uuid(),
  triggerKind: z.enum(["inbound", "reply_private_upgrade"]),
  variants: z.array(z.string().min(1)).min(1),
});
export const NbaRecommendationInputSchema = z.object({
  leadId: z.string().uuid(),
  campaignId: z.string().uuid(),
  suggestedAction: ActionTypeSchema,
  targetRef: z.record(z.string(), z.unknown()),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
export const ConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url(),
  META_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v21.0"),
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  EMBEDDINGS_PROVIDER: z.literal("local"),
  EMBEDDINGS_MODEL: z.literal(
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  ),
  EMBEDDINGS_ENDPOINT: z.string().url(),
  EMBEDDING_DIM: z.coerce
    .number()
    .int()
    .refine((value) => value === EMBEDDING_DIM),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  WORKERS_DEFAULT_ENABLED: booleanString.default(false),
});
export type Config = z.infer<typeof ConfigSchema>;
export const loadConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): Config => ConfigSchema.parse(environment);

export interface ScoreInput {
  comments: number;
  posts: number;
  competitors: number;
  recency: number;
  intent: number;
  semantic: number;
  relationship: number;
  overlap: number;
  freshnessDays: number;
}
export interface ScoreWeights {
  comments: number;
  posts: number;
  competitors: number;
  recency: number;
  intent: number;
  semantic: number;
  relationship: number;
  overlap: number;
  lambdaFreshness: number;
  p0: number;
  p1: number;
  p2: number;
}
export function computeScore(input: ScoreInput, weights: ScoreWeights) {
  const baseScore =
    input.comments * weights.comments +
    input.posts * weights.posts +
    input.competitors * weights.competitors +
    input.recency * weights.recency;
  const intentScore =
    input.intent * weights.intent + input.semantic * weights.semantic;
  const relationshipScore = input.relationship * weights.relationship;
  const freshnessMultiplier = Math.exp(
    -weights.lambdaFreshness * Math.max(0, input.freshnessDays),
  );
  const finalScore =
    (baseScore +
      intentScore +
      relationshipScore +
      input.overlap * weights.overlap) *
    freshnessMultiplier;
  const priority: Priority =
    finalScore >= weights.p0
      ? "P0"
      : finalScore >= weights.p1
        ? "P1"
        : finalScore >= weights.p2
          ? "P2"
          : "P3";
  return {
    baseScore,
    intentScore,
    relationshipScore,
    freshnessMultiplier,
    finalScore,
    priority,
  };
}

export const prospectMachine = createMachine({
  id: "prospect",
  initial: "new",
  states: {
    new: { on: { APPROVE: "approved", REJECT: "rejected" } },
    approved: { on: { ENQUEUE: "queued", SKIP: "skipped" } },
    queued: { on: { START: "running" } },
    running: { on: { OK: "followed", ERROR: "failed" } },
    failed: { on: { RETRY: "queued" } },
    followed: { on: { ENGAGEMENT: "engaged" } },
    engaged: { on: { DM: "in_conversation" } },
    in_conversation: { on: { CLOSED: "converted" } },
    rejected: {},
    skipped: {},
    converted: {},
  },
});
export const deriveStage = (status: ProspectStatus): Stage =>
  status === "converted"
    ? "converted"
    : status === "engaged" || status === "in_conversation"
      ? "engaged"
      : status === "approved" ||
          status === "queued" ||
          status === "running" ||
          status === "followed"
        ? "qualified"
        : "discovery";

const actorActions = new Set<ActionType>([
  "follow",
  "like_post",
  "like_comment",
  "reply_public",
  "reply_private",
  "dm",
  "publish",
]);
export function requiredRole(action: ActionType): AccountRole {
  return action === "scrape" || action === "view_story" ? "collector" : "actor";
}
export function assertRole(role: AccountRole, action: ActionType) {
  if (requiredRole(action) !== role)
    throw Object.assign(new Error(`Role ${role} cannot execute ${action}`), {
      reasonCode: "ROLE_MISMATCH" satisfies ReasonCode,
    });
}
export function assertDmInbound(triggerKind?: string) {
  if (triggerKind !== "inbound" && triggerKind !== "reply_private_upgrade")
    throw Object.assign(new Error("Cold DM is blocked"), {
      reasonCode: "DM_COLD_BLOCKED" satisfies ReasonCode,
    });
}
export function assertExternalAllowed(synthetic: boolean) {
  if (synthetic)
    throw Object.assign(
      new Error("Synthetic job cannot perform external action"),
      { reasonCode: "SYNTHETIC_EXTERNAL_BLOCKED" satisfies ReasonCode },
    );
}

export interface ErrorEvent {
  source: string;
  worker: string;
  job_id?: string;
  trace_id: string;
  account_id?: string;
  campaign_id?: string;
  lead_id?: string;
  severity: "info" | "warn" | "error" | "critical";
  reason_code: ReasonCode;
  error: string;
  context?: Record<string, unknown>;
  metric?: string;
  observed?: number;
  threshold?: number;
  runbook_url?: string;
  dashboard_url?: string;
}
export const createTraceId = () => crypto.randomUUID();
export function toErrorEvent(
  error: unknown,
  input: Omit<ErrorEvent, "error" | "reason_code">,
): ErrorEvent {
  const value = error instanceof Error ? error : new Error(String(error));
  return {
    ...input,
    error: value.message,
    reason_code: ReasonCodeSchema.catch("UNKNOWN").parse(
      (value as Error & { reasonCode?: string }).reasonCode,
    ),
  };
}

export interface WorkerPreflight {
  migrationsCurrent: boolean;
  embeddingDimension: number;
  tokenValid: boolean;
  lockAvailable: boolean;
  budgetAvailable: boolean;
  accountStatus: string;
  accountRole?: AccountRole;
}
export function preflight(input: WorkerPreflight, required?: AccountRole) {
  const failure = !input.migrationsCurrent
    ? { message: "Database migration is not current", reasonCode: "MIGRATION_DRIFT" as const }
    : input.embeddingDimension !== EMBEDDING_DIM
      ? { message: "Embedding dimension does not match the runtime contract", reasonCode: "PREREQUISITE_MISSING" as const }
      : !input.tokenValid
        ? { message: "Provider token is not valid", reasonCode: "PROVIDER_NOT_CONFIGURED" as const }
        : !input.lockAvailable
          ? { message: "The account lock is not available", reasonCode: "PREREQUISITE_MISSING" as const }
          : !input.budgetAvailable
            ? { message: "Execution budget is not configured", reasonCode: "BUDGET_NOT_CONFIGURED" as const }
            : input.accountStatus === "STOPPED"
              ? { message: "A healthy account is required", reasonCode: "ACCOUNT_AUTH_REQUIRED" as const }
              : required && input.accountRole !== required
                ? { message: `Worker requires an account with role ${required}`, reasonCode: "ROLE_MISMATCH" as const }
                : null;
  if (failure)
    throw Object.assign(new Error(failure.message), {
      reasonCode: failure.reasonCode satisfies ReasonCode,
    });
}

export function deterministicJobId(
  queue: string,
  parts: Array<string | number>,
) {
  return `${queue}:${parts.map((part) => encodeURIComponent(String(part))).join(":")}`;
}
export * from "./observability.js";

export function accountRisk(input: {
  successRate: number;
  apiErrorRate: number;
  checkpoints: number;
  authErrors: number;
  latencyMs: number;
}) {
  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        input.checkpoints * 40 -
        input.authErrors * 20 -
        input.apiErrorRate * 25 -
        (1 - input.successRate) * 30 -
        Math.max(0, input.latencyMs - 2_000) / 1_000,
    ),
  );
  const status =
    score >= 80
      ? "HEALTHY"
      : score >= 60
        ? "DEGRADED"
        : score >= 30
          ? "COOLDOWN"
          : "STOPPED";
  return {
    score,
    status,
    rateMultiplier: status === "DEGRADED" ? 0.5 : status === "HEALTHY" ? 1 : 0,
  } as const;
}
export function extractionCoverage(collected: number, shown: number) {
  return shown <= 0 ? 1 : Math.min(1, collected / shown);
}
export function sourceRoi(
  input: {
    followbackRate: number;
    retention30dRate: number;
    interactionRate: number;
    dmReplyRate: number;
    conversionRate: number;
    normalizedCost: number;
  },
  weights: {
    fb: number;
    ret: number;
    interaction: number;
    dm: number;
    conversion: number;
    cost: number;
  },
) {
  return (
    weights.fb * input.followbackRate +
    weights.ret * input.retention30dRate +
    weights.interaction * input.interactionRate +
    weights.dm * input.dmReplyRate +
    weights.conversion * input.conversionRate -
    weights.cost * input.normalizedCost
  );
}
export function adaptiveInterval(input: {
  current: number;
  min: number;
  max: number;
  sourceScore: number;
  generated: number;
  emptyRuns: number;
  budgetPressure: number;
  locked: boolean;
}) {
  if (input.locked)
    return { interval: input.current, reason: "manual" as const };
  const target =
    input.budgetPressure >= 1
      ? input.current * 2
      : input.emptyRuns >= 3 || input.sourceScore < 0.25
        ? input.current * 2
        : input.sourceScore > 0.7 && input.generated > 0
          ? input.current * 0.8
          : input.current;
  const smoothed = Math.round(input.current * 0.7 + target * 0.3);
  return {
    interval: Math.max(input.min, Math.min(input.max, smoothed)),
    reason:
      input.budgetPressure >= 1
        ? ("budget_pressure" as const)
        : input.emptyRuns >= 3
          ? ("empty_runs" as const)
          : input.sourceScore > 0.7
            ? ("source_score_up" as const)
            : ("steady" as const),
  };
}
export function assertHumanApproval(input: {
  status: string;
  approvedBy?: string;
  autoSendEnabled?: boolean;
}) {
  if (
    input.status !== "approved" ||
    (!input.approvedBy && !input.autoSendEnabled)
  )
    throw Object.assign(new Error("Human approval required"), {
      reasonCode: "HUMAN_REJECTED" satisfies ReasonCode,
    });
}
export function withinDmWindow(inboundAt: Date, now = new Date(), hours = 24) {
  return now.getTime() - inboundAt.getTime() <= hours * 3_600_000;
}
export function overlapScore(
  input: { followed: number; commented: number; live: number; search: number },
  weights: {
    followed: number;
    commented: number;
    live: number;
    search: number;
  },
) {
  return (
    input.followed * weights.followed +
    input.commented * weights.commented +
    input.live * weights.live +
    input.search * weights.search
  );
}
export { reportIaUsage, type IaUsageEvent } from './ia-usage.js'
