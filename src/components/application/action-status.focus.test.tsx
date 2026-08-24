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

import {
  ApplicationActionStatus,
  type ApplicationActionState,
} from "./action-status";

function render(state: ApplicationActionState) {
  return ApplicationActionStatus({ state });
}

describe("application action error focus", () => {
  beforeEach(() => hookHarness.reset());

  it("focuses each distinct error response but not the same response twice", () => {
    const first = { status: "ERROR", message: "Safe error." } as const;
    const second = { status: "ERROR", message: "Safe error." } as const;

    render(first);
    render(second);
    render(second);

    expect(hookHarness.focus).toHaveBeenCalledTimes(2);
  });

  it("does not focus idle or successful responses", () => {
    render({ status: "IDLE" });
    render({ status: "SUCCESS", message: "Saved." });

    expect(hookHarness.focus).not.toHaveBeenCalled();
  });
});
