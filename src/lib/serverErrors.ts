import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/errors';

/**
 * Puts 422 field errors next to the matching inputs.
 * Returns a form-level message for everything that cannot be shown on a field
 * (non-validation errors, or validation errors for fields the form doesn't have).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (!error.isValidation) return error.message;

  const unmatched: string[] = [];
  let focused = false;

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages.join(' ');
    const formField = fields.find((name) => name === field);
    if (formField) {
      setError(formField, { type: 'server', message }, { shouldFocus: !focused });
      focused = true;
    } else {
      unmatched.push(message);
    }
  }

  if (unmatched.length > 0) return unmatched.join(' ');
  return focused ? null : error.message;
}
