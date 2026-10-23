import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normStep, normDecision, normName, normProduct, normMeta, normStatus, parseCost, costSummary, currentPhase,
  upNext, isSettled, rankNames, dueInfo, roleOf, moneyRange, phaseStats, splitPlatforms, safeUrl, type Step,
} from "../src/lib/model.ts";

const step = (id: string, f: Record<string, unknown>) => normStep(id, { title: id, phase: 1, order: 10, owner: "both", status: "todo", ...f }) as Step;

test("steps: old docs and junk normalize safely", () => {
  assert.equal(normStep("x", null), null);
  assert.equal(normStep("x", { title: "" }), null);
  const s = normStep("s", { title: "T", phase: "3", status: "weird", owner: "butters", due: "soon" })!;
  assert.equal(s.phase, 3);
  assert.equal(s.status, "todo");
  assert.equal(s.owner, "");
  assert.equal(s.due, "");
  assert.equal(normStep("s", { title: "T", phase: 9 })!.phase, 6);
});

test("costs: the live cost notes parse into ranges", () => {
  assert.deepEqual(parseCost("~$150-300"), { lo: 150, hi: 300 });
  assert.deepEqual(parseCost("LA $100 / NM $50"), { lo: 50, hi: 100 });
  assert.deepEqual(parseCost("$0-125/yr"), { lo: 0, hi: 125 });
  assert.deepEqual(parseCost("free"), { lo: 0, hi: 0 });
  assert.deepEqual(parseCost("~$12/yr+"), { lo: 12, hi: 12 });
  assert.deepEqual(parseCost("$100 per game"), { lo: 100, hi: 100 });
  assert.deepEqual(parseCost("$1,200"), { lo: 1200, hi: 1200 });
  assert.equal(parseCost("some"), null);
  assert.equal(parseCost(""), null);
});

test("costs: only open steps count, and unpriced notes are counted apart", () => {
  const steps = [step("a", { cost: "$100" }), step("b", { cost: "$50-80", status: "done" }), step("c", { cost: "ask a CPA" }), step("d", { cost: "free" }), step("e", {})];
  const c = costSummary(steps);
  assert.equal(c.lo, 100);
  assert.equal(c.hi, 100);
  assert.equal(c.lines.length, 2);
  assert.equal(c.unpriced, 1);
  assert.equal(moneyRange(411, 870), "$411–870");
  assert.equal(moneyRange(0, 0), "$0");
});

test("phase: the first phase with open work", () => {
  assert.equal(currentPhase([]), 0);
  assert.equal(currentPhase([step("a", { phase: 1, status: "done" }), step("b", { phase: 2 }), step("c", { phase: 4 })]), 2);
  assert.equal(currentPhase([step("a", { status: "done" })]), 7);
  const ps = phaseStats([step("a", { phase: 2, status: "blocked" }), step("b", { phase: 2, status: "done" })]);
  assert.equal(ps[1].total, 2);
  assert.equal(ps[1].blocked, 1);
  assert.equal(ps[1].done, 1);
});

test("up next: own and shared steps, doing first, then due date", () => {
  const steps = [
    step("late", { owner: "chris", phase: 5, due: "2026-11-01" }),
    step("doing", { owner: "both", phase: 6, status: "doing" }),
    step("aaron", { owner: "aaron", phase: 1 }),
    step("early", { owner: "chris", phase: 1 }),
    step("done", { owner: "chris", status: "done" }),
  ];
  assert.deepEqual(upNext(steps, "chris").map((s) => s.id), ["doing", "late", "early"]);
  assert.deepEqual(upNext(steps, "aaron").map((s) => s.id), ["doing", "aaron"]);
});

test("decisions: settled only when both agreed; older docs are settled", () => {
  const team = { chris: "u_c", aaron: "u_a" };
  assert.equal(isSettled(normDecision("d1", { title: "Old", date: "2026-10-22" })!, team), true);
  assert.equal(isSettled(normDecision("d2", { title: "New", agree: { u_c: "2026-10-22" } })!, team), false);
  assert.equal(isSettled(normDecision("d3", { title: "New", agree: { u_c: "x", u_a: null } })!, team), false);
  assert.equal(isSettled(normDecision("d4", { title: "New", agree: { u_c: "x", u_a: "y" } })!, team), true);
  // Until both cofounders are on file, a new decision stays open, whoever agreed.
  assert.equal(isSettled(normDecision("d5", { title: "New", agree: { u_c: "x", u_z: "y" } })!, { chris: "u_c", aaron: "" }), false);
  assert.equal(isSettled(normDecision("d6", { title: "New", agree: { u_c: "x", u_z: "y" } })!, team), false);
});

test("names: ranked by votes, then the order Chris set", () => {
  const names = [normName("a", { name: "A", order: 2, votes: {} })!, normName("b", { name: "B", order: 1, votes: { u1: true, u2: false } })!, normName("c", { name: "C", order: 0, votes: {} })!];
  const r = rankNames(names);
  assert.deepEqual(r.list.map((n) => n.id), ["b", "c", "a"]);
  assert.equal(r.top, 1);
  assert.deepEqual(names[1].voters, ["u1"]);
});

test("due dates, roles, products and links", () => {
  assert.deepEqual(dueInfo("2026-10-20", "2026-10-22"), { label: "Overdue 2d", tone: "late" });
  assert.equal(dueInfo("2026-10-25", "2026-10-22")!.tone, "soon");
  assert.equal(dueInfo("2026-12-25", "2026-10-22")!.label, "Dec 25");
  assert.equal(dueInfo("", "2026-10-22"), null);
  assert.equal(roleOf("u_c", { chris: "u_c", aaron: "" }, false), "chris");
  assert.equal(roleOf("u_x", { chris: "u_c", aaron: "" }, false), "aaron");
  assert.equal(roleOf(null, { chris: "", aaron: "" }, true), "chris");
  assert.equal(roleOf(null, { chris: "", aaron: "" }, null), null);
  assert.equal(roleOf("u_z", { chris: "u_c", aaron: "u_a" }, false), null);
  assert.deepEqual(splitPlatforms("PC · Steam"), ["PC", "Steam"]);
  assert.deepEqual(normProduct("p", { name: "P", platforms: ["iOS", ""], repo: "javascript:alert(1)" })!.platforms, ["iOS"]);
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.deepEqual(normMeta({ links: [{ label: "GitHub org: not set up yet" }, { label: "x", url: "https://a.b" }, { url: "https://c" }] }).links.length, 2);
  assert.equal(normStatus({ summary: "  " }), null);
});
