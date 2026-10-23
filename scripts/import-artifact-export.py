#!/usr/bin/env python3
"""Turn an export of the old claude.ai Studio HQ (one JSON file per doc: <dir>/<collection>/<id>.json)
into one SQL script that loads it into Supabase. Run the output as postgres (dashboard SQL editor or the
Supabase MCP); every row is written with actor 'migration' so the audit log shows where it came from.

claude.ai user ids are remapped to members.id: team/chris.json and team/aaron.json say which id is whom.
Usage: import-artifact-export.py EXPORT_DIR [LEDGER_CSV] > import.sql   (members must already exist)
"""
import csv, json, os, sys, glob

src = sys.argv[1]
ledger = sys.argv[2] if len(sys.argv) > 2 else None

def docs(col):
    out = []
    for f in sorted(glob.glob(os.path.join(src, col, "*.json"))):
        d = json.load(open(f))
        out.append((os.path.basename(f)[:-5], {k: v for k, v in d.items() if not k.startswith("__")}))
    return out

def q(v):
    if v is None or v == "":
        return "null"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"

def j(v):
    return q(json.dumps(v, ensure_ascii=False)) + "::jsonb"

team = {r: d.get("id") for r, d in docs("team")}
for r in ("chris", "aaron"):
    if not team.get(r):
        sys.exit(f"team/{r}.json has no id")
mid = lambda role: f"(select id from public.members where role = '{role}')"
ROLE = {team["chris"]: "chris", team["aaron"]: "aaron"}

def member_sql(claude_id):
    if not claude_id:
        return "null"
    if claude_id not in ROLE:
        sys.exit(f"unknown user id {claude_id}")
    return mid(ROLE[claude_id])

def remap_keys(obj, value):
    """{claude_id: v} -> SQL building {member_uuid: v}."""
    parts = []
    for k, v in obj.items():
        if k not in ROLE:
            sys.exit(f"unknown user id {k}")
        if v in (None, False, ""):
            continue  # unset stays unset
        parts.append(f"{mid(ROLE[k])}::text, {j(value(v))}")
    return "jsonb_build_object(" + ", ".join(parts) + ")" if parts else "'{}'::jsonb"

out = ["begin;", "set local statement_timeout = '60s';"]
out.append(f"update public.members set claude_id = {q(team['chris'])} where role = 'chris';")
out.append(f"update public.members set claude_id = {q(team['aaron'])} where role = 'aaron';")

for i, d in docs("steps"):
    out.append(
        "insert into public.steps (id, phase, sort_order, title, owner, status, cost, note, detail, due, updated_at, actor) values ("
        + ", ".join([q(i), q(d.get("phase", 1)), q(d.get("order", 999)), q(d["title"]), q(d.get("owner")), q(d.get("status", "todo")),
                     q(d.get("cost")), q(d.get("note")), q(d.get("detail")), q(d.get("due")), q(d.get("updatedAt")) + "::timestamptz" if d.get("updatedAt") else "now()", "'migration'"])
        + ");")
for i, d in docs("decisions"):
    agree = "null" if "agree" not in d or d["agree"] is None else remap_keys(d["agree"], lambda v: v if isinstance(v, str) else "yes")
    out.append(
        "insert into public.decisions (id, date, title, detail, agree, proposed_by, created_at, actor) values ("
        + ", ".join([q(i), q(d.get("date")), q(d["title"]), q(d.get("detail")), agree, member_sql(d.get("proposedBy")),
                     (q(d["createdAt"]) + "::timestamptz") if d.get("createdAt") else (q(d["date"]) + "::timestamptz" if d.get("date") else "now()"), "'migration'"])
        + ");")
for i, d in docs("names"):
    out.append(
        "insert into public.names (id, name, note, sort_order, votes, suggested_by, actor) values ("
        + ", ".join([q(i), q(d["name"]), q(d.get("note")), q(d.get("order", 999)), remap_keys(d.get("votes") or {}, lambda v: True),
                     member_sql(d.get("suggestedBy")), "'migration'"])
        + ");")
for i, d in docs("products"):
    plat = d.get("platforms")
    plat = " · ".join(plat) if isinstance(plat, list) else plat
    out.append(
        "insert into public.products (id, sort_order, name, status, platforms, summary, next, in_company, repo, actor) values ("
        + ", ".join([q(i), q(d.get("order", 999)), q(d["name"]), q(d.get("status")), q(plat), q(d.get("summary")), q(d.get("next")),
                     q(d.get("inCompany")), q(d.get("repo")), "'migration'"])
        + ");")
for i, d in docs("messages"):
    out.append(
        "insert into public.messages (id, text, author_id, kind, created_at, actor) values ("
        + ", ".join([q(i), q(d["text"]), member_sql(d.get("authorId")), q(d.get("kind") or "msg"), q(d.get("createdAt")) + "::timestamptz", "'migration'"])
        + ");")
for i, d in docs("comments"):
    out.append(
        "insert into public.comments (id, step_id, text, author_id, created_at, actor) values ("
        + ", ".join([q(i), q(d["stepId"]), q(d["text"]), member_sql(d.get("authorId")), q(d.get("createdAt")) + "::timestamptz", "'migration'"])
        + ");")
for i, d in docs("meta"):
    out.append(f"insert into public.meta (id, data, actor) values ({q(i)}, {j(d)}, 'migration');")
if ledger:
    for r in csv.DictReader(open(ledger)):
        out.append(
            "insert into public.ledger (date, item, vendor, amount_usd, paid_by, approved_by, category, receipt_location, notes, actor) values ("
            + ", ".join([q(r["date"]), q(r["item"]), q(r["vendor"]), q(r["amount_usd"]), q(r["paid_by"]), q(r["approved_by"]), q(r["category"]),
                         q(r["receipt_location"]), q(r["notes"]), "'migration'"])
            + ");")
out.append("commit;")
out.append("select 'steps' t, count(*) from public.steps union all select 'decisions', count(*) from public.decisions union all "
           "select 'names', count(*) from public.names union all select 'products', count(*) from public.products union all "
           "select 'messages', count(*) from public.messages union all select 'comments', count(*) from public.comments union all "
           "select 'meta', count(*) from public.meta union all select 'members', count(*) from public.members union all "
           "select 'ledger', count(*) from public.ledger union all select 'audit_log', count(*) from public.audit_log;")
print("\n".join(out))
