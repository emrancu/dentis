# /create-task

Create a task file for one feature. Do not write any code. Only plan.

## Steps
1. **Take the task details** from the argument only. If empty or too vague, ask and stop. Make a short kebab-case `<task-id>`.
2. **Read the rules:** `README.md`, the principles, the matching epic in `epics/`, and every contract in `contracts/` the feature touches.
3. **Check the plan against them** before writing. If a part would break one, follow the deviation process in `commands/README.md` (two separate human approvals).
4. **Ask the user** what the plan still needs, one question at a time with the recommended option first. Always ask the **PR plan**: per subtask or one for all.
5. **Split into subtasks.** Each is small, finishable on its own, with a clear result. Contract changes come first. Per-subtask PR plan means every subtask is `parallel: no`. Apply YAGNI: only what this task and its contract need.
6. **Write `tasks/<task-id>.md`** in the format in `commands/README.md`, every marker `[ ]`. Never overwrite an existing file without asking.
7. **Show the user** the path, the subtasks, which can run in parallel, and the PR plan. Stop. Do not start the work.

## Hard rules
- The last subtask is always `Premortem & spec re-evaluation`.
- Use only the status markers from `commands/README.md`.
- Name the epic and the contracts in the task file.
