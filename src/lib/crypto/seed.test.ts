import { describe, it, expect } from 'vitest';
import {
  generateRngSeed,
  sha256Hex,
  generateAccessToken,
  generatePublicSlug,
  hashTokenForAudit,
} from './seed';

describe('generateRngSeed', () => {
  it('returns a 64-character lowercase hex string', () => {
    const seed = generateRngSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different value on each call (high entropy)', () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seeds.add(generateRngSeed());
    }
    expect(seeds.size).toBe(100);
  });
});

describe('sha256Hex', () => {
  it('returns the expected SHA-256 digest for a known input vector', () => {
    // RFC test vector: sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('returns the same hash for the same input (deterministic)', () => {
    const hash1 = sha256Hex('rifatela');
    const hash2 = sha256Hex('rifatela');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('always returns 64 hex characters', () => {
    expect(sha256Hex('')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('short')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('a'.repeat(10_000))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles UTF-8 multi-byte input correctly', () => {
    // sha256("héllo") — different from sha256("hello") because of the accented e
    expect(sha256Hex('héllo')).not.toBe(sha256Hex('hello'));
    expect(sha256Hex('héllo')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateAccessToken', () => {
  it('returns a 32-character URL-safe string', () => {
    const token = generateAccessToken();
    // nanoid uses URL-safe alphabet: A-Z a-z 0-9 _ -
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('produces a different value on each call', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateAccessToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('generatePublicSlug', () => {
  it('returns a 10-character URL-safe string', () => {
    const slug = generatePublicSlug();
    expect(slug).toMatch(/^[A-Za-z0-9_-]{10}$/);
  });

  it('produces a different value on each call', () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      slugs.add(generatePublicSlug());
    }
    expect(slugs.size).toBe(100);
  });
});

describe('hashTokenForAudit', () => {
  it('is an alias of sha256Hex (deterministic, matches direct sha256Hex)', () => {
    const token = 'old-token-to-hash';
    expect(hashTokenForAudit(token)).toBe(sha256Hex(token));
  });
});
