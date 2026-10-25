import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

// Runs against a local Supabase (`supabase start`). Checks the database rules directly,
// independent of the app's code.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const client = () => createClient<Database>(url, key, { auth: { persistSession: false } });

describe("projects Row Level Security", () => {
  let alice: SupabaseClient<Database>;
  let bob: SupabaseClient<Database>;
  let aliceProjectId: string;

  beforeAll(async () => {
    alice = client();
    bob = client();
    expect((await alice.auth.signInAnonymously()).error).toBeNull();
    expect((await bob.auth.signInAnonymously()).error).toBeNull();
    const { data, error } = await alice
      .from("projects")
      .insert({ title: "Alice's idea", idea: "Something only Alice should see" })
      .select("id")
      .single();
    expect(error).toBeNull();
    aliceProjectId = data!.id;
  });

  it("lets the owner read their project", async () => {
    const { data } = await alice.from("projects").select("id").eq("id", aliceProjectId);
    expect(data).toHaveLength(1);
  });

  it("hides it from another signed-in person", async () => {
    const { data } = await bob.from("projects").select("id").eq("id", aliceProjectId);
    expect(data).toEqual([]);
  });

  it("stops another person changing or deleting it", async () => {
    await bob.from("projects").update({ idea: "hijacked" }).eq("id", aliceProjectId);
    await bob.from("projects").delete().eq("id", aliceProjectId);
    const { data } = await alice.from("projects").select("idea").eq("id", aliceProjectId).single();
    expect(data?.idea).toBe("Something only Alice should see");
  });

  it("gives signed-out visitors no access at all", async () => {
    const { data, error } = await client().from("projects").select("id");
    expect(data ?? []).toEqual([]);
    expect(error?.code ?? "42501").toBe("42501");
  });

  it("does not let anyone set the owner or organisation themselves", async () => {
    const { data: me } = await bob.auth.getUser();
    const { error } = await bob
      .from("projects")
      // Column grants allow only title and idea, so naming owner_id is refused.
      .insert({ title: "Sneaky", idea: "Pretending to be Alice", owner_id: me.user!.id });
    expect(error?.code).toBe("42501");
  });
});
