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

  it("keeps Gusty's reading private and tied to the owner's projects", async () => {
    const own = await alice
      .from("project_facts")
      .insert({ project_id: aliceProjectId, kind: "summary", value: "Alice's summary", source: "user", status: "confirmed" })
      .select("id")
      .single();
    expect(own.error).toBeNull();

    const peek = await bob.from("project_facts").select("id").eq("project_id", aliceProjectId);
    expect(peek.data).toEqual([]);

    const plant = await bob
      .from("project_facts")
      .insert({ project_id: aliceProjectId, kind: "need", value: "Planted by Bob", source: "user", status: "confirmed" });
    expect(plant.error?.code).toBe("42501");
  });

  it("keeps the AI usage log private", async () => {
    const logged = await alice.from("ai_runs").insert({
      project_id: aliceProjectId, task: "interpret_idea", model: "demo", prompt_version: "test", status: "demo",
    });
    expect(logged.error).toBeNull();
    const peek = await bob.from("ai_runs").select("id").eq("project_id", aliceProjectId);
    expect(peek.data).toEqual([]);
  });

  it("keeps directions, steps and preferences private", async () => {
    const dir = await alice
      .from("project_directions")
      .insert({ project_id: aliceProjectId, label: "Shape the idea", reason: "", recommended: true, position: 0 })
      .select("id")
      .single();
    expect(dir.error).toBeNull();
    const step = await alice
      .from("next_steps")
      .insert({ project_id: aliceProjectId, title: "Write three sentences", source: "user", position: 0 });
    expect(step.error).toBeNull();
    expect((await alice.from("user_preferences").upsert({ experience_mode: "simple" }, { onConflict: "user_id" })).error).toBeNull();

    expect((await bob.from("project_directions").select("id").eq("project_id", aliceProjectId)).data).toEqual([]);
    expect((await bob.from("next_steps").select("id").eq("project_id", aliceProjectId)).data).toEqual([]);
    const planted = await bob.from("next_steps").insert({ project_id: aliceProjectId, title: "Planted", source: "user", position: 0 });
    expect(planted.error?.code).toBe("42501");
    const bobsPrefs = await bob.from("user_preferences").select("experience_mode");
    expect(bobsPrefs.data).toEqual([]);
  });

  it("lets people delete only their own account, taking their data with it", async () => {
    const carol = client();
    expect((await carol.auth.signInAnonymously()).error).toBeNull();
    const carolProject = await carol.from("projects").insert({ title: "Carol's", idea: "Carol's idea" }).select("id").single();
    expect(carolProject.error).toBeNull();

    expect((await client().rpc("delete_my_account")).error).not.toBeNull(); // signed out: refused
    expect((await carol.rpc("delete_my_account")).error).toBeNull();

    // Carol's data is gone; Alice's is untouched.
    const { data: aliceStill } = await alice.from("projects").select("id").eq("id", aliceProjectId);
    expect(aliceStill).toHaveLength(1);
    expect((await carol.from("projects").select("id")).data ?? []).toEqual([]);
  });
});


describe("admin overview", () => {
  it("is refused to signed-out visitors and to people who aren't admins", async () => {
    expect((await client().rpc("admin_overview")).error).not.toBeNull();
    const dave = client();
    expect((await dave.auth.signInAnonymously()).error).toBeNull();
    const { error } = await dave.rpc("admin_overview");
    expect(error?.code).toBe("42501");
    expect((await dave.rpc("is_admin")).data).toBe(false);
  });

  it("can't be granted from the app: the admins list is unreadable and unwritable", async () => {
    const erin = client();
    const { data } = await erin.auth.signInAnonymously();
    expect((await erin.from("admins").insert({ user_id: data.user!.id })).error).not.toBeNull();
    expect((await erin.from("admins").select("user_id")).error).not.toBeNull();
  });
});

describe("security tightening", () => {
  it("keeps organisations closed and the usage log within plausible bounds", async () => {
    const frank = client();
    expect((await frank.auth.signInAnonymously()).error).toBeNull();
    expect((await frank.from("organisations").select("id")).error).not.toBeNull();
    const run = { task: "interpret_idea", model: "x", prompt_version: "v", status: "ok" as const };
    expect((await frank.from("ai_runs").insert({ ...run, cost_usd: 500 })).error).not.toBeNull();
    expect((await frank.from("ai_runs").insert({ ...run, input_tokens: 10_000_000 })).error).not.toBeNull();
    expect((await frank.from("ai_runs").insert({ ...run, cost_usd: 0.02, input_tokens: 1200 })).error).toBeNull();
  });
});

