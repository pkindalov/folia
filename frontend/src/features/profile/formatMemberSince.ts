export function formatMemberSince(createdAt: string | undefined, locale: string): string | null {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
