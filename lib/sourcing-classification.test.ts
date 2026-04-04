import { describe, it, expect } from "vitest";
import {
  computeStrictnessScore,
  classifyRequest,
  getDepositCents,
  getTimelineSurchargeCents,
  computeTotalDepositCents,
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

  it("adds 3 for closeReferenceMatch", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: true,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
      })
    ).toBe(3);
  });

  it("adds 2 for exactColorMatters", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: true,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: false,
      })
    ).toBe(2);
  });

  it("adds 2 for patternVeiningMatters", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: true,
        translucencyMatters: false,
        exactDimensionsMatters: false,
      })
    ).toBe(2);
  });

  it("adds 2 for translucencyMatters", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: true,
        exactDimensionsMatters: false,
      })
    ).toBe(2);
  });

  it("adds 1 for exactDimensionsMatters", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: false,
        exactColorMatters: false,
        patternVeiningMatters: false,
        translucencyMatters: false,
        exactDimensionsMatters: true,
      })
    ).toBe(1);
  });

  it("returns 10 for all flags true", () => {
    expect(
      computeStrictnessScore({
        closeReferenceMatch: true,
        exactColorMatters: true,
        patternVeiningMatters: true,
        translucencyMatters: true,
        exactDimensionsMatters: true,
      })
    ).toBe(10); // 3+2+2+2+1
  });
});

describe("classifyRequest", () => {
  it("classifies score 0 as standard", () => expect(classifyRequest(0)).toBe("standard"));
  it("classifies score 1 as standard", () => expect(classifyRequest(1)).toBe("standard"));
  it("classifies score 2 as premium",  () => expect(classifyRequest(2)).toBe("premium"));
  it("classifies score 4 as premium",  () => expect(classifyRequest(4)).toBe("premium"));
  it("classifies score 5 as concierge", () => expect(classifyRequest(5)).toBe("concierge"));
  it("classifies score 10 as concierge", () => expect(classifyRequest(10)).toBe("concierge"));
});

describe("getDepositCents", () => {
  it("returns 5000 for standard",   () => expect(getDepositCents("standard")).toBe(5000));
  it("returns 10000 for premium",   () => expect(getDepositCents("premium")).toBe(10000));
  it("returns 15000 for concierge", () => expect(getDepositCents("concierge")).toBe(15000));
});

describe("getTimelineSurchargeCents", () => {
  it("returns 0 for within_3_months",  () => expect(getTimelineSurchargeCents("within_3_months")).toBe(0));
  it("returns 1000 for 1-2_months",    () => expect(getTimelineSurchargeCents("1-2_months")).toBe(1000));
  it("returns 2500 for within_1_month", () => expect(getTimelineSurchargeCents("within_1_month")).toBe(2500));
  it("returns 5000 for asap",          () => expect(getTimelineSurchargeCents("asap")).toBe(5000));
  it("returns 0 for unknown timeline", () => expect(getTimelineSurchargeCents("unknown")).toBe(0));
});

describe("computeTotalDepositCents", () => {
  it("standard + within_3_months = 5000",  () => expect(computeTotalDepositCents("standard", "within_3_months")).toBe(5000));
  it("standard + asap = 10000",            () => expect(computeTotalDepositCents("standard", "asap")).toBe(10000));
  it("premium + within_1_month = 12500",   () => expect(computeTotalDepositCents("premium", "within_1_month")).toBe(12500));
  it("concierge + asap = 20000",           () => expect(computeTotalDepositCents("concierge", "asap")).toBe(20000));
  it("concierge + within_3_months = 15000", () => expect(computeTotalDepositCents("concierge", "within_3_months")).toBe(15000));
});

describe("classifyFromInputs", () => {
  it("returns standard for no flags", () => {
    const result = classifyFromInputs({
      closeReferenceMatch: false,
      exactColorMatters: false,
      patternVeiningMatters: false,
      translucencyMatters: false,
      exactDimensionsMatters: false,
    });
    expect(result).toEqual({ score: 0, requestType: "standard", depositCents: 5000 });
  });

  it("returns premium for exactColor + pattern (score 4)", () => {
    const result = classifyFromInputs({
      closeReferenceMatch: false,
      exactColorMatters: true,
      patternVeiningMatters: true,
      translucencyMatters: false,
      exactDimensionsMatters: false,
    });
    expect(result).toEqual({ score: 4, requestType: "premium", depositCents: 10000 });
  });

  it("returns concierge for closeReferenceMatch + exactColor (score 5)", () => {
    const result = classifyFromInputs({
      closeReferenceMatch: true,
      exactColorMatters: true,
      patternVeiningMatters: false,
      translucencyMatters: false,
      exactDimensionsMatters: false,
    });
    expect(result).toEqual({ score: 5, requestType: "concierge", depositCents: 15000 });
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

  it("zeros out on credit_expired", () => {
    expect(
      computeAvailableCredit(5000, [
        { event_type: "credit_created", amount_cents: 5000 },
        { event_type: "credit_expired", amount_cents: 5000 },
      ])
    ).toBe(0);
  });
});
