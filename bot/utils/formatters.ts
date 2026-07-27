export function truncate(text: string, length = 10): string {
  if (text.length <= length) {
    return text.padEnd(length);
  }

  return text.substring(0, length - 2) + "..";
}

export function formatPrice(price: number): string {
  return price.toLocaleString("id-ID").padStart(12);
}
