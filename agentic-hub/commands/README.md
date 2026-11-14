# Commands

Claude commands for the hub. Run them from the repo root. Each is written here in `commands/`. The file in `.claude/commands/` only loads it, so the instructions stay with the docs.

| Command | What |
|---|---|
| `/create-task <task details>` | Plan a feature into a task file in `tasks/` |
| `/task-loop <task file>` | Do a task file subtask by subtask on its own branch |

This is one repo, so a task has one branch and one pull request plan. The code and the hub live together.

## /create-task

Creates `tasks/<task-id>.md`. The `<task-id>` is a short kebab-case name from the title. The details come from what you type after the command. Plan only, no code. Subtasks are split so each can be finished on its own.

The task must follow the [principles](../principles.md), its epic in `epics/` and the [contracts](../contracts/README.md). The command checks the plan against them before writing. If the plan would break one, a human must approve it in **two separate asks**: first the rule and the difference (with the compliant option offered), then the exact wording. Without both approvals the compliant plan is used. Each approval covers one deviation and is recorded under `## Approved deviations`.

### Status markers

| Marker | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | Running |
| `[!]` | Waiting on merge |
| `[x]` | Done |

### Parallel or not
Every subtask says `parallel: yes` or `parallel: no (after <subtask>)`. Two subtasks are parallel only if they touch different files and do not need each other's output. With the **Per subtask** plan every subtask is `parallel: no`.

### Always last: Premortem & spec re-evaluation
Never skipped, never moved.
- **Premortem:** imagine the feature failed in use. List likely causes and how each is covered.
- **Spec re-evaluation:** compare what was built with the spec, principles and contracts. Update the spec and contracts if reality changed.

### Pull requests
Branch: `feature/<task-id>`. `/create-task` asks which plan:

| Plan | How it works |
|---|---|
| **Per subtask** | Each subtask gets its own pull request into the feature branch and is `[!]` until merged. The next subtask waits. After the premortem, one feature pull request merges the branch into `main`. |
| **One for all** | All subtasks are committed to the feature branch. After the premortem, one pull request merges it into `main`. |

### File format

```md
# <Task title>

- Task id: `<task-id>`
- Epic: <link to epics/...>
- Contracts: <links to contracts/...>
- PR plan: per subtask | one for all
- Branch: `feature/<task-id>`
- Pull request: <url when opened>

## Goal
What the user can do when this is finished.

## Spec
Details, decisions, edge cases, out of scope.

## Approved deviations
None. (Otherwise: rule, what differs, why, approved by.)

## Subtasks

- [ ] 1. <name>
  - parallel: yes
  - what: <result of this subtask>
  - files: <expected files or areas>
  - done when: <testable check>
- [ ] N. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: <failure causes and mitigations>
  - spec changes: <what changed in spec and contracts>
  - done when: premortem filled in and spec and contracts match what was built
```

## Finished tasks
When the pull request is merged:
1. Write `outcomes/<task-id>.md`: what was completed and the pull request link. Nothing else.
2. Copy each open risk a later task must act on into `## Open risks` in the epic.
3. Delete `tasks/<task-id>.md`. Anything worth keeping must already be in the contracts, epic or `decisions.md`.

## /task-loop

Runs a task file from `tasks/` and keeps its markers true. It follows the principles, epic, contracts and the chosen PR plan.

**Start**
1. Find `tasks/<task-id>.md` from the argument. If empty or missing, list `tasks/` and ask. Stop if there are none.
2. Read `README.md`, the principles, the epic and the contracts named in the file. Deviations need the two-ask process.
3. If the task is already running (`feature/<task-id>` exists and a marker is not `[ ]`), resume without asking: start the first `[ ]` subtask or continue the `[~]` one.
4. For a new task, ask where to work (recommended first): **Worktree** (`.worktree/<task-id>`, main folder untouched) or **Branch here** (check out `feature/<task-id>` in the repo folder). The working tree must be clean, or stop and ask. Never work on `main`.

**Loop**, for each subtask in order:
1. Set `[~]` and commit.
2. Do the work. Run `parallel: yes` subtasks as separate subagents at the same time, everything else one at a time. A contract change comes before the code that uses it. Write the tests with the code.
3. Check `done when`, and run `npm test`. Fix until true.
4. Commit. **One for all:** set `[x]` and go on. **Per subtask:** work on `feature/<task-id>-sub-<n>`, push, open a pull request into `feature/<task-id>`, set `[!]`, stop and wait for the merge, then switch back, pull, set `[x]`.

The last subtask is the premortem. After it, push `feature/<task-id>` and open one pull request into `main` with the premortem and spec changes in the description. Mark it `[!]` and stop.

**Clean up** after the merge: remove the worktree, delete the local branches, `git switch main`, pull, then write the outcome file as described above. Leave the commit and push of that to the user.

**Rules**
- Allowed: commits and pushes of the task's own branches, and opening their pull requests. Nothing else.
- Never push to `main`, merge a pull request, or force push.
- If a subtask cannot be done as written, stop and tell the user. Do not change the spec without the deviation process.
- Do not start a subtask while the previous one is `[!]` under the per-subtask plan.
