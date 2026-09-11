import { HttpErrorResponse } from '@angular/common/http';

/** Pulls the backend's own {status, message} payload out of an HttpErrorResponse. */
export function extractErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string } | null;
    if (body && typeof body.message === 'string' && body.message) {
      return body.message;
    }
    if (err.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }
  }
  return fallback;
}
