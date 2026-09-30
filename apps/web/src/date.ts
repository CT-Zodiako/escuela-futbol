export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(iso: string): Date {
  const utcDate = new Date(iso);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}
