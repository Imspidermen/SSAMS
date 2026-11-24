/** Tiny class-name combiner - avoids pulling in a dependency for this. */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((v): v is string | number => Boolean(v) || v === 0).join(' ');
}
