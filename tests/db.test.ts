import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Runs the real migrations in a local Postgres (PGlite, no network) on top of a small Supabase stand-in
// (tests/db/supabase-stub.sql), then the row-level security checks for Docs and the hours log
// (tests/rls-docs.sql, the same file you can paste into the Supabase SQL editor to check the live project).
// The checks report through the error text of one DO block: "RLS RESULT: n/n passed".

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("database: migrations apply, and Docs and Hours row-level security holds", async () => {
  const db = new PGlite();
  await db.exec(read("tests/db/supabase-stub.sql"));
  const files = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await db.exec(read("supabase/migrations/" + f));
  await db.exec(`insert into public.members (role, name, email) values ('chris', 'Chris Zareck', 'chris@example.com'), ('aaron', 'Aaron', 'aaron@example.com')`);
  let result = "";
  try {
    await db.exec(read("tests/rls-docs.sql"));
  } catch (e) {
    result = (e as Error).message;
  }
  const m = /RLS RESULT: (\d+)\/(\d+) passed/.exec(result);
  assert.ok(m, "the RLS script did not report a result: " + result);
  assert.equal(m![1], m![2], result);
  assert.ok(Number(m![2]) >= 40, "expected the full set of checks to run: " + result);
  await db.close();
});
