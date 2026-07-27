/**
 * CI / security-guardrails validator — deterministic, zero-dependency.
 * Uses Node built-in test runner (node:test) and safe line-by-line text
 * parsing. Fails RED before production configs exist, passes GREEN after.
 *
 * Run:  node --test tests/ci-validate.test.mjs
 */
import { describe, it } from "node:test";
import { ok, match, strictEqual, doesNotMatch } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── helpers ──────────────────────────────────────────────────────────
const ROOT = join(import.meta.dirname, "..");

function readIfExists(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

/** All `uses:` values in a workflow text. */
function extractUses(text) {
  return [...text.matchAll(/uses:\s*(.+)/g)].map((m) => m[1].trim());
}

/** Every non-local uses: must be pinned to a 40-hex SHA. */
function allPinned(usesList) {
  return usesList.filter((u) => !u.startsWith("./")).every((u) => /@[0-9a-f]{40}\b/.test(u));
}

const BANNED =
  /\b(telegram|supabase|apify|netlify|gmail|smtp|sendgrid|scrape|crawl|outreach|preview.publish)\b/i;

// ── 1. CI workflow ───────────────────────────────────────────────────
describe("ci.yml", () => {
  const ci = readIfExists(".github/workflows/ci.yml");

  it("exists", () => {
    ok(ci, ".github/workflows/ci.yml must exist");
  });

  it("targets Node 24", () => {
    ok(ci);
    match(ci, /node-version.*["']?24["']?/);
  });

  it("uses pnpm 11.9.0", () => {
    ok(ci);
    match(ci, /11\.9\.0/);
  });

  it("runs frozen install", () => {
    ok(ci);
    match(ci, /--frozen-lockfile/);
  });

  it("runs pnpm check (root gate)", () => {
    ok(ci);
    match(ci, /pnpm\s+(run\s+)?check/);
  });

  it("runs production audit at high severity", () => {
    ok(ci);
    match(ci, /audit/);
    match(ci, /--audit-level\s*(=\s*)?high/);
  });

  it("sets least permissions (top-level contents: read)", () => {
    ok(ci);
    match(ci, /permissions:/);
    match(ci, /contents:\s*read/);
  });

  it("uses concurrency cancellation", () => {
    ok(ci);
    match(ci, /concurrency:/);
    match(ci, /cancel-in-progress:\s*true/);
  });

  it("sets timeout-minutes", () => {
    ok(ci);
    match(ci, /timeout-minutes:/);
  });

  it("does not persist credentials on checkout", () => {
    ok(ci);
    match(ci, /persist-credentials:\s*false/);
  });

  it("pins all third-party actions to 40-hex commit SHAs", () => {
    ok(ci);
    const uses = extractUses(ci);
    ok(uses.length > 0, "must have at least one uses:");
    ok(allPinned(uses), `unpinned actions found: ${uses.join(", ")}`);
  });

  it("has version comments for pinned SHAs", () => {
    ok(ci);
    const pinLines = ci.split("\n").filter((l) => /uses:.*@[0-9a-f]{40}/.test(l));
    for (const line of pinLines) {
      match(line, /#\s*v\d+/, `missing version comment: ${line}`);
    }
  });

  it("contains no outbound business integration terms", () => {
    ok(ci);
    doesNotMatch(ci, BANNED);
  });
});

// ── 2. Gitleaks ──────────────────────────────────────────────────────
describe("gitleaks.yml", () => {
  const gl = readIfExists(".github/workflows/gitleaks.yml");

  it("exists", () => {
    ok(gl, ".github/workflows/gitleaks.yml must exist");
  });

  it("installs Gitleaks v8.30.1 CLI from GitHub release", () => {
    ok(gl);
    match(gl, /8\.30\.1/, "must reference Gitleaks version 8.30.1");
  });

  it("verifies linux_x64 archive SHA-256 before extraction", () => {
    ok(gl);
    match(
      gl,
      /551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb/,
      "must contain the exact SHA-256 checksum for linux_x64 archive",
    );
    match(gl, /sha256sum/, "must use sha256sum to verify");
  });

  it("runs CLI canary scan against runtime-generated secret", () => {
    ok(gl);
    match(gl, /canary/i, "must mention canary");
    match(gl, /gitleaks dir/, "must run the current Gitleaks directory-scan command");
    match(gl, /SWARM_CANARY_/, "must construct the canary prefix at runtime");
    match(gl, /TOKEN=/, "must construct the canary key at runtime");
    doesNotMatch(
      gl,
      /SWARM_CANARY_TOKEN=[A-Za-z0-9]{40}/,
      "workflow must not contain a committed matchable canary value",
    );
  });

  it("asserts canary exits nonzero (detection succeeded)", () => {
    ok(gl);
    // Must check exit code to prove detection worked
    match(gl, /CANARY_EXIT/, "must capture canary exit code");
  });

  it("runs full history scan with --redact", () => {
    ok(gl);
    match(gl, /--redact/, "full scan must use --redact");
    match(gl, /gitleaks git[^\n]*\s\.$/m, "must run gitleaks git against the repository history");
  });

  it("does NOT use gitleaks-action with: args (invalid for that action)", () => {
    ok(gl);
    // The gitleaks-action at ff9810 has no inputs — using with: args is invalid
    doesNotMatch(
      gl,
      /gitleaks-action.*\n[\s\S]*?with:\s*\n\s*args:/,
      "must not pass args to gitleaks-action (action has no inputs)",
    );
  });

  it("pins checkout action to a 40-hex SHA", () => {
    ok(gl);
    const uses = extractUses(gl);
    ok(allPinned(uses), `unpinned actions found: ${uses.join(", ")}`);
  });

  it("sets least permissions", () => {
    ok(gl);
    match(gl, /permissions:/);
    match(gl, /contents:\s*read/);
  });

  it("sets timeout-minutes", () => {
    ok(gl);
    match(gl, /timeout-minutes:/);
  });

  it("uses fetch-depth 0 for full history", () => {
    ok(gl);
    match(gl, /fetch-depth:\s*0/);
  });
});

describe(".gitleaks.toml", () => {
  const cfg = readIfExists(".gitleaks.toml");

  it("exists", () => {
    ok(cfg, ".gitleaks.toml must exist");
  });

  it("has a synthetic-canary rule", () => {
    ok(cfg);
    match(cfg, /canary/i);
    match(cfg, /SWARM_CANARY_TOKEN/);
  });

  it("does not contain broad path allowlists", () => {
    ok(cfg);
    // Must not have any [allowlist] paths = [...] that hide whole files
    doesNotMatch(
      cfg,
      /\[allowlist\][\s\S]*?paths\s*=/,
      "must not have allowlist paths (could hide real credentials)",
    );
  });
});

// ── 3. Dependabot ────────────────────────────────────────────────────
describe("dependabot.yml", () => {
  const dep = readIfExists(".github/dependabot.yml");

  it("exists", () => {
    ok(dep, ".github/dependabot.yml must exist");
  });

  it("covers npm ecosystem", () => {
    ok(dep);
    match(dep, /npm/);
  });

  it("covers github-actions ecosystem", () => {
    ok(dep);
    match(dep, /github-actions/);
  });

  it("uses weekly schedule", () => {
    ok(dep);
    match(dep, /weekly/);
  });

  it("sets grouped updates", () => {
    ok(dep);
    match(dep, /groups:/);
  });

  it("limits open PRs", () => {
    ok(dep);
    match(dep, /open-pull-requests-limit:/);
  });
});

// ── 4. Dependency review ─────────────────────────────────────────────
describe("dependency-review.yml", () => {
  const dr = readIfExists(".github/workflows/dependency-review.yml");

  it("exists", () => {
    ok(dr, ".github/workflows/dependency-review.yml must exist");
  });

  it("triggers on pull_request", () => {
    ok(dr);
    match(dr, /pull_request/);
  });

  it("sets least permissions", () => {
    ok(dr);
    match(dr, /permissions:/);
    match(dr, /contents:\s*read/);
  });

  it("uses high severity failure threshold", () => {
    ok(dr);
    match(dr, /high/);
  });

  it("pins all actions to 40-hex SHAs", () => {
    ok(dr);
    ok(allPinned(extractUses(dr)));
  });
});

// ── 5. CodeQL ────────────────────────────────────────────────────────
describe("codeql.yml", () => {
  const cq = readIfExists(".github/workflows/codeql.yml");

  it("exists", () => {
    ok(cq, ".github/workflows/codeql.yml must exist");
  });

  it("targets javascript-typescript language", () => {
    ok(cq);
    match(cq, /javascript-typescript/);
  });

  it("triggers on push, pull_request, and schedule", () => {
    ok(cq);
    match(cq, /push:/);
    match(cq, /pull_request/);
    match(cq, /schedule:/);
  });

  it("sets minimal permissions with security-events: write", () => {
    ok(cq);
    match(cq, /security-events:\s*write/);
  });

  it("pins all actions to 40-hex SHAs", () => {
    ok(cq);
    ok(allPinned(extractUses(cq)));
  });
});

// ── 6. Cross-cutting: no outbound integration ────────────────────────
describe("no outbound business integration in any workflow", () => {
  const workflows = [
    ".github/workflows/ci.yml",
    ".github/workflows/gitleaks.yml",
    ".github/workflows/dependency-review.yml",
    ".github/workflows/codeql.yml",
  ];

  for (const wf of workflows) {
    it(`${wf} has no banned terms`, () => {
      const text = readIfExists(wf);
      ok(text, `${wf} must exist`);
      doesNotMatch(text, BANNED);
    });
  }
});

// ── 7. Root package.json sanity ──────────────────────────────────────
describe("root package.json", () => {
  const pkg = readIfExists("package.json");

  it("requires Node >= 24", () => {
    ok(pkg);
    match(pkg, /"node":\s*">=24"/);
  });

  it("pins pnpm 11.9.0", () => {
    ok(pkg);
    match(pkg, /"pnpm@11\.9\.0"/);
  });

  it('has a "check" script', () => {
    ok(pkg);
    match(pkg, /"check":/);
  });

  it("check script runs root-level validator test", () => {
    ok(pkg);
    match(
      pkg,
      /node\s+--test\s+tests\/ci-validate\.test\.mjs/,
      "check must run the CI validator test at root level",
    );
  });
});
