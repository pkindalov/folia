export function formatMemberSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
