window.AI_SDLC_DATA = {
  meta: {
    title: "AI SDLC Skills/Spec Viewer",
    schemaVersion: "1",
    generatedAt: "2026-10-18T09:30:00Z",
    source: "/home/dev/acme-shop",
    repoName: "acme-shop",
    scannedBy: "Claude Code",
    git: true,
    candidates: [
      ".claude/skills/plan-feature/SKILL.md",
      ".claude/agents/reviewer.md",
      ".claude/agents/db-migrator.md",
      ".cursor/rules/style.mdc",
      "specs/checkout-spec.md",
      "scripts/lint.sh",
      "packages/web/.claude/skills/lint-fix/SKILL.md",
      "packages/api/.claude/skills/lint-fix/SKILL.md",
      ".claude/commands/local-notes.md",
      "docs/adr/0001-use-postgres.md"
    ]
  },
  phases: {
    source: "placeholder",
    list: [
      { id: "plan", name: "Plan", description: "Decide what to build" },
      { id: "build", name: "Build" }
    ]
  },
  items: [
    {
      id: "plan-feature",
      name: "plan-feature",
      kind: "skill",
      ecosystem: "claude",
      level: "full",
      package: null,
      localOnly: false,
      paths: [".claude/skills/plan-feature/SKILL.md"],
      ownDescription: "Turn a feature request into a short implementation plan.",
      summary: "Plans a feature and hands the plan to the reviewer agent.",
      whatItDoes: ["Reads the feature request", "Writes a step-by-step plan", "Delegates review to the reviewer agent"],
      invocation: {
        parts: [
          { text: "/plan-feature", role: "literal" },
          { text: "<feature>", role: "required" },
          { text: "[--depth N]", role: "optional" }
        ]
      },
      triggers: [
        { type: "user-command", detail: "/plan-feature", evidence: { path: ".claude/skills/plan-feature/SKILL.md", line: 2, quote: "name: plan-feature" } },
        { type: "webhook", detail: "Issue labeled needs-plan", evidence: { path: ".claude/skills/plan-feature/SKILL.md", line: 8, quote: "Also runs when an issue is labeled needs-plan" } }
      ],
      inputs: ["Feature request text"],
      outputs: ["Implementation plan"],
      phase: "plan",
      sdlcRole: "planning",
      tags: ["planning"]
    },
    {
      id: "reviewer",
      name: "reviewer",
      kind: "agent",
      ecosystem: "claude",
      level: "full",
      package: null,
      localOnly: false,
      paths: [".claude/agents/reviewer.md"],
      ownDescription: "Reviews plans and diffs for correctness.",
      summary: "Reviews a plan or diff and reports issues.",
      whatItDoes: ["Reads the plan", "Lists problems found"],
      invocation: null,
      triggers: [{ type: "other", detail: "Called by plan-feature" }],
      inputs: ["Plan or diff"],
      outputs: ["Review notes"],
      phase: "build",
      sdlcRole: "review"
    },
    {
      id: "db-migrator",
      name: "db-migrator",
      kind: "agent",
      ecosystem: "claude",
      level: "full",
      package: null,
      localOnly: false,
      paths: [".claude/agents/db-migrator.md"],
      ownDescription: "Writes and applies schema changes.",
      summary: "Handles database schema changes.",
      whatItDoes: ["Drafts schema change files", "Applies them to a dev database"],
      invocation: null,
      triggers: [{ type: "user-command", detail: "Ask the agent directly" }],
      inputs: ["Schema change request"],
      outputs: ["Schema change files"],
      phase: "build",
      sdlcRole: "data"
    },
    {
      id: "style-rule",
      name: "style",
      kind: "rule",
      ecosystem: "cursor",
      level: "full",
      package: null,
      localOnly: false,
      paths: [".cursor/rules/style.mdc"],
      ownDescription: "Use two-space indentation.",
      summary: "Coding style rule applied to all files.",
      whatItDoes: ["Sets indentation style"],
      invocation: null,
      triggers: [{ type: "other", detail: "Always applied" }],
      inputs: [],
      outputs: [],
      phase: "build",
      sdlcRole: "standards"
    },
    {
      id: "checkout-spec",
      name: "checkout-spec",
      kind: "spec",
      ecosystem: "generic",
      level: "full",
      package: null,
      localOnly: false,
      paths: ["specs/checkout-spec.md"],
      ownDescription: null,
      summary: "Goal: let a shopper pay for a cart in one step.",
      whatItDoes: ["Defines the checkout behavior the AI builds from"],
      invocation: null,
      triggers: [],
      inputs: ["Cart contents", "Payment method"],
      outputs: ["Order confirmation"],
      phase: "plan",
      sdlcRole: "specification"
    },
    {
      id: "lint",
      name: "lint",
      kind: "script",
      ecosystem: "generic",
      level: "light",
      package: null,
      localOnly: false,
      paths: ["scripts/lint.sh"],
      ownDescription: null,
      summary: null,
      whatItDoes: [],
      invocation: null,
      triggers: [],
      inputs: [],
      outputs: [],
      phase: null,
      sdlcRole: null
    },
    {
      id: "packages-web-lint-fix",
      name: "lint-fix",
      kind: "skill",
      ecosystem: "claude",
      level: "light",
      package: "packages/web",
      localOnly: false,
      paths: ["packages/web/.claude/skills/lint-fix/SKILL.md"],
      ownDescription: "Fix lint errors in the web package.",
      summary: null,
      whatItDoes: [],
      invocation: null,
      triggers: [],
      inputs: [],
      outputs: [],
      phase: null,
      sdlcRole: null
    },
    {
      id: "packages-api-lint-fix",
      name: "lint-fix",
      kind: "skill",
      ecosystem: "claude",
      level: "light",
      package: "packages/api",
      localOnly: false,
      paths: ["packages/api/.claude/skills/lint-fix/SKILL.md"],
      ownDescription: "Fix lint errors in the api package.",
      summary: null,
      whatItDoes: [],
      invocation: null,
      triggers: [],
      inputs: [],
      outputs: [],
      phase: null,
      sdlcRole: null
    },
    {
      id: "local-notes",
      name: "local-notes",
      kind: "command",
      ecosystem: "claude",
      level: "light",
      package: null,
      localOnly: true,
      paths: [".claude/commands/local-notes.md"],
      ownDescription: "Personal scratch notes command.",
      summary: null,
      whatItDoes: [],
      invocation: null,
      triggers: [],
      inputs: [],
      outputs: [],
      phase: null,
      sdlcRole: null
    }
  ],
  links: [
    {
      from: "plan-feature", to: "reviewer", type: "calls", inferred: false,
      evidence: { path: ".claude/skills/plan-feature/SKILL.md", line: 12, quote: "Delegate to the reviewer agent" }
    },
    {
      from: "checkout-spec", to: "plan-feature", type: "handoff", inferred: false,
      evidence: { path: "specs/checkout-spec.md", line: 3, quote: "Next step: run /plan-feature" }
    },
    {
      from: "reviewer", to: "lint", type: "triggers", inferred: true,
      reason: "Reviewer description mentions running lint before sign-off"
    }
  ],
  unclassified: [
    { path: "docs/adr/0001-use-postgres.md", reason: "design doc, not used by AI tooling" }
  ]
};
