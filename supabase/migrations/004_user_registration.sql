-- ============================================================
-- 004 — Self-registration support
--       1. profiles: add affiliation column
--       2. profiles: allow insert by authenticated users (self-register)
-- ============================================================

-- ── 1. Add affiliation column ─────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS affiliation TEXT DEFAULT NULL;

-- ── 2. Allow authenticated users to insert their own profile ──
-- (used by self-registration flow after Clerk signup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = '用户可创建自己的档案'
  ) THEN
    CREATE POLICY "用户可创建自己的档案" ON profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;
