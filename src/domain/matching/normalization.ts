const UNIT_ALIASES: Record<string, string> = {
  gr: "g",
  grs: "g",
  gramos: "g",
  gramo: "g",
  mg: "mg",
  ml: "ml",
  mililitros: "ml",
  ud: "unit",
  uds: "unit",
  unidad: "unit",
  unidades: "unit",
  capsula: "capsule",
  capsulas: "capsule",
  cápsula: "capsule",
  cápsulas: "capsule",
  jeringa: "syringe",
  jeringas: "syringe",
  refill: "refill",
  kit: "kit"
};

const PRESENTATION_ALIASES: Record<string, string> = {
  syringe: "syringe",
  jeringa: "syringe",
  jeringas: "syringe",
  capsule: "capsule",
  capsules: "capsule",
  capsula: "capsule",
  capsulas: "capsule",
  cápsula: "capsule",
  cápsulas: "capsule",
  refill: "refill",
  kit: "kit",
  pack: "pack",
  caja: "box",
  box: "box"
};

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeToken(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[()[\],;:/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeManufacturer(value?: string): string | undefined {
  if (!value) return undefined;
  const v = normalizeToken(value);
  if (/^dentsply(?: maillefer| sirona)?$/.test(v) || v==="maillefer") return "dentsply";
  return v;
}

export function normalizeUnit(value?: string): string | undefined {
  if (!value) return undefined;
  const token = normalizeToken(value);
  return UNIT_ALIASES[token] ?? token;
}

export function normalizePresentation(value?: string): string | undefined {
  if (!value) return undefined;
  const token = normalizeToken(value);
  return PRESENTATION_ALIASES[token] ?? token;
}

export function normalizeShade(value?: string): string | undefined {
  if (!value) return undefined;
  return normalizeToken(value).replace(/\s+/g, "").toUpperCase();
}

export function normalizeReference(value?: string): string | undefined {
  if (!value) return undefined;
  const token = stripDiacritics(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return token || undefined;
}

export function normalizeName(value: string): string {
  return normalizeToken(value)
    .replace(/\b(gramos?|grs?)\b/g, "g")
    .replace(/\b(jeringas?)\b/g, "syringe")
    .replace(/\b(capsulas?|capsules?)\b/g, "capsule")
    .replace(/\s+/g, " ")
    .trim();
}
