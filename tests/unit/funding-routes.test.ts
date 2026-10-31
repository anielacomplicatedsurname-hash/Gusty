import { describe, expect, it } from "vitest";
import { normaliseRoutes, ROUTES_PROMPT, routesMessage, type RouteRaw } from "@/ai/tasks/funding-routes";

const r = (over: Partial<RouteRaw> = {}): RouteRaw => ({ route: "small_grant", focus: "community", fit: "strong", why: "Small and local.", firstStep: "Look locally.", ...over });

describe("funding routes", () => {
  it("keeps at most three known routes, once each, with safe defaults", () => {
    const out = normaliseRoutes([
      r(), r({ why: "Again" }), r({ route: "magic money" }), r({ route: "Crowdfunding", focus: "space", fit: "maybe" }),
      r({ route: "larger grant", focus: "Environmental" }), r({ route: "prize" }),
    ]);
    expect(out.map((o) => o.route)).toEqual(["small_grant", "crowdfunding", "larger_grant"]);
    expect(out[1]).toMatchObject({ focus: "other", fit: "possible" });
    expect(out[2].focus).toBe("environmental");
  });

  it("uses the person's own idea of the amount, and never names funders or amounts itself", () => {
    expect(routesMessage("ctx", "under_1k")).toContain("under £1,000");
    expect(routesMessage("ctx", null)).toContain("they haven't said");
    expect(ROUTES_PROMPT).toContain("don't name any funder, platform, amount or deadline");
  });
});
