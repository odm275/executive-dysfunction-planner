import { run, pi } from "@ai-hero/sandcastle";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";

// Simple loop: an agent that picks open GitHub issues one by one and closes them.
// Run this with: npx tsx .sandcastle/main.ts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.ts"

await run({
  // A name for this run, shown as a prefix in log output.
  name: "worker",

  // Sandbox provider — Podman runtime.
  // Mount only auth.json read-only to a staging path. pi needs a writable
  // config dir for lock files, so we copy auth.json into a fresh writable dir
  // via onSandboxReady and point PI_CODING_AGENT_DIR there.
  sandbox: podman({
    mounts: [
      {
        hostPath: "~/.pi/agent/auth.json",
        sandboxPath: "/tmp/pi-auth.json",
        // Podman expects combined volume options like ro,z. The current
        // Sandcastle podman provider emits ro:z for readonly mounts, which
        // fails parsing, so keep this mount writable and copy into a writable
        // agent dir during onSandboxReady.
      },
    ],
  }),

  // The agent provider. Use the github-copilot/ prefix so pi routes through
  // GitHub Copilot OAuth (from auth.json) instead of looking for an Anthropic
  // API key. Note: GH Copilot uses dot notation — claude-sonnet-4.6, not 4-6.
  // PI_CODING_AGENT_DIR points pi to the writable config dir we set up below.
  agent: pi("github-copilot/claude-sonnet-4.6", {
    env: { PI_CODING_AGENT_DIR: "/home/agent/.pi-agent" },
  }),

  // Path to the prompt file. Shell expressions inside are evaluated inside the
  // sandbox at the start of each iteration, so the agent always sees fresh data.
  promptFile: "./.sandcastle/prompt.md",

  // Maximum number of iterations (agent invocations) to run in a session.
  // Each iteration works on a single issue. Increase this to process more issues
  // per run, or set it to 1 for a single-shot mode.
  maxIterations: 2,

  // Branch strategy — merge-to-head creates a temporary branch for the agent
  // to work on, then merges the result back to HEAD when the run completes.
  // This is required when using copyToSandbox, since head mode bind-mounts
  // the host directory directly (no worktree to copy into).
  branchStrategy: { type: "merge-to-head" },

  // Copy node_modules from the host into the worktree before the sandbox
  // starts. This avoids a full npm install from scratch on every iteration.
  // The onSandboxReady hook still runs npm install as a safety net to handle
  // platform-specific binaries and any packages added since the last copy.
  copyToSandbox: ["node_modules"],

  // Lifecycle hooks — commands that run inside the sandbox at specific points.
  hooks: {
    // onSandboxReady runs once after the sandbox is initialised and the repo is
    // synced in, before the agent starts. Use it to install dependencies or run
    // any other setup steps your project needs.
    onSandboxReady: [
      // Set up a writable pi config dir with the host's auth credentials so
      // pi can authenticate with GitHub Copilot without an interactive /login.
      { command: "mkdir -p /home/agent/.pi-agent && cp /tmp/pi-auth.json /home/agent/.pi-agent/auth.json" },
      { command: "npm install" },
    ],
  },
});
