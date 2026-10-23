import { test } from "node:test";
import assert from "node:assert/strict";
import { actorLabel, changeSummary, docToRow, normAudit, planUpdate, rowToDoc, splitPath } from "../src/lib/rows.ts";
import { normDecision, normName, normStep } from "../src/lib/model.ts";

test("rows: a database row reads as the doc the normalizers expect", () => {
  const { id, data } = rowToDoc({ id: "s110", sort_order: 10, phase: 1, title: "T", owner: "both", status: "done", updated_at: "2026-10-22T23:55:00Z", step_id: "x" });
  assert.equal(id, "s110");
  assert.equal(data.order, 10);
  assert.equal(data.updatedAt, "2026-10-22T23:55:00Z");
  assert.equal(data.stepId, "x");
  assert.equal(normStep(id, data)!.order, 10);
});

test("rows: page fields become columns, server-owned ones are dropped", () => {
  assert.deepEqual(docToRow({ status: "done", updatedAt: "x", updatedBy: "y", createdBy: "z", id: "no" }), { status: "done" });
  assert.deepEqual(docToRow({ order: 3, stepId: "s1", authorId: "m", createdAt: "t", inCompany: "Yes" }), {
    sort_order: 3,
    step_id: "s1",
    author_id: "m",
    created_at: "t",
    in_company: "Yes",
  });
});

test("rows: agreeing and voting go through the per-person functions", () => {
  assert.deepEqual(planUpdate("decisions/d8", { agree: { me1: "2026-10-23T00:00:00Z" } }, "me1"), [{ kind: "rpc", fn: "set_agree", args: { p_decision: "d8", p_on: true } }]);
  assert.deepEqual(planUpdate("decisions/d8", { agree: { me1: null } }, "me1"), [{ kind: "rpc", fn: "set_agree", args: { p_decision: "d8", p_on: false } }]);
  assert.deepEqual(planUpdate("names/n1", { votes: { me1: true } }, "me1"), [{ kind: "rpc", fn: "set_vote", args: { p_name: "n1", p_on: true } }]);
  assert.deepEqual(planUpdate("names/n1", { votes: { me1: false } }, "me1"), [{ kind: "rpc", fn: "set_vote", args: { p_name: "n1", p_on: false } }]);
  // Someone else's key is never written.
  assert.deepEqual(planUpdate("names/n1", { votes: { other: true } }, "me1"), []);
  assert.deepEqual(planUpdate("steps/s1", { status: "done", updatedAt: "x", updatedBy: "me1" }, "me1"), [{ kind: "update", table: "steps", id: "s1", row: { status: "done" } }]);
  assert.deepEqual(splitPath("products/our-table"), ["products", "our-table"]);
});

test("rows: migrated agreements and votes keep their meaning", () => {
  // A seeded decision (agree null) is settled; an open one ({}) is not.
  assert.equal(normDecision("d1", { title: "x", agree: null })!.agree, null);
  assert.deepEqual(normDecision("d8", { title: "x", agree: {} })!.agree, {});
  assert.deepEqual(normName("n", { name: "N", votes: { a: true, b: false } })!.voters, ["a"]);
});

test("changes: audit rows read as plain sentences", () => {
  const e = normAudit({ id: 5, at: "2026-10-23T00:00:00Z", table_name: "steps", row_id: "s1", op: "update", who: "chris", via: "app", changes: { status: { from: "todo", to: "done" } } })!;
  assert.equal(changeSummary(e), "status → done");
  assert.equal(actorLabel(e, (r) => (r === "chris" ? "Chris" : r)), "Chris");
  const agent = normAudit({ id: 6, at: "", table_name: "steps", row_id: "s1", op: "update", who: null, via: "claude-code:aaron", changes: {} })!;
  assert.equal(actorLabel(agent, (r) => r), "claude-code:aaron");
  const vote = normAudit({ id: 7, at: "", table_name: "names", row_id: "n", op: "update", who: "aaron", via: "app", changes: { votes: { from: {}, to: { m: true } } } })!;
  assert.equal(changeSummary(vote), "voted");
  assert.equal(actorLabel(normAudit({ id: 8, at: "", table_name: "x", op: "insert", via: "service_role" })!, (r) => r), "An agent (service role)");
  assert.equal(normAudit({ table_name: "x", op: "truncate" }), null);
});
