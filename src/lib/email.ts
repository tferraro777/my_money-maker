import crypto from 'crypto';

export function canonicalizeEmail(input: string): string {
  const normalized = input.trim().toLowerCase();
  const [localRaw, domainRaw = ''] = normalized.split('@');
  const domain = domainRaw === 'googlemail.com' ? 'gmail.com' : domainRaw;

  let local = localRaw;
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '').replace(/\+.*/, '');
  }

  return `${local}@${domain}`;
}

export function emailBaseFingerprint(email: string): string {
  const canonical = canonicalizeEmail(email);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, row) =>
    Array.from({ length: a.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
  );

  for (let row = 1; row <= b.length; row += 1) {
    for (let col = 1; col <= a.length; col += 1) {
      const cost = a[col - 1] === b[row - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

export function similarityScore(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (!max) return 1;
  return 1 - levenshteinDistance(a, b) / max;
}

export function isLikelyAliasPattern(localA: string, localB: string): boolean {
  const stripDigits = (value: string) => value.replace(/\d+/g, '');
  return stripDigits(localA) === stripDigits(localB) && localA !== localB;
}
