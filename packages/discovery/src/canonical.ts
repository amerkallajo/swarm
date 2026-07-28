import { createHash } from "node:crypto";

const MAX_DEPTH = 32;
const MAX_NODES = 25_000;

function normalize(value: unknown, depth: number, state: { nodes: number }): unknown {
  state.nodes += 1;
  if (depth > MAX_DEPTH || state.nodes > MAX_NODES) {
    throw new Error("CANONICAL_LIMIT_EXCEEDED");
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error("UNSAFE_CANONICAL_VALUE");
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item, depth + 1, state));
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("UNSAFE_CANONICAL_VALUE");
  }
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error("UNSAFE_CANONICAL_KEY");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new Error("UNSAFE_CANONICAL_VALUE");
    }
    output[key] = normalize(descriptor.value, depth + 1, state);
  }
  return output;
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(normalize(value, 0, { nodes: 0 }));
}

export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalSerialize(value));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
