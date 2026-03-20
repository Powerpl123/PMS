-- =====================================================
-- PMS: Restrict profiles table — only admins can modify
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- =====================================================

-- 1. Drop existing open policy on profiles
DROP POLICY IF EXISTS "Allow all access" ON profiles;
DROP POLICY IF EXISTS "Authenticated users full access" ON profiles;

-- 2. Everyone can READ profiles (needed for displaying user names, assignments, etc.)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- 3. Users can UPDATE their own profile (name, phone, department — NOT role or active)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND active = (SELECT active FROM profiles WHERE id = auth.uid())
  );

-- 4. Only admins can INSERT new profiles
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 5. Only admins can UPDATE any profile (including role & active changes)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 6. Only admins can DELETE profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- =====================================================
-- IMPORTANT: First-time signup exception
-- When a new user signs up, they need to create their own profile.
-- This policy allows inserting a row where id matches auth.uid()
-- (i.e., users can only create their OWN profile during signup)
-- =====================================================
CREATE POLICY "Users can create own profile on signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- Done! Now only admins can add/edit/delete other users.
-- Regular users can only read profiles and update their
-- own non-sensitive fields (name, phone, department).
-- =====================================================
