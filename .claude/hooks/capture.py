#!/usr/bin/env python3
"""
Automatic prompt/response capture for the 8x assignment.

Wired in .claude/settings.json to two Claude Code hook events:
  UserPromptSubmit -> capture.py prompt    (logs the verbatim prompt)
  Stop             -> capture.py response  (logs the FINAL response of that turn)

Design notes:
  * The prompt is taken from the hook's stdin payload, verbatim, untouched.
  * The response is extracted from the session transcript JSONL. We deliberately
    keep ONLY the trailing text of the turn: every assistant text block that comes
    after the last tool_use block. Thinking blocks, tool calls, tool results and
    intermediate narration are dropped on the floor.
  * Subagent / sidechain records are excluded so a spawned agent's chatter never
    masquerades as the main answer.
  * This script must NEVER write to stdout: for UserPromptSubmit, stdout is
    injected back into Claude's context. It must also never fail the turn, so
    everything is wrapped and we always exit 0.
"""

import sys
import os
import io
import json
import re
import datetime

EVENT = sys.argv[1] if len(sys.argv) > 1 else "prompt"

HOOK_DIR = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HOOK_DIR))
LOGS = os.path.join(REPO, ".agent-logs")
STATE_DIR = os.path.join(LOGS, ".state")
DEBUG_FLAG = os.path.join(STATE_DIR, "DEBUG")

AUTHOR = "smarthjaswal88"
PROJECT = os.path.basename(REPO)
TOOL = "claude-code"


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)


def note(msg):
    """Append to an error log. Never raises, never touches stdout."""
    try:
        with io.open(os.path.join(STATE_DIR, "hook-errors.log"), "a", encoding="utf-8") as fh:
            fh.write("%s [%s] %s\n" % (iso(utc_now()), EVENT, msg))
    except Exception:
        pass


def read_json_file(path, default=None):
    try:
        with io.open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def write_json_file(path, obj):
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(obj, indent=2, ensure_ascii=False))


# --------------------------------------------------------------------------- #
# transcript parsing
# --------------------------------------------------------------------------- #

def load_transcript(path):
    records = []
    if not path or not os.path.exists(path):
        return records
    try:
        with io.open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except Exception:
                    continue
    except Exception as exc:
        note("transcript read failed: %r" % (exc,))
    return records


def is_main_chain(rec):
    """Exclude subagent sidechains and meta/system-injected records."""
    return not rec.get("isSidechain") and not rec.get("isMeta")


def content_blocks(rec):
    content = (rec.get("message") or {}).get("content")
    if isinstance(content, list):
        return [b for b in content if isinstance(b, dict)]
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return []


def block_types(rec):
    return set(b.get("type") for b in content_blocks(rec))


def text_of(rec):
    return "".join(b.get("text", "") for b in content_blocks(rec) if b.get("type") == "text")


# Records the IDE / CLI injects into the user channel that are not typed prompts.
# They must not be mistaken for turn boundaries when locating a final response.
INJECTED_PREFIXES = (
    "<ide_opened_file>",
    "<ide_selection>",
    "<system-reminder>",
    "<command-name>",
    "<command-message>",
    "<local-command-stdout>",
    "[Request interrupted",
    "This session is being continued from",
    "Caveat: The messages below",
    "API Error",
)


def is_real_user_prompt(rec):
    """A human-typed prompt: not a tool_result turnaround, not an IDE injection."""
    if rec.get("type") != "user" or not is_main_chain(rec):
        return False
    types = block_types(rec)
    if "tool_result" in types:
        return False
    text = text_of(rec).strip()
    if not text:
        return False
    return not text.startswith(INJECTED_PREFIXES)


def is_assistant(rec):
    return (
        rec.get("type") == "assistant"
        and is_main_chain(rec)
        and not rec.get("isApiErrorMessage")
    )


def current_turn_model(records):
    """Model of the most recent assistant record on the main chain."""
    for rec in reversed(records):
        if is_assistant(rec):
            model = (rec.get("message") or {}).get("model")
            if model:
                return model
    return None


