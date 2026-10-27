import type { VariantDefinition } from '../types.ts';
import { anarsi } from './anarsi.ts';
import { burokrat } from './burokrat.ts';
import { diplomat } from './diplomat.ts';
import { jester } from './jester.ts';
import { standard } from './standard.ts';

const registry = new Map<string, VariantDefinition>();

export function registerVariant(v: VariantDefinition): void {
  if (registry.has(v.id)) throw new Error(`Variant '${v.id}' already registered`);
  registry.set(v.id, v);
}

export function getVariant(id: string): VariantDefinition {
  const v = registry.get(id);
  if (!v) throw new Error(`Unknown variant '${id}'`);
  return v;
}

export function listVariants(): VariantDefinition[] {
  return [...registry.values()];
}

// Lists (home page, dialogs) show the variants in this order.
registerVariant(standard);
registerVariant(anarsi);
registerVariant(jester);
registerVariant(burokrat);
registerVariant(diplomat);

export { standard, burokrat, jester, diplomat, anarsi };
