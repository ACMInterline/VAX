import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PublicRequestActionState,
  PublicRequestFormAction,
} from "./action-state";

const hookHarness = vi.hoisted(() => {
  let actionState: PublicRequestActionState = { status: "IDLE" };
  let pending = false;
  let previousDependencies: readonly unknown[] | undefined;
  const focus = vi.fn();
  const formAction = vi.fn();
  const useActionState = vi.fn(
    () => [actionState, formAction, pending] as const,
  );
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
      actionState = { status: "IDLE" };
      pending = false;
      previousDependencies = undefined;
      focus.mockClear();
      formAction.mockClear();
      useActionState.mockClear();
      useEffect.mockClear();
      useRef.mockClear();
    },
    setState(state: PublicRequestActionState) {
      actionState = state;
    },
    setPending(value: boolean) {
      pending = value;
    },
    useActionState,
    useEffect,
    useRef,
  };
});

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: hookHarness.useActionState,
    useEffect: hookHarness.useEffect,
    useRef: hookHarness.useRef,
  };
});

import { RequestForm } from "./request-form";

const unchangedAction: PublicRequestFormAction = async (state) => state;

function render(state: PublicRequestActionState, locale: "bg" | "en" = "en") {
  hookHarness.setState(state);
  return RequestForm({ action: unchangedAction, locale });
}

describe("public request response focus", () => {
  beforeEach(() => hookHarness.reset());

  it("focuses every distinct failed action response but not an unrelated render", () => {
    const firstError: PublicRequestActionState = {
      status: "ERROR",
      fieldErrors: { email: ["Enter a valid email address."] },
    };
    const secondError: PublicRequestActionState = {
      status: "ERROR",
      fieldErrors: { email: ["Enter a valid email address."] },
    };

    render(firstError);
    render(secondError);
    render(secondError, "bg");

    expect(hookHarness.focus).toHaveBeenCalledTimes(2);
  });

  it("does not move focus while idle and focuses a successful acknowledgement", () => {
    render({ status: "IDLE" });
    expect(hookHarness.focus).not.toHaveBeenCalled();

    render({ status: "SUCCESS", requestReference: "REQ-SAFE-REFERENCE" });

    expect(hookHarness.focus).toHaveBeenCalledTimes(1);
  });

  it("renders linked field feedback and bounded retained values", () => {
    const html = renderToStaticMarkup(
      render({
        status: "ERROR",
        message: "Check the request details.",
        fieldErrors: { email: ["Enter a valid email address."] },
        values: {
          email: "customer@example.com",
          services: ["CARPET_FIXED"],
          condition: "NOTICEABLY_SOILED",
        },
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('href="#email"');
    expect(html).toContain('value="customer@example.com"');
    expect(html).toMatch(/name="services" checked="" value="CARPET_FIXED"/);
    expect(html).toContain('class="sr-only" inert=""');
    expect(html).toContain('name="website"');
  });

  it("acknowledges the safe request reference and disables repeat submission while pending", () => {
    const successHtml = renderToStaticMarkup(
      render({ status: "SUCCESS", requestReference: "REQ-SAFE-REFERENCE" }),
    );
    hookHarness.setPending(true);
    const pendingHtml = renderToStaticMarkup(render({ status: "IDLE" }));

    expect(successHtml).toContain('role="status"');
    expect(successHtml).toContain("REQ-SAFE-REFERENCE");
    expect(pendingHtml).toContain('aria-busy="true"');
    expect(pendingHtml).toMatch(/class="submit-button"[^>]*disabled=""/);
  });
});
