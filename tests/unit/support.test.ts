import { describe, expect, it } from "vitest";
import { supportChoices, type SupportLinks } from "@/config/support";

const empty: SupportLinks = { currency: "GBP", oneOff: { 3: "", 5: "", 10: "", other: "" }, monthly: { 3: "", 5: "", 10: "" }, manage: "" };
const link = (id: string) => `https://buy.stripe.com/test_${id}`;

describe("supportChoices", () => {
  it("hides the support card until there are one-off links", () => {
    expect(supportChoices(empty)).toBeNull();
    expect(supportChoices({ ...empty, monthly: { 3: link("m3"), 5: "", 10: "" } })).toBeNull();
  });

  it("offers one-off amounts in order, with Other last", () => {
    const choices = supportChoices({ ...empty, oneOff: { 3: link("a"), 5: link("b"), 10: link("c"), other: link("d") } });
    expect(choices?.oneOff.map((c) => c.amount)).toEqual([3, 5, 10, "other"]);
    expect(choices?.monthly).toEqual([]);
    expect(choices?.manage).toBeNull();
  });

  it("only accepts Stripe's own payment and billing pages", () => {
    const choices = supportChoices({
      currency: "GBP",
      oneOff: { 3: link("a"), 5: "https://evil.example/pay", 10: "javascript:alert(1)", other: "" },
      monthly: { 3: link("m"), 5: "", 10: "" },
      manage: "https://billing.stripe.com/p/login/test",
    });
    expect(choices?.oneOff.map((c) => c.amount)).toEqual([3]);
    expect(choices?.manage).toBe("https://billing.stripe.com/p/login/test");
  });

});
