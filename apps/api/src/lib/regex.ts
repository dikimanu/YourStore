/**
 * Escapes characters with special meaning in regular expressions
 * so user inputs can safely be used in new RegExp(escaped, 'i').
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