def final_response(records):
    """
    Return (text, last_assistant_uuid) for the most recent turn.

    'Final response' = concatenated assistant text blocks that appear AFTER the
    last tool_use in the turn. That is exactly what the user saw as the answer,
    with all intermediate steps excluded.
    """
    # locate the most recent genuine user prompt
    start = 0
    for idx in range(len(records) - 1, -1, -1):
        if is_real_user_prompt(records[idx]):
            start = idx
            break

    turn = [r for r in records[start + 1:] if is_assistant(r)]
    if not turn:
        return "", None

    last_uuid = turn[-1].get("uuid")

    # index of the last record that issued a tool call
    cut = -1
    for idx, rec in enumerate(turn):
        if "tool_use" in block_types(rec):
            cut = idx

    tail = turn[cut + 1:]
    text = "\n\n".join(t for t in (text_of(r).strip() for r in tail) if t)
    return text.strip(), last_uuid


# --------------------------------------------------------------------------- #
# log file rendering
# --------------------------------------------------------------------------- #

FM_RE = re.compile(r"\A---\n.*?\n---\n", re.DOTALL)


def frontmatter(state):
    return (
        "---\n"
        "session_id: %s\n"
        "date: %s\n"
        "author: %s\n"
        "model: %s\n"
        "tool: %s\n"
        "project: %s\n"
        "total_exchanges: %d\n"
        "first_prompt_time: %s\n"
        "last_prompt_time: %s\n"
        "---\n"
        % (
            state["session_id"],
            state["date"],
            AUTHOR,
            state.get("model") or "unknown",
            TOOL,
            PROJECT,
            state.get("n", 0),
            state.get("first_prompt_time", ""),
            state.get("last_prompt_time", ""),
        )
    )


def header(state):
    return (
        "\n# Session Log - %s\n\n"
        "Session: `%s` | Project: `%s` | Author: `%s`\n\n"
        "---\n"
        % (state["date"], state["session_id"][:8], PROJECT, AUTHOR)
    )


def log_path(state):
    return os.path.join(LOGS, state["file"])


def rewrite_frontmatter(state):
    """Regenerate only the frontmatter block. Entries below are never touched."""
    path = log_path(state)
    if not os.path.exists(path):
        return
    with io.open(path, "r", encoding="utf-8") as fh:
        body = fh.read()
    if FM_RE.match(body):
        body = FM_RE.sub(frontmatter(state), body, count=1)
    else:
        body = frontmatter(state) + body
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(body)


def append_entry(state, kind, num, model, text):
    path = log_path(state)
    fresh = not os.path.exists(path)
    with io.open(path, "a", encoding="utf-8") as fh:
        if fresh:
            fh.write(frontmatter(state))
            fh.write(header(state))
        fh.write(
            "\n[LOG_ENTRY type=%s num=%d session=%s]\ntimestamp: %s\nmodel: %s\n\n%s\n\n"
            % (kind, num, state["session_id"][:8], iso(utc_now()), model, text)
        )


PENDING = "(pending)"


def backfill_prompt_model(state, num, model):
    """
    The very first prompt of a session is logged before any assistant record
    exists, so its model is unknown at write time. Once the turn ends we know it.
    This substitutes that one placeholder and nothing else.
    """
    path = log_path(state)
    if not os.path.exists(path):
        return
    with io.open(path, "r", encoding="utf-8") as fh:
        body = fh.read()
    marker = "[LOG_ENTRY type=PROMPT num=%d session=%s]" % (num, state["session_id"][:8])
    pos = body.find(marker)
    if pos == -1:
        return
    target = "\nmodel: %s\n" % PENDING
    at = body.find(target, pos)
    if at == -1 or at > pos + 400:
        return
    body = body[:at] + ("\nmodel: %s\n" % model) + body[at + len(target):]
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(body)


# --------------------------------------------------------------------------- #
# state
# --------------------------------------------------------------------------- #

