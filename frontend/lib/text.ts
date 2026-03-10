export function stripDecorativeText(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/^[\s\-:|.]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}