/** Tiny className merge — joins truthy values, no external deps */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
