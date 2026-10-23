#!/usr/bin/env python3
"""Build preview/seed.local.json (gitignored) for local screenshots in `vite --mode shots`.
Reads an export of the old Studio HQ (<dir>/<collection>/<id>.json), maps it to table rows the way the real
import does, and adds a few sample audit-log lines so the Changes view has something to show.
Usage: make-preview-seed.py EXPORT_DIR > preview/seed.local.json"""
import glob, json, os, sys
src = sys.argv[1]
def docs(col):
    for f in sorted(glob.glob(os.path.join(src, col, "*.json"))):
        yield os.path.basename(f)[:-5], {k: v for k, v in json.load(open(f)).items() if not k.startswith("__")}
team = {r: d["id"] for r, d in docs("team")}
M = {"chris": "11111111-1111-4111-8111-111111111111", "aaron": "22222222-2222-4222-8222-222222222222"}
mid = {team["chris"]: M["chris"], team["aaron"]: M["aaron"]}
rk = lambda o: {mid.get(k, k): v for k, v in (o or {}).items() if v}
out = {"members": [{"id": M["chris"], "role": "chris", "name": "Chris Zareck", "email": "chris@example.com"},
                   {"id": M["aaron"], "role": "aaron", "name": "Aaron", "email": "aaron@example.com"}]}
out["steps"] = [{"id": i, "phase": d.get("phase"), "sort_order": d.get("order"), "title": d["title"], "owner": d.get("owner"), "status": d.get("status"),
                 "cost": d.get("cost"), "note": d.get("note"), "detail": d.get("detail"), "due": d.get("due"), "updated_at": d.get("updatedAt")} for i, d in docs("steps")]
out["decisions"] = [{"id": i, "date": d.get("date"), "title": d["title"], "detail": d.get("detail"), "agree": None if d.get("agree") is None else rk(d["agree"]),
                     "proposed_by": mid.get(d.get("proposedBy")), "created_at": d.get("createdAt") or d.get("date")} for i, d in docs("decisions")]
out["names"] = [{"id": i, "name": d["name"], "note": d.get("note"), "sort_order": d.get("order"), "votes": rk(d.get("votes"))} for i, d in docs("names")]
out["products"] = [{"id": i, "sort_order": d.get("order"), "name": d["name"], "status": d.get("status"), "platforms": d.get("platforms"), "summary": d.get("summary"),
                    "next": d.get("next"), "in_company": d.get("inCompany"), "repo": d.get("repo")} for i, d in docs("products")]
out["messages"] = [{"id": i, "text": d["text"], "author_id": mid.get(d.get("authorId")), "kind": "msg", "created_at": d.get("createdAt")} for i, d in docs("messages")]
out["comments"] = []
out["meta"] = [{"id": i, "data": d} for i, d in docs("meta")]
s = out["steps"]
out["audit_log"] = [
    {"id": 3, "at": "2026-10-23T01:40:00Z", "table_name": "steps", "row_id": s[1]["id"], "op": "update", "who": "chris", "via": "app", "changes": {"status": {"from": "todo", "to": "doing"}}},
    {"id": 2, "at": "2026-10-23T01:20:00Z", "table_name": "steps", "row_id": s[2]["id"], "op": "update", "who": None, "via": "claude-code:aaron", "changes": {"note": {"from": None, "to": "Checked the contract clause; summary in the thread."}}},
    {"id": 1, "at": "2026-10-23T00:55:00Z", "table_name": "messages", "row_id": "m", "op": "insert", "who": "aaron", "via": "app", "changes": {"text": "Signed in on the new page."}},
]
# Sample money, hours and docs for the Founders panel and the Docs tab (made-up numbers and text).
out["ledger"] = [{"id": 1, "date": "2026-10-22", "item": "farshoreworks.com domain (1 yr)", "vendor": "Vercel", "amount_usd": 11.25, "paid_by": "Chris", "approved_by": "Chris", "category": "domain"}]
out["hours"] = [
    {"id": "h1", "member_id": M["chris"], "week_start": "2026-10-12", "hours": 14, "note": ""},
    {"id": "h2", "member_id": M["aaron"], "week_start": "2026-10-12", "hours": 8.5, "note": "Prototype"},
    {"id": "h3", "member_id": M["chris"], "week_start": "2026-10-19", "hours": 18.5, "note": "Studio setup"},
]
out["docs"] = [
    {"id": "d-terms", "folder": "Decisions", "title": "Founder terms", "slug": "founder-terms", "visibility": "shared", "owner": M["chris"], "source_path": "studio/FOUNDER-TERMS.md",
     "updated_at": "2026-10-22T21:11:00Z", "body_md": "# Founder terms\n\nA sample shared doc.\n\n| Item | Rule |\n| --- | --- |\n| Ownership | 50/50 |\n| Vesting | 4 years, 1-year cliff |\n\nSee [the handbook](HANDBOOK.md).\n"},
    {"id": "d-handbook", "folder": "Admin", "title": "Handbook", "slug": "handbook", "visibility": "shared", "owner": M["chris"], "source_path": "studio/HANDBOOK.md",
     "updated_at": "2026-10-22T17:54:00Z", "body_md": "# Handbook\n\n- Be kind.\n- Log purchases the same day.\n"},
    {"id": "d-plan", "folder": "Plan", "title": "Business plan", "slug": "business-plan", "visibility": "private", "owner": M["chris"], "source_path": "business/PLAN.md",
     "updated_at": "2026-10-23T01:17:00Z", "body_md": "# Business plan\n\nA sample private doc, visible only to its owner.\n"},
]
json.dump(out, sys.stdout, ensure_ascii=False)
