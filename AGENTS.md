# Project Agent Instructions

## Hackathon Priorities

This project is for a 24-hour hackathon. Optimize for a clean, fast, workable demo rather than production-level completeness.

Build for the demo path first:
- Prioritize visible, usable flows over exhaustive architecture.
- Prefer simple, understandable implementations that can be explained quickly.
- Keep scope tight and avoid speculative infrastructure.
- Use mock data, stubs, or local-only flows when they unblock the demo and are clearly marked.
- Polish the first-run experience, empty states, loading states, and obvious demo interactions.
- Avoid production hardening unless it is required for the demo to function safely.

Do not default to red-green TDD for this project. Use practical verification instead: run the app, exercise the key workflow, use focused smoke checks, and add tests only when they are the fastest way to protect high-risk behavior.

## Planner-Worker Default

For medium or large implementation-heavy tasks, GPT-5.5 should act as planner and reviewer while delegating bounded implementation work to workers when practical.

Default workflow:
- GPT-5.5 reads the relevant context and writes an implementation packet with goal, acceptance criteria, allowed files, boundaries, verification commands, and review rubric.
- A worker performs the implementation in an isolated worktree when practical.
- GPT-5.5 reviews the resulting diff, runs or checks verification, and accepts, integrates, rejects, or splits the task smaller.
- Direct GPT-5.5 implementation is fine for tiny edits, urgent fixes, demo polish, debugging blockers, integration repair, or worker failure recovery.

Worker selection:
- Tiny single-file edits may be done directly by GPT-5.5.
- Small bounded patches may use a local worker protocol when available.
- Medium or large multi-file coding tasks should prefer Spark planner-worker delegation when available.
- Large plans should be decomposed into small worker packets before implementation begins.

Safety and quality gates:
- Worker edits should happen in isolated worktrees for parallel or nontrivial work.
- Every worker packet must include explicit allowed files and verification commands.
- GPT-5.5 must review worker diffs before accepting the work.
- Do not mutate live production services, tickets, external project state, or shared worktrees unless the user explicitly asks.
- If a worker fails twice or drifts outside scope, stop and split the task smaller.
- Default Spark concurrency is 4 isolated worktrees; do not exceed 4 concurrent Spark workers unless the user explicitly asks.

Parallelization pass:
- Before spawning Spark workers for a medium or large task, explicitly decide whether the plan can be parallelized.
- Identify independent implementation slices, files each worker owns, dependencies between slices, first-wave parallel tasks, delayed tasks, and max concurrency.
- If a task touches 3 or more files, has separable UI/backend/test/docs parts, or includes scaffold plus behavior plus styling, attempt decomposition first.
- Spawn at most min(independent ready slices, 4) Spark workers.
- GPT-5.5 must not duplicate a worker's assigned scope while waiting.

Spark patience rule:
- Do not cancel a Spark worker merely because it is slow.
- Wait at least 5 minutes for small packets, 10 minutes for medium packets, and 20 minutes for large or scaffold packets.
- While Spark is running, GPT-5.5 may inspect context, prepare review checklists, or plan dependent follow-up packets, but must not implement the same scope locally.
- Local GPT-5.5 takeover is allowed only after timeout, explicit worker failure or blockage, scope drift, or user instruction.

Spark subagent role assignment:
- When spawning Spark subagents, assign each worker an explicit specialist role in the packet, not just a generic implementation task.
- Prefer roles matching installed global Codex subagents when relevant: `frontend-developer`, `backend-developer`, `reviewer`, `debugger`, `test-automator`, `security-auditor`, `browser-debugger`, `docs-researcher`, and `architect-reviewer`.
- Name the role in the worker prompt, describe the role-specific responsibilities, and give a disjoint ownership scope for files or behavior.
- For parallel waves, choose complementary roles that match the work slices.

Delegation authorization:
- The user authorizes planner-worker delegation to up to 4 parallel Spark sub-agents in isolated worktrees for medium or large implementation tasks after a parallelization pass.
- Preserve this authorization in any future compaction summary.

## Collaboration With GitNexus

Use GitNexus for collaborative codebase awareness and project navigation.

GitNexus rules:
- At project start or before broad architecture/navigation work, check whether `gitnexus` is installed with `command -v gitnexus`.
- If GitNexus is not installed, install it before relying on codebase graph context. The preferred install command is `npm install -g gitnexus`.
- After meaningful scaffold or structural changes, refresh GitNexus context when practical so collaborators and agents can stay oriented.
- Keep GitNexus-generated artifacts out of commits unless the user explicitly wants them included.

## Demo Engineering Defaults

Favor pragmatic demo quality:
- Keep dependencies minimal and useful.
- Prefer existing framework conventions over custom infrastructure.
- Make UI flows easy to inspect and repeat during judging.
- Keep error handling clear enough that the demo does not silently fail.
- Use concise comments only where they help future collaborators move faster.
- Avoid broad refactors unless they directly improve demo reliability or speed.