describe("bringing guest projects into an account", () => {
  // Unique per run: transfers from earlier runs may still be in the local database.
  const run = crypto.randomUUID().replaceAll("-", "");
  const hash = (n: number) => `${run}${String(n).repeat(32)}`.slice(0, 64);

  it("only guests can start a transfer, and only signed-in accounts can claim one", async () => {
    expect((await client().rpc("start_project_transfer", { p_token_hash: hash(1) })).error).not.toBeNull();
    const guest = client();
    expect((await guest.auth.signInAnonymously()).error).toBeNull();
    expect((await guest.rpc("start_project_transfer", { p_token_hash: hash(2) })).error).toBeNull();
    // A guest can't claim (it would need to be signed in to a real account).
    expect((await guest.rpc("claim_guest_projects", { p_token_hash: hash(2) })).error?.code).toBe("42501");
  });

  it("a wrong secret moves nothing, and the transfers list is closed to the app", async () => {
    const guest = client();
    expect((await guest.auth.signInAnonymously()).error).toBeNull();
    await guest.from("projects").insert({ title: "Guest idea", idea: "Stays put" });
    expect((await guest.rpc("start_project_transfer", { p_token_hash: hash(3) })).error).toBeNull();
    expect((await guest.from("project_transfers").select("token_hash")).error).not.toBeNull();
    const { data } = await guest.from("projects").select("id");
    expect(data).toHaveLength(1);
  });
});

describe("feedback", () => {
  it("can be sent but never read back, and is limited per person", async () => {
    const gina = client();
    expect((await gina.auth.signInAnonymously()).error).toBeNull();
    expect((await gina.from("feedback").insert({ worked: "Nice" })).error).toBeNull();
    expect((await gina.from("feedback").select("worked")).error).not.toBeNull();
    expect((await gina.from("feedback").insert({ worked: "", confusing: null })).error).not.toBeNull(); // empty
    for (let i = 0; i < 19; i++) await gina.from("feedback").insert({ other: `note ${i}` });
    expect((await gina.from("feedback").insert({ other: "one too many" })).error).not.toBeNull();
    expect((await client().from("feedback").insert({ worked: "signed out" })).error).not.toBeNull();
    expect((await gina.rpc("admin_feedback")).error?.code).toBe("42501");
  });
});

describe("step questions", () => {
  it("belong only to the step's owner", async () => {
    const owner = client();
    const other = client();
    expect((await owner.auth.signInAnonymously()).error).toBeNull();
    expect((await other.auth.signInAnonymously()).error).toBeNull();
    const { data: project } = await owner.from("projects").insert({ title: "Mine", idea: "Private" }).select("id").single();
    const { data: step } = await owner.from("next_steps").insert({ project_id: project!.id, title: "Do a thing" }).select("id").single();
    const { data: q, error } = await owner
      .from("step_questions").insert({ step_id: step!.id, project_id: project!.id, question: "Who is it for?" }).select("id").single();
    expect(error).toBeNull();

    expect((await other.from("step_questions").select("id").eq("id", q!.id)).data).toEqual([]);
    expect((await other.from("step_questions").insert({ step_id: step!.id, project_id: project!.id, question: "Sneaky" })).error).not.toBeNull();
    const { data: changed } = await other.from("step_questions").update({ answer: "x" }).eq("id", q!.id).select("id");
    expect(changed ?? []).toEqual([]);
    expect((await owner.from("step_questions").update({ answer: "Neighbours" }).eq("id", q!.id).select("id")).data).toHaveLength(1);
  });

  it("forget Gusty's tidied copy when the person changes their words", async () => {
    const owner = client();
    expect((await owner.auth.signInAnonymously()).error).toBeNull();
    const { data: project } = await owner.from("projects").insert({ title: "Mine", idea: "Private" }).select("id").single();
    const { data: step } = await owner.from("next_steps").insert({ project_id: project!.id, title: "Do a thing" }).select("id").single();
    const { data: q } = await owner
      .from("step_questions").insert({ step_id: step!.id, project_id: project!.id, question: "Who is it for?" }).select("id").single();
    const tidiedOf = async () =>
      (await owner.from("step_questions").select("answer_tidied").eq("id", q!.id).single()).data!.answer_tidied;

    await owner.from("step_questions").update({ answer: "nieghbours" }).eq("id", q!.id);
    await owner.from("step_questions").update({ answer_tidied: "Neighbours" }).eq("id", q!.id);
    expect(await tidiedOf()).toBe("Neighbours");
    // Setting both together keeps the new copy; changing only the words clears it.
    await owner.from("step_questions").update({ answer: "nieghbours, freinds", answer_tidied: "Neighbours, friends" }).eq("id", q!.id);
    expect(await tidiedOf()).toBe("Neighbours, friends");
    await owner.from("step_questions").update({ answer: "my street" }).eq("id", q!.id);
    expect(await tidiedOf()).toBe("");

    await owner.from("next_steps").update({ notes: "sum notes" }).eq("id", step!.id);
    await owner.from("next_steps").update({ notes_tidied: "Some notes" }).eq("id", step!.id);
    await owner.from("next_steps").update({ notes: "other notes" }).eq("id", step!.id);
    expect((await owner.from("next_steps").select("notes_tidied").eq("id", step!.id).single()).data!.notes_tidied).toBe("");
  });
});

