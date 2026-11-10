export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `请填写${label}`);
  return value.trim();
}

export function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.trim();
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ApiError(400, `${label}不正确`);
}
