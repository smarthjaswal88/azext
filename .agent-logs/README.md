# .agent-logs

Automatic prompt/response capture for this repo, per the 8x assignment brief.

Nothing in here is written by hand. Entries are appended by
[`.claude/hooks/capture.py`](../.claude/hooks/capture.py), wired to two Claude Code
hook events in [`.claude/settings.json`](../.claude/settings.json):

| Event              | Fires                       | Writes                        |
|--------------------|-----------------------------|-------------------------------|
| `UserPromptSubmit` | when a prompt is submitted  | `[LOG_ENTRY type=PROMPT ...]`  |
| `Stop`             | when the turn ends          | `[LOG_ENTRY type=RESPONSE ...]`|

One file per session, named `YYYY-MM-DD_HH-MM-SS_<session-id>.md`.

The prompt is recorded verbatim from the hook payload. The response is the
**final** assistant text of the turn only — every text block after the last tool
call. Thinking blocks, tool calls, tool results and intermediate narration are
discarded, and subagent sidechains are excluded.

`.state/` holds per-session bookkeeping (exchange counter, dedup marker) and the
raw hook payloads captured while verifying the setup. It is committed on purpose
so the mechanism is auditable.

Entries are never edited after the fact. See [`../CAPTURE-TEST.md`](../CAPTURE-TEST.md).
