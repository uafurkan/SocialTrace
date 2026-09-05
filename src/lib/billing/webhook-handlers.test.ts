import { describe, expect, it } from "vitest";

import { planForSubscriptionStatus } from "./webhook-handlers";

describe("planForSubscriptionStatus", () => {
  it("treats active and trialing subscriptions as pro", () => {
    expect(planForSubscriptionStatus("active")).toBe("pro");
    expect(planForSubscriptionStatus("trialing")).toBe("pro");
  });

  it("treats every other status as free", () => {
    expect(planForSubscriptionStatus("past_due")).toBe("free");
    expect(planForSubscriptionStatus("unpaid")).toBe("free");
    expect(planForSubscriptionStatus("canceled")).toBe("free");
    expect(planForSubscriptionStatus("incomplete")).toBe("free");
    expect(planForSubscriptionStatus("incomplete_expired")).toBe("free");
    expect(planForSubscriptionStatus("paused")).toBe("free");
  });
});
