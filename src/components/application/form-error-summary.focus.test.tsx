import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  let previousDependencies: readonly unknown[] | undefined;
  const focus = vi.fn();
  const useEffect = vi.fn(
    (effect: () => void, dependencies?: readonly unknown[]) => {
      const changed =
        previousDependencies === undefined ||
        dependencies === undefined ||
        dependencies.length !== previousDependencies.length ||
        dependencies.some(
          (dependency, index) =>
            !Object.is(dependency, previousDependencies?.[index]),
        );
      if (changed) effect();
      previousDependencies = dependencies ? [...dependencies] : undefined;
    },
  );
  const useRef = vi.fn(() => ({ current: { focus } }));

  return {
    focus,
    reset() {
      previousDependencies = undefined;
      focus.mockClear();
      useEffect.mockClear();
      useRef.mockClear();
    },
    useEffect,
    useRef,
  };
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: hookHarness.useEffect,
    useRef: hookHarness.useRef,
  };
});

import { ApplicationFormErrorSummary } from "./form-error-summary";

const errors = [
  { fieldId: "display-name", label: "Display name", message: "Enter a name." },
] as const;

describe("application form error-summary focus", () => {
  beforeEach(() => hookHarness.reset());

  it("focuses each distinct failed response without refocusing an unrelated render", () => {
    const firstResponse = {};
    const secondResponse = {};

    ApplicationFormErrorSummary({
      errors,
      response: firstResponse,
      title: "Check the fields",
    });
    ApplicationFormErrorSummary({
      errors,
      response: secondResponse,
      title: "Check the fields",
    });
    ApplicationFormErrorSummary({
      errors,
      response: secondResponse,
      title: "Check the fields",
    });

    expect(hookHarness.focus).toHaveBeenCalledTimes(2);
  });

  it("does not focus when there are no field errors", () => {
    ApplicationFormErrorSummary({ errors: [], response: {}, title: "Check" });
    expect(hookHarness.focus).not.toHaveBeenCalled();
  });
});
