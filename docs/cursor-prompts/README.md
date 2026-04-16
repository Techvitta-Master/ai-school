# Cursor Prompts — Task Playbook

Each file in this folder is a self-contained brief for Claude Sonnet 4.6 to execute. Run them in order.

## How to use

1. **Open Cursor chat** (Cmd/Ctrl + L)
2. **Reference the prompt file:**
   ```
   @docs/cursor-prompts/01-seed-madavi.md
   Please execute this task end-to-end.
   ```
3. Claude will read the file, read [`../../PLAN.md`](../../PLAN.md), read [`../../AGENTS.md`](../../AGENTS.md), and execute.
4. Review the diff. Accept / ask for changes.
5. Commit with the suggested message.
6. Move to the next prompt.

## Execution order

| # | File | Blocks | ETA |
|---|------|--------|-----|
| 1 | `01-seed-madavi.md` | — | 30 min |
| 2 | `02-enhance-eval-rca.md` | 1 | 90 min |
| 3 | `03-wire-teacher-upload.md` | 2 | 60 min |
| 4 | `04-teacher-class-view.md` | 3 | 60 min |
| 5 | `05-student-report-card.md` | 2 | 120 min |
| 6 | `06-polish-ui.md` | any | 90 min |
| 7 | `07-e2e-tests.md` | 3,5 | 60 min |
| 8 | `08-vercel-deploy.md` | 7 | 45 min |

**Total:** ~9 hours of focused Claude-assisted development.

## Tips for working with Claude 4.6

- **Be explicit about scope.** If the prompt says "do X and Y", Claude will do both. If you only want X, say so.
- **Show intermediate state.** Add `"Show me the plan before editing"` to the prompt for high-risk changes.
- **Use background agents** for tasks 1, 6, 7 — they're parallelizable with task 5.
- **Don't skip the review.** Always diff-check before committing, even for low-risk tasks.

## What to do if a task fails

1. Read the error output.
2. Ask Claude to fix in the same chat (context is preserved).
3. If stuck > 10 min, reset: close chat, open a fresh chat with the prompt + `The previous attempt failed with: <error>. Please start over, avoiding <problem>.`

## Done = MVP

When all 8 tasks are green, you have an MVP you can demo to stakeholders.
