import { describe, it, expect } from "vitest";
import {
  computeStrictnessScore,
  classifyRequest,
  getDepositCents,
  classifyFromInputs,
  computeAvailableCredit,
} from "./sourcing-classification";

describe("computeStrictnessScore", () => {
  it("returns 0 for all-false inputs", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
      })
    ).toBe(0);
  });

  it("adds 2 for closeReferenceMatch", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: true,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
      })
    ).toBe(2);
  });

  it("adds 1 per boolean flag", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: true,
        patternVeiningMatters: true,
        translucencyMatters: true,
        exactDimensionsMatters: true,
      })
    ).toBe(4);
  });

  it("adds 1 for 3+ comma-separated must-have constraints", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
        mustHaves: "no dye, no crack, natural color",
      })
    ).toBe(1);
  });

  it("does NOT add for fewer than 3 must-have constraints", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
        mustHaves: "no dye, no crack",
      })
    ).toBe(0);
  });

  it("handles newline-separated must-haves", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
        mustHaves: "rich green\nno crack\nnatural",
      })
    ).toBe(1);
  });

  it("returns 6 for all flags true + 3+ must-haves", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: true,
        exactColorMatters: true,
        patternVeiningMatters: true,
        translucencyMatters: true,
        exactDimensionsMatters: true,
        mustHaves: "rich green, natural color, no treatment",
      })
    ).toBe(7);
  });
});

describe("classifyRequest", () => {
  it("classifies score 0 as standard", () => expect(classifyRequest(0)).toBe("standard"));
  it("classifies score 2 as standard", () => expect(classifyRequest(2)).toBe("standard"));
  it("classifies score 3 as premium", () => expect(classifyRequest(3)).toBe("premium"));
  it("classifies score 7 as premium", () => expect(classifyRequest(7)).toBe("premium"));
});

describe("getDepositCents", () => {
  it("returns 5000 for standard", () => expect(getDepositCents("standard")).toBe(5000));
  it("returns 10000 for premium", () => expect(getDepositCents("premium")).toBe(10000));
});

describe("classifyFromInputs", () => {
  it("returns correct bundle for standard request", () => {
    const result = classifyFromInputs({
      closeReferenceMatch: false,
      exactColorMatters: false,
      patternVeiningMatters: false,
      translucencyMatters: false,
      exactDimensionsMatters: false,
    });
    expect(result).toEqual({ score: 0, requestType: "standard", depositCents: 5000 });
  });

  it("returns correct bundle for premium request", () => {
    const result = classifyFromInputs({
      closeReferenceMatch: true,
      exactColorMatters: true,
      patternVeiningMatters: false,
      translucencyMatters: false,
      exactDimensionsMatters: false,
    });
    expect(result).toEqual({ score: 3, requestType: "premium", depositCents: 10000 });
  });
});

describe("computeAvailableCredit", () => {
  it("returns deposit amount when only credit_created", () => {
    expect(
      computeAvailableCredit(5000, [{ event_type: "credit_created", amount_cents: 5000 }])
    ).toBe(5000);
  });

  it("returns 0 after full consumption", () => {
    expect(
      computeAvailableCredit(5000, [
        { event_type: "credit_created", amount_cents: 5000 },
        { event_type: "credit_consumed", amount_cents: 5000 },
      ])
    ).toBe(0);
  });

  it("supports partial consumption", () => {
    expect(
      computeAvailableCredit(5000, [
        { event_type: "credit_created", amount_cents: 5000 },
        { event_type: "credit_consumed", amount_cents: 3000 },
      ])
    ).toBe(2000);
  });

  it("caps at deposit amount even if ledger is weird", () => {
    expect(
      computeAvailableCredit(5000, [
        { event_type: "credit_created", amount_cents: 9999 },
      ])
    ).toBe(5000);
  });

  it("returns 0 for empty ledger", () => {
    expect(computeAvailableCredit(5000, [])).toBe(0);
  });

  it("adds refund back to available", () => {
    expect(
      computeAvailableCredit(5000, [
        { event_type: "credit_created", amount_cents: 5000 },
        { event_type: "credit_consumed", amount_cents: 5000 },
        { event_type: "credit_refunded", amount_cents: 5000 },
      ])
    ).toBe(5000);
  });
});
