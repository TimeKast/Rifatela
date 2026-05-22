/**
 * Public Buyer Initials (BR-009)
 *
 * Public surfaces (SCR-007, SCR-009) MUST NOT expose buyer PII —
 * phone/email never go to the wire, and `name` is reduced to its initials.
 * Anonymous buyers (no name) render as "Anónimo" (DD-010).
 *
 * Examples:
 *   "Marta López"        -> "ML"
 *   "Juan"               -> "J"
 *   "JOSÉ ANTONIO PÉREZ" -> "JP"   (first + last word)
 *   "  ana  maria  "     -> "AM"
 *   ""  / null / "   "   -> "Anónimo"
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-009)
 * @see project/planning/15_DESIGN.md (DD-010)
 */

const ANONYMOUS = 'Anónimo';

export function publicInitials(name: string | null | undefined): string {
  if (!name) return ANONYMOUS;
  const trimmed = name.trim();
  if (trimmed.length === 0) return ANONYMOUS;

  const words = trimmed.split(/\s+/);
  const first = words[0]?.[0];
  if (!first) return ANONYMOUS;
  if (words.length === 1) return first.toLocaleUpperCase();

  const last = words[words.length - 1]?.[0] ?? '';
  return (first + last).toLocaleUpperCase();
}
