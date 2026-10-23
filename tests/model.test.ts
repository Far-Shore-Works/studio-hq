import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normStep, normDecision, normName, normProduct, normMeta, normStatus, parseCost, costSummary, currentPhase,
  upNext, isSettled, rankNames, dueInfo, roleOf, moneyRange, phaseStats, splitPlatforms, safeUrl, type Step,
  normDoc, searchDocs, plainText, normHours, hoursStats, weekStartOf, addDays, weekLabel, fmtHours, normLedger, moneyIn, dollars, type Doc,
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

// ---- Docs ----------------------------------------------------------------------------------------
const doc = (slug: string, f: Record<string, unknown> = {}) =>
  normDoc(slug, { title: slug.toUpperCase(), slug, folder: "Plan", bodyMd: "", visibility: "shared", owner: "m1", ...f }) as Doc;

test("docs: a row normalizes, junk does not render, unknown visibility is private", () => {
  assert.equal(normDoc("x", null), null);
  assert.equal(normDoc("x", { title: "T", slug: "t", folder: "Elsewhere" }), null);
  assert.equal(normDoc("x", { title: "", slug: "t", folder: "Plan" }), null);
  const d = normDoc("x", { title: " T ", slug: "t", folder: "Money", bodyMd: "# T\nhi", visibility: "weird", owner: "m1", sourcePath: "a/B.md", updatedAt: "2026-10-23T00:00:00Z" })!;
  assert.equal(d.title, "T");
  assert.equal(d.visibility, "private");
  assert.equal(d.body, "# T\nhi");
  assert.equal(normDoc("x", { title: "T", slug: "t", folder: "Money", visibility: "shared" })!.visibility, "shared");
});

test("docs: plain text drops markdown syntax", () => {
  assert.equal(plainText("# Title\n\n- one **bold** [link](http://x.y)\n\n| a | b |"), "Title one bold link a b");
});

test("docs: search needs every word, ranks titles first, and shows a snippet from the body", () => {
  const docs = [
    doc("terms", { title: "Founder terms", folder: "Decisions", bodyMd: "Ownership is 50/50 with four-year vesting." }),
    doc("plan", { title: "Plan", bodyMd: "Founder terms are discussed in week two. Ship the Retirement Plan first." }),
    doc("ledger", { title: "Ledger", folder: "Money", bodyMd: "Nothing here." }),
  ];
  assert.deepEqual(searchDocs(docs, "").map((h) => h.doc.slug), ["plan", "ledger", "terms"]); // folder order: Plan, Money, Decisions
  const r = searchDocs(docs, "founder terms");
  assert.deepEqual(r.map((h) => h.doc.slug), ["terms", "plan"]);
  assert.match(r[1].snippet, /Founder terms are discussed/);
  assert.equal(r[0].snippet, ""); // the title matched, so no snippet needed
  assert.deepEqual(searchDocs(docs, "vesting").map((h) => h.doc.slug), ["terms"]);
  assert.deepEqual(searchDocs(docs, "vesting retirement"), []);
  assert.deepEqual(searchDocs(docs, "", "Money").map((h) => h.doc.slug), ["ledger"]);
  assert.deepEqual(searchDocs(docs, "plan", "Decisions"), []);
});

// ---- Hours ---------------------------------------------------------------------------------------
test("hours: weeks start on Monday", () => {
  assert.equal(weekStartOf("2026-10-23"), "2026-10-19"); // a Friday
  assert.equal(weekStartOf("2026-10-19"), "2026-10-19");
  assert.equal(weekStartOf("2026-10-25"), "2026-10-19"); // Sunday belongs to the week before Monday
  assert.equal(weekStartOf("2026-11-01"), "2026-10-26");
  assert.equal(addDays("2026-10-26", 7), "2026-11-02");
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
  assert.equal(weekLabel("2026-10-19"), "Oct 19 – 25");
  assert.equal(weekLabel("2026-10-26"), "Oct 26 – Nov 1");
  assert.equal(fmtHours(12.5), "12.5");
  assert.equal(fmtHours(12), "12");
  assert.equal(fmtHours(12.04), "12");
});

