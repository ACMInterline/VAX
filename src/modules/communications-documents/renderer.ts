import { createHash } from "node:crypto";
import type {
  CommunicationTemplateRecord,
  DocumentContentSnapshot,
  ResolvedCommunicationSource,
} from "./types";

const variableName = /^[a-z][a-z0-9_]{0,63}$/;
const placeholder = /{{([a-z][a-z0-9_]*)}}/g;

export class TemplateRenderError extends Error {
  constructor() {
    super("TEMPLATE_CONTRACT_INVALID");
    this.name = "TemplateRenderError";
  }
}

function placeholders(value: string): readonly string[] {
  const found = Array.from(value.matchAll(placeholder), (match) => match[1]);
  const withoutKnown = value.replace(placeholder, "");
  if (withoutKnown.includes("{") || withoutKnown.includes("}")) {
    throw new TemplateRenderError();
  }
  return found;
}

function validateContract(
  template: CommunicationTemplateRecord,
  variables: Readonly<Record<string, string>>,
): void {
  const contract = template.variablesContract;
  if (
    contract.length === 0 ||
    new Set(contract).size !== contract.length ||
    contract.some((name) => !variableName.test(name))
  ) {
    throw new TemplateRenderError();
  }
  const used = [
    ...placeholders(template.titleTemplate),
    ...placeholders(template.bodyTemplate),
  ];
  const usedSet = new Set(used);
  const variableKeys = Object.keys(variables);
  if (
    usedSet.size !== used.length ||
    contract.some((name) => !usedSet.has(name)) ||
    used.some((name) => !contract.includes(name)) ||
    variableKeys.length !== contract.length ||
    variableKeys.some((name) => !contract.includes(name)) ||
    Object.values(variables).some(
      (value) =>
        typeof value !== "string" ||
        value.length === 0 ||
        new TextEncoder().encode(value).byteLength > 4_000,
    )
  ) {
    throw new TemplateRenderError();
  }
}

function renderText(
  template: string,
  variables: Readonly<Record<string, string>>,
): string {
  return template.replace(placeholder, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) throw new TemplateRenderError();
    return value;
  });
}

export function renderDocument(
  template: CommunicationTemplateRecord,
  source: ResolvedCommunicationSource,
): DocumentContentSnapshot {
  if (
    template.templateKey !== source.templateKey ||
    template.locale !== source.localeHint ||
    template.documentType !== source.documentType ||
    template.status !== "ACTIVE"
  ) {
    throw new TemplateRenderError();
  }
  validateContract(template, source.variables);
  return {
    schemaVersion: 1,
    rendererVersion: 1,
    eventType: source.eventType,
    sourceReference: source.sourceReference,
    locale: template.locale,
    title: renderText(template.titleTemplate, source.variables),
    body: renderText(template.bodyTemplate, source.variables),
    facts: source.facts,
    lineItems: source.lineItems,
    totals: source.totals,
    notices: source.notices,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function documentChecksum(
  template: CommunicationTemplateRecord,
  content: DocumentContentSnapshot,
): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        templateKey: template.templateKey,
        templateVersion: template.version,
        locale: template.locale,
        rendererVersion: content.rendererVersion,
        content,
      }),
    )
    .digest("hex");
}

export function communicationFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
