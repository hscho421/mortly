/**
 * Tiny validation primitives shared by every API handler.
 *
 * Each function returns the validated value on success or throws `ValidationError`
 * with a user-facing message and a 400 status code. Handlers catch via
 * `withValidation` (or a manual try/catch) and emit the message in the response.
 *
 * We deliberately avoid a heavy schema lib — our shapes are small, and we want
 * the validation site colocated with the handler that uses the value.
 */

export class ValidationError extends Error {
  status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function assertString(
  value: unknown,
  field: string,
  opts: { min?: number; max: number; trim?: boolean } = { max: 1000 },
): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const v = opts.trim === false ? value : value.trim();
  const min = opts.min ?? 1;
  if (v.length < min) {
    throw new ValidationError(`${field} must be at least ${min} character${min === 1 ? "" : "s"}`);
  }
  if (v.length > opts.max) {
    throw new ValidationError(`${field} must be at most ${opts.max} characters`);
  }
  return v;
}

export function assertOptionalString(
  value: unknown,
  field: string,
  opts: { max: number; trim?: boolean },
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return assertString(value, field, { ...opts, min: 1 });
}

export function assertEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export function assertOptionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null) return undefined;
  return assertEnum(value, field, allowed);
}

export function assertInt(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number },
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n)) {
    throw new ValidationError(`${field} must be an integer`);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new ValidationError(`${field} must be at least ${opts.min}`);
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new ValidationError(`${field} must be at most ${opts.max}`);
  }
  return n;
}

export function assertOptionalInt(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number },
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return assertInt(value, field, opts);
}

/**
 * Allow only `https://` URLs. Used for any user-supplied URL we'll later
 * render as `<img src>` or follow server-side. Rejects `javascript:`,
 * `data:`, `file:`, and `http://`.
 */
export function assertHttpsUrl(value: unknown, field: string, maxLen = 2048): string {
  const s = assertString(value, field, { max: maxLen, trim: true });
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`);
  }
  if (u.protocol !== "https:") {
    throw new ValidationError(`${field} must be an https URL`);
  }
  return s;
}

export function assertOptionalHttpsUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return assertHttpsUrl(value, field);
}

/**
 * Cap JSON serialized size for free-form blobs (e.g. BorrowerRequest.details).
 * Returns the original value on success; throws on oversize / non-object.
 */
export function assertBoundedJson(
  value: unknown,
  field: string,
  maxBytes: number,
): Record<string, unknown> {
  if (value === null || value === undefined) {
    throw new ValidationError(`${field} is required`);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be a JSON object`);
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > maxBytes) {
    throw new ValidationError(`${field} exceeds ${maxBytes} bytes`);
  }
  return value as Record<string, unknown>;
}

export function assertOptionalBoundedJson(
  value: unknown,
  field: string,
  maxBytes: number,
): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  return assertBoundedJson(value, field, maxBytes);
}

/**
 * Phone helper — accepts E.164 (`+` followed by 7-15 digits). Client-side
 * formatting prepends `+1` for CA/US; the server still re-validates because
 * mobile/web/native paths all hit this code.
 */
const E164_RE = /^\+[1-9]\d{6,14}$/;
export function assertPhone(value: unknown, field: string): string {
  const s = assertString(value, field, { max: 20, trim: true });
  if (!E164_RE.test(s)) {
    throw new ValidationError(`${field} must be in E.164 format (+1...)`);
  }
  return s;
}

export function assertOptionalPhone(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return assertPhone(value, field);
}