test("hours: rows normalize and junk is dropped", () => {
  assert.equal(normHours("h", { weekStart: "2026-10-19", hours: "12.50", memberId: "m1" })!.hours, 12.5);
  assert.equal(normHours("h", { weekStart: "soon", hours: 3 }), null);
  assert.equal(normHours("h", { weekStart: "2026-10-19", hours: -1 }), null);
  assert.equal(normHours("h", null), null);
});

test("hours: 4-week average starts at the first logged week, and a gap counts as zero", () => {
  const row = (m: string, w: string, h: number) => normHours(m + w, { memberId: m, weekStart: w, hours: h })!;
  const today = "2026-10-23"; // week of Oct 19
  assert.deepEqual(hoursStats([], "a", today), { total: 0, logged: 0, avg4: 0, weeksCounted: 0 });
  // Started this week: the average is over this one week, not diluted by the weeks before.
  assert.deepEqual(hoursStats([row("a", "2026-10-19", 10)], "a", today), { total: 10, logged: 1, avg4: 10, weeksCounted: 1 });
  // First log was Oct 12: two weeks counted (Oct 12 and Oct 19).
  assert.deepEqual(hoursStats([row("a", "2026-10-12", 6), row("a", "2026-10-19", 9)], "a", today), { total: 15, logged: 2, avg4: 7.5, weeksCounted: 2 });
  // An older log: the window is the last four weeks (Sep 28, Oct 5, Oct 12, Oct 19). Sep 21 is outside it, and
  // the weeks with no entry (Sep 28, Oct 12) count as 0: (0 + 12 + 0 + 8) / 4 = 5. Another founder's hours never mix in.
  const rows = [row("a", "2026-09-21", 99), row("a", "2026-10-05", 12), row("a", "2026-10-19", 8), row("b", "2026-10-19", 40)];
  assert.deepEqual(hoursStats(rows, "a", today), { total: 119, logged: 3, avg4: 5, weeksCounted: 4 });
});

// ---- Money in ------------------------------------------------------------------------------------
test("money: totals by paid_by, the $500 gift threshold, and what is repaid", () => {
  const led = (id: string, paidBy: string, amt: number, approvedBy = "Chris") => normLedger(id, { date: "2026-10-22", item: id, amountUsd: amt, paidBy, approvedBy })!;
  const names = { chris: ["chris", "christopher"], aaron: ["aaron"] };
  const m = moneyIn([led("domain", "Chris", 11.25), led("a", "Aaron", 40, "Chris"), led("b", "aaron", 20, ""), led("c", "Studio", 5)], names);
  assert.equal(m.chris.paid, 11.25);
  assert.equal(m.chris.gift, 11.25);
  assert.equal(m.chris.owedBack, 0);
  assert.equal(m.aaron.paid, 60);
  assert.equal(m.aaron.approved, 40);
  assert.equal(m.aaron.unapproved, 20);
  assert.equal(m.aaron.owedBack, 40); // Aaron is repaid from his first approved dollar
  assert.deepEqual(m.other, { amount: 5, purchases: 1 });
  assert.equal(m.giftProgress, 11.25 / 500);
  // Past the threshold: the first $500 is a gift, the rest is repaid.
  const big = moneyIn([led("x", "Chris", 450), led("y", "Chris", 120.5)], names);
  assert.equal(big.chris.gift, 500);
  assert.equal(big.chris.owedBack, 70.5);
  assert.equal(big.giftProgress, 1);
  // Unapproved purchases never count toward the gift.
  assert.equal(moneyIn([led("z", "Chris", 600, "")], names).chris.gift, 0);
  assert.equal(normLedger("n", { amountUsd: "oops" }), null);
  assert.equal(dollars(11.25), "$11.25");
  assert.equal(dollars(500), "$500");
  assert.equal(dollars(1234.5), "$1,234.50");
});
