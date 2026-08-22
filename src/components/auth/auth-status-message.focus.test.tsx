import type { AuthActionState } from "@/auth/action-state";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  let previousDependencies: readonly unknown[] | undefined;
  const focus = vi.fn();
  const useEffect = vi.fn(
    (effect: () => void, dependencies?: readonly unknown[]) => {
      const dependenciesChanged =
        previousDependencies === undefined ||
        dependencies === undefined ||
        dependencies.length !== previousDependencies.length ||
        dependencies.some(
          (dependency, index) =>
            !Object.is(dependency, previousDependencies?.[index]),
        );

      if (dependenciesChanged) {
        effect();
      }
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

import { AuthStatusMessage } from "./auth-status-message";

function renderActionState(state: AuthActionState, locale: "bg" | "en" = "en") {
  return AuthStatusMessage({ state, locale });
}

describe("authentication error focus", () => {
  beforeEach(() => hookHarness.reset());

  it("focuses the alert for every distinct error response without refocusing the same response", () => {
    const firstError: AuthActionState = {
      status: "ERROR",
      message: "Generic unavailable message.",
    };
    const secondError: AuthActionState = {
      status: "ERROR",
      message: "Generic unavailable message.",
    };

    renderActionState(firstError);
    expect(hookHarness.focus).toHaveBeenCalledTimes(1);

    renderActionState(secondError);
    expect(hookHarness.focus).toHaveBeenCalledTimes(2);

    renderActionState(secondError, "bg");
    expect(hookHarness.focus).toHaveBeenCalledTimes(2);
  });

  it("does not focus the alert for non-error responses", () => {
    renderActionState({ status: "IDLE" });
    renderActionState({ status: "SUCCESS", message: "Request accepted." });

    expect(hookHarness.focus).not.toHaveBeenCalled();
  });
});
