-- Gusty stage 5 security review: remove leftover default permissions and keep the usage log plausible.

-- organisations: Row Level Security already blocks every row (no policies); remove the default
-- table permissions too, so nothing depends on that alone.
revoke all on public.organisations from anon, authenticated;

-- A trigger helper: never needs to be called directly.
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- The usage log is written with the person's own session, so its numbers are bounded:
-- no single AI call costs more than a dollar or uses more than 200,000 tokens.
alter table public.ai_runs
  add constraint ai_runs_cost_range check (cost_usd between 0 and 1),
  add constraint ai_runs_input_tokens_range check (input_tokens between 0 and 200000),
  add constraint ai_runs_output_tokens_range check (output_tokens between 0 and 200000);