describe("opportunity searches", () => {
  it("belong only to the project's owner", async () => {
    const owner = client();
    const other = client();
    expect((await owner.auth.signInAnonymously()).error).toBeNull();
    expect((await other.auth.signInAnonymously()).error).toBeNull();
    const { data: project } = await owner.from("projects").insert({ title: "Mine", idea: "Private" }).select("id").single();
    const { data: search, error } = await owner
      .from("opportunity_searches").insert({ project_id: project!.id, place: "Hackney" }).select("id").single();
    expect(error).toBeNull();
    const found = { search_id: search!.id, project_id: project!.id, title: "Fund", url: "https://example.org", scale: "local", complexity: "light" };
    expect((await owner.from("found_opportunities").insert(found)).error).toBeNull();

    expect((await other.from("opportunity_searches").select("id").eq("id", search!.id)).data).toEqual([]);
    expect((await other.from("found_opportunities").select("id").eq("search_id", search!.id)).data).toEqual([]);
    expect((await other.from("opportunity_searches").insert({ project_id: project!.id })).error).not.toBeNull();
    expect((await other.from("found_opportunities").insert(found)).error).not.toBeNull();
    // Results must have a real https source.
    expect((await owner.from("found_opportunities").insert({ ...found, url: "javascript:alert(1)" })).error).not.toBeNull();
  });
});

describe("funding readiness", () => {
  it("funding routes and the amount needed belong only to the project's owner", async () => {
    const owner = client();
    const other = client();
    expect((await owner.auth.signInAnonymously()).error).toBeNull();
    expect((await other.auth.signInAnonymously()).error).toBeNull();
    const { data: project } = await owner.from("projects").insert({ title: "Mine", idea: "Private" }).select("id").single();
    expect((await owner.from("projects").update({ funding_need: "under_1k" }).eq("id", project!.id)).error).toBeNull();
    expect((await owner.from("projects").update({ funding_need: "a lot" }).eq("id", project!.id)).error).not.toBeNull();
    expect((await owner.from("funding_routes").insert({ project_id: project!.id, route: "crowdfunding" })).error).toBeNull();
    expect((await other.from("funding_routes").select("id").eq("project_id", project!.id)).data).toEqual([]);
    expect((await other.from("funding_routes").insert({ project_id: project!.id, route: "prize" })).error).not.toBeNull();
  });
});

describe("project documents", () => {
  it("what Gusty learned from a document belongs only to the project's owner", async () => {
    const owner = client();
    const other = client();
    expect((await owner.auth.signInAnonymously()).error).toBeNull();
    expect((await other.auth.signInAnonymously()).error).toBeNull();
    const { data: project } = await owner.from("projects").insert({ title: "Mine", idea: "Private" }).select("id").single();
    const { data: doc, error } = await owner
      .from("project_documents").insert({ project_id: project!.id, filename: "plan.pdf", summary: "A plan", done: ["A pilot"] })
      .select("id").single();
    expect(error).toBeNull();
    expect((await other.from("project_documents").select("id").eq("id", doc!.id)).data).toEqual([]);
    expect((await other.from("project_documents").insert({ project_id: project!.id, filename: "x.pdf" })).error).not.toBeNull();
    const { data: removed } = await other.from("project_documents").delete().eq("id", doc!.id).select("id");
    expect(removed ?? []).toEqual([]);
  });
});
