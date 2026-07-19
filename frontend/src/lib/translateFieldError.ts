import type { TFunction, Namespace } from 'i18next';

/**
 * Some zod schemas store a relative key under the feature namespace's
 * `errors` object as their message, not display text, since schemas build at
 * module load before any i18next context exists. TS can't verify that
 * runtime-derived suffix against the literal key union, so this is the one
 * place that casts past it.
 */
export function translateFieldError<Ns extends Namespace>(
  t: TFunction<Ns>,
  message: string | undefined,
  params?: Record<string, unknown>
): string | undefined {
  if (message === undefined) return undefined;
  return t(`errors.${message}` as never, params as never) as unknown as string;
}
