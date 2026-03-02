import { db } from '@/lib/db';

export async function saveOnboarding(input: {
  userId: string;
  fullName: string;
  phoneNumber: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  birthdate: string;
  timezone: string;
  preferredLanguage: string;
  targetAudience: Record<string, unknown>;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  existingSystems: Record<string, unknown>;
  primaryGoals: string[];
  companies: Array<{ name: string; products: Array<{ name: string; description?: string; ingredients?: string }> }>;
}): Promise<void> {
  await db.query(
    `INSERT INTO user_profiles (
      user_id, full_name, phone_number, street, city, state_province, postal_code,
      country, birthdate, timezone, preferred_language, target_audience,
      experience_level, existing_systems, primary_goals, onboarding_completed_at
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12::jsonb,$13,$14::jsonb,$15,now())
     ON CONFLICT (user_id)
     DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone_number = EXCLUDED.phone_number,
      street = EXCLUDED.street,
      city = EXCLUDED.city,
      state_province = EXCLUDED.state_province,
      postal_code = EXCLUDED.postal_code,
      country = EXCLUDED.country,
      birthdate = EXCLUDED.birthdate,
      timezone = EXCLUDED.timezone,
      preferred_language = EXCLUDED.preferred_language,
      target_audience = EXCLUDED.target_audience,
      experience_level = EXCLUDED.experience_level,
      existing_systems = EXCLUDED.existing_systems,
      primary_goals = EXCLUDED.primary_goals,
      onboarding_completed_at = now(),
      updated_at = now()`,
    [
      input.userId,
      input.fullName,
      input.phoneNumber,
      input.street,
      input.city,
      input.stateProvince,
      input.postalCode,
      input.country,
      input.birthdate,
      input.timezone,
      input.preferredLanguage,
      JSON.stringify(input.targetAudience),
      input.experienceLevel,
      JSON.stringify(input.existingSystems),
      input.primaryGoals
    ]
  );

  await db.query('DELETE FROM companies WHERE user_id = $1', [input.userId]);

  for (let idx = 0; idx < input.companies.length; idx += 1) {
    const company = input.companies[idx];
    const companyRes = await db.query(
      `INSERT INTO companies (user_id, name, is_active_context)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.userId, company.name, idx === 0]
    );

    for (const product of company.products) {
      await db.query(
        `INSERT INTO products (company_id, name, description, ingredients)
         VALUES ($1, $2, $3, $4)`,
        [companyRes.rows[0].id, product.name, product.description ?? null, product.ingredients ?? null]
      );
    }
  }
}
