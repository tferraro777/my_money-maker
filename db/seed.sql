INSERT INTO users (id, email, role, email_verified_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@mymoneymaker.app', 'admin', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO usage_counters (user_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO free_access (user_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
