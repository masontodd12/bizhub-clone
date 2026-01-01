// src/lib/safeHostname.ts
export function safeHostname(maybeUrl: unknown) {
  if (typeof maybeUrl !== "string") return null;
  const s = maybeUrl.trim();
  if (!s) return null;

  const withScheme =
    s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;

  try {
    return new URL(withScheme).hostname;
  } catch {
    return null;
  }
}
