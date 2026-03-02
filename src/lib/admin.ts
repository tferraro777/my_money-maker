import { db } from '@/lib/db';

export async function getMaskedBirthdate(userId: string): Promise<string | null> {
  const res = await db.query('SELECT birthdate FROM user_profiles WHERE user_id = $1', [userId]);
  const birthdate = res.rows[0]?.birthdate;
  if (!birthdate) return null;

  const date = new Date(birthdate);
  const yyyy = date.getUTCFullYear();
  return `****-**-${String(date.getUTCDate()).padStart(2, '0')} (${yyyy})`;
}

export async function revealBirthdateForAdmin(input: {
  actorUserId: string;
  targetUserId: string;
  reason: string;
}): Promise<string | null> {
  const roleRes = await db.query('SELECT role FROM users WHERE id = $1', [input.actorUserId]);
  if (roleRes.rows[0]?.role !== 'admin') {
    throw new Error('Only admin can reveal sensitive birthdate data.');
  }

  const birthdateRes = await db.query('SELECT birthdate FROM user_profiles WHERE user_id = $1', [input.targetUserId]);
  const birthdate = birthdateRes.rows[0]?.birthdate;

  await db.query(
    `INSERT INTO admin_audit_log (actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1, 'reveal_birthdate', 'user_profile', $2, $3::jsonb)`,
    [input.actorUserId, input.targetUserId, JSON.stringify({ reason: input.reason })]
  );

  return birthdate ? new Date(birthdate).toISOString().slice(0, 10) : null;
}
