import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

type CodeGraphStatus = {
  initialized?: boolean;
  lastIndexed?: string | null;
  pendingChanges?: { added?: number; modified?: number; removed?: number };
  index?: { reindexRecommended?: boolean };
};

const mode = process.argv[2] ?? "check";
const projectRoot = process.cwd();
const architectureDocs = [
  "docs/architecture/README.md",
  "docs/architecture/overview.md",
  "docs/architecture/editor.md",
  "docs/architecture/templates.md",
  "docs/architecture/projects.md",
  "docs/architecture/ai.md",
  "docs/architecture/exports-and-rendering.md",
  "docs/architecture/data-and-jobs.md",
  "docs/architecture/ui.md",
];

function run(command: string, args: string[], capture = false): string {
  // All commands and arguments in this file are fixed literals. Passing one
  // command string avoids Node's Windows `.cmd` launcher incompatibility while
  // also avoiding the deprecated `args + shell` combination.
  const result = spawnSync([command, ...args].join(" "), {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.trim() ?? "unknown error";
    throw new Error(`Failed to run ${command} ${args.join(" ")}: ${detail}`);
  }

  return result.stdout ?? "";
}

function getCodeGraphStatus(): CodeGraphStatus {
  const raw = run("codegraph", ["status", "--json"], true).trim();
  return JSON.parse(raw) as CodeGraphStatus;
}

function updateRtk(): void {
  // Reapply the official, idempotent local Codex integration. This is the
  // supported RTK refresh on native Windows, where shell hooks are unavailable.
  run("rtk", ["init", "--codex"]);
  run("rtk", ["init", "--codex", "--show"]);
}

function updateCodeGraph(): void {
  const status = getCodeGraphStatus();

  if (!status.initialized || !existsSync(".codegraph")) {
    run("codegraph", ["init", "."]);
  } else if (status.index?.reindexRecommended) {
    // A CLI extraction update needs a complete rebuild; ordinary source edits
    // use the much cheaper incremental sync below.
    run("codegraph", ["index", ".", "--force", "--quiet"]);
  } else {
    run("codegraph", ["sync", ".", "--quiet"]);
  }

  const refreshed = getCodeGraphStatus();
  if (!refreshed.initialized || !refreshed.lastIndexed) {
    throw new Error("CodeGraph did not produce a usable local index.");
  }
}

function changedFiles(pathspec: string[]): string[] {
  try {
    return run("git", ["diff", "--name-only", "--", ...pathspec], true)
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    // A project can be used outside Git; missing history must not block the
    // context workflow.
    return [];
  }
}

function hasWorkingTreeChanges(pathspec: string[]): boolean {
  try {
    return run("git", ["status", "--porcelain", "--", ...pathspec], true).trim().length > 0;
  } catch {
    return false;
  }
}

function architectureState() {
  const missing = architectureDocs.filter((file) => !existsSync(file));
  const sourceChanges = changedFiles([
    "src",
    "package.json",
    "drizzle.config.ts",
    "docker-compose.yml",
    "vite.config.ts",
  ]);
  // `git diff` does not include new, untracked documents. `git status` closes
  // that gap while preserving the advisory behavior for established projects.
  const documentationChanged = hasWorkingTreeChanges(["docs/architecture"]);
  const needsReview = sourceChanges.length > 0 && !documentationChanged;
  return { missing, sourceChanges, needsReview };
}

function checkArchitecture(): { valid: boolean; needsReview: boolean } {
  const state = architectureState();

  if (state.missing.length > 0) {
    console.error("Architecture documentation is missing:\n- " + state.missing.join("\n- "));
  }
  if (state.needsReview) {
    console.warn(
      `Architecture review recommended: ${state.sourceChanges.length} changed source/config file(s) have no accompanying docs/architecture diff.`,
    );
  }
  if (state.missing.length === 0 && !state.needsReview) {
    console.log("Architecture documentation is present and no undocumented source diff was detected.");
  }

  return { valid: state.missing.length === 0, needsReview: state.needsReview };
}

function updateArchitecture(): void {
  const state = checkArchitecture();
  if (!state.valid) {
    throw new Error("Create the missing architecture documents before refreshing context.");
  }

  console.log(
    "Documentation is intentionally manual: review the affected module document when its flow, main files, or internal dependencies changed.",
  );
}

function checkContext(): void {
  const problems: string[] = [];

  if (!existsSync("RTK.md") || !existsSync("AGENTS.md")) {
    problems.push("RTK local instructions are missing; run npm run rtk:update.");
  }

  try {
    run("rtk", ["--version"]);
  } catch {
    problems.push("RTK is unavailable on PATH; install or repair RTK first.");
  }

  try {
    const status = getCodeGraphStatus();
    const pending = status.pendingChanges;
    const changed = (pending?.added ?? 0) + (pending?.modified ?? 0) + (pending?.removed ?? 0);

    if (!status.initialized || !status.lastIndexed) {
      problems.push("CodeGraph has no local index; run npm run codegraph:update.");
    }
    if (status.index?.reindexRecommended) {
      problems.push("CodeGraph recommends a full rebuild; run npm run codegraph:update.");
    }
    if (changed > 0) {
      problems.push(`CodeGraph has ${changed} pending file change(s); run npm run codegraph:update.`);
    }
  } catch {
    problems.push("CodeGraph is unavailable or its status cannot be read; run npm run codegraph:update.");
  }

  const architecture = checkArchitecture();
  if (!architecture.valid) {
    problems.push("Architecture documentation is incomplete; run npm run docs:architecture:update after restoring the missing files.");
  }

  if (problems.length > 0) {
    console.error("Context tooling needs attention:\n- " + problems.join("\n- "));
    process.exitCode = 1;
    return;
  }

  console.log("Context tooling is ready: RTK instructions and the CodeGraph index are current.");
}

try {
  switch (mode) {
    case "rtk:update":
      updateRtk();
      break;
    case "codegraph:update":
      updateCodeGraph();
      break;
    case "update":
      updateRtk();
      updateCodeGraph();
      updateArchitecture();
      break;
    case "check":
      checkContext();
      break;
    case "docs:check":
      if (!checkArchitecture().valid) process.exitCode = 1;
      break;
    case "docs:update":
      updateArchitecture();
      break;
    default:
      throw new Error(`Unknown context command: ${mode}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
