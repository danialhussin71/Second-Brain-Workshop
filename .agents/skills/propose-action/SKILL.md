---
name: propose-action
description: Register a proposed WRITE / side-effect (send, post, create, update, delete, schedule) for the user to approve before it runs. Use in the operator dashboard for anything that changes the outside world. Never execute a write without this + an approval.
---

# propose-action

The human-in-the-loop gate. When a task requires a write or side-effect, do NOT do it. Compose a proposal, register it with this skill, then STOP and wait for the user to approve in their next message.

## Steps

1. **Compose the proposal** as JSON (schema below). Be specific: the exact thing that will happen, on which app, and the key details the user should see before saying yes.
2. **Write it to a temp file** with the Write tool, e.g. `/tmp/proposal.json`.
3. **Register it:**
   ```bash
   bash .Codex/skills/propose-action/run.sh /tmp/proposal.json
   ```
   It prints a `<<JARVIS_PROPOSAL …>>` line the dashboard turns into an approval card. Do NOT print that line or the JSON.
4. **STOP.** End your turn with one short sentence telling the user what you're asking them to approve. Do not perform the write.
5. When the user approves in their next message, perform the write with the right connector tool, then confirm what happened.

## Proposal schema

```json
{
  "app": "which app / connector (e.g. Gmail, Slack, Notion)",
  "action": "the concrete action (e.g. Send email)",
  "title": "short title for the card",
  "summary": "one or two sentences: exactly what will happen",
  "details": [ { "label": "To", "value": "…" }, { "label": "Subject", "value": "…" } ],
  "risk": "low | medium | high"
}
```