def state_path(session_id):
    return os.path.join(STATE_DIR, "%s.json" % session_id)


def load_state(session_id, now):
    st = read_json_file(state_path(session_id))
    if st:
        return st
    return {
        "session_id": session_id,
        "date": now.strftime("%Y-%m-%d"),
        "file": "%s_%s.md" % (now.strftime("%Y-%m-%d_%H-%M-%S"), session_id),
        "n": 0,
        "first_prompt_time": "",
        "last_prompt_time": "",
        "model": None,
        "last_logged_uuid": None,
        "awaiting_response": False,
    }


# --------------------------------------------------------------------------- #
# events
# --------------------------------------------------------------------------- #

def handle_prompt(payload):
    now = utc_now()
    session_id = payload.get("session_id") or "unknown-session"
    st = load_state(session_id, now)

    prompt = payload.get("prompt")
    if prompt is None:
        # Fall back to the transcript if the payload shape ever changes.
        records = load_transcript(payload.get("transcript_path"))
        for rec in reversed(records):
            if is_real_user_prompt(rec):
                prompt = text_of(rec)
                break
    if prompt is None:
        note("no prompt text found in payload or transcript")
        return

    model = current_turn_model(load_transcript(payload.get("transcript_path"))) or PENDING

    st["n"] += 1
    stamp = iso(now)
    if not st["first_prompt_time"]:
        st["first_prompt_time"] = stamp
    st["last_prompt_time"] = stamp
    if model != PENDING:
        st["model"] = model
    st["awaiting_response"] = True

    append_entry(st, "PROMPT", st["n"], model, prompt)
    rewrite_frontmatter(st)
    write_json_file(state_path(session_id), st)


def handle_response(payload):
    session_id = payload.get("session_id") or "unknown-session"
    st = read_json_file(state_path(session_id))
    if not st:
        note("Stop fired with no state for session %s (no prompt logged yet)" % session_id)
        return
    if not st.get("awaiting_response"):
        return  # already logged this turn; Stop can fire more than once

    records = load_transcript(payload.get("transcript_path"))
    parsed, last_uuid = final_response(records)
    if last_uuid and last_uuid == st.get("last_logged_uuid"):
        return

    # The Stop payload carries the turn's final assistant message directly, and
    # it is authoritative. The transcript JSONL is flushed asynchronously, so
    # reading it here races the writer: on turn 1 of session 9dc090cc the hook
    # read the file 53ms after the message was generated and got nothing back,
    # logging an empty response for a 3917-character answer. Prefer the payload
    # and fall back to transcript parsing only when the field is absent.
    from_payload = (payload.get("last_assistant_message") or "").strip()
    text = from_payload or parsed
    st["last_source"] = "payload" if from_payload else ("transcript" if parsed else "none")

    model = current_turn_model(records) or st.get("model") or "unknown"
    if not text:
        text = "(no final text response captured for this turn)"

    backfill_prompt_model(st, st["n"], model)
    st["model"] = model
    st["last_logged_uuid"] = last_uuid
    st["awaiting_response"] = False

    append_entry(st, "RESPONSE", st["n"], model, text)
    rewrite_frontmatter(st)
    write_json_file(state_path(session_id), st)


def main():
    raw = sys.stdin.read()
    if os.path.exists(DEBUG_FLAG):
        try:
            name = "raw-%s-%s.json" % (EVENT, utc_now().strftime("%H%M%S%f"))
            with io.open(os.path.join(STATE_DIR, name), "w", encoding="utf-8") as fh:
                fh.write(raw)
        except Exception:
            pass
    payload = {}
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except Exception as exc:
        note("stdin was not JSON: %r" % (exc,))

    if EVENT == "prompt":
        handle_prompt(payload)
    else:
        handle_response(payload)


if __name__ == "__main__":
    try:
        os.makedirs(LOGS, exist_ok=True)
        os.makedirs(STATE_DIR, exist_ok=True)
        main()
    except Exception as exc:
        note("unhandled: %r" % (exc,))
    sys.exit(0)
