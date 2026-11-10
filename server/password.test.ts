import { describe, expect, it } from 'vitest';
import { hashPassword, passwordMatches } from './password';

describe('password', () => {
  it('matches the password that was hashed and rejects others', () => {
    const stored = hashPassword('secret1');
    expect(stored).not.toContain('secret1');
    expect(passwordMatches('secret1', stored)).toBe(true);
    expect(passwordMatches('secret2', stored)).toBe(false);
    expect(passwordMatches('secret1', '')).toBe(false);
  });
});