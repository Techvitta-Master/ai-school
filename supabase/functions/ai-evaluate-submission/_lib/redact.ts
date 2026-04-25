const ROLL_PATTERNS = [
  /\b(roll\s*(?:no\.?|number)?\s*[:#-]?\s*)([A-Za-z0-9-]{2,})/gi,
  /\b(adm(?:ission)?\s*(?:no\.?|number)?\s*[:#-]?\s*)([A-Za-z0-9-]{2,})/gi,
  /\b(student\s*id\s*[:#-]?\s*)([A-Za-z0-9-]{2,})/gi,
];

const NAME_LABEL = /\b(name\s*[:#-]?\s*)([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,3})/gu;

export function redactPII(text: string, knownNames: string[] = []): string {
  if (!text) return text;
  let out = text;
  for (const re of ROLL_PATTERNS) {
    out = out.replace(re, (_m, label) => `${label}[REDACTED_ID]`);
  }
  out = out.replace(NAME_LABEL, (_m, label) => `${label}[REDACTED_NAME]`);
  for (const name of knownNames) {
    if (!name || name.length < 3) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "[REDACTED_NAME]");
  }
  return out;
}

export function buildKnownNames(...names: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const raw of names) {
    if (!raw) continue;
    const parts = raw.split(/\s+/).filter((p) => p.length >= 3);
    for (const p of parts) tokens.add(p);
    if (raw.length >= 3) tokens.add(raw);
  }
  return Array.from(tokens);
}
