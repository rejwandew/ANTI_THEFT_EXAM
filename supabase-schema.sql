-- ====================================================================
-- Anti-Cheat Online Exam - Supabase Database Schema
-- Table: exam_attempts
-- Purpose: Real-time Multi-browser Lock, Attempt Tracking & Score Records
-- ====================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_number TEXT NOT NULL UNIQUE,
    student_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('STARTED', 'SUBMITTED')),
    score INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 20,
    violation_reason TEXT,
    time_taken_seconds INTEGER DEFAULT 0,
    fingerprint TEXT,
    payload JSONB,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index on roll_number for fast lookup across browsers
CREATE INDEX IF NOT EXISTS idx_exam_attempts_roll ON public.exam_attempts (roll_number);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Allow anyone with the Supabase anon key to query attempt by roll_number
CREATE POLICY "Allow public read access to check attempt status"
    ON public.exam_attempts
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 5. RLS Policy: Allow public insert for exam start or submission
CREATE POLICY "Allow public insert for exam attempt"
    ON public.exam_attempts
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 6. RLS Policy: Allow public update to finalize submission
CREATE POLICY "Allow public update for exam finalization"
    ON public.exam_attempts
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ====================================================================
-- How to connect with the frontend:
-- 1. In Supabase Dashboard -> Project Settings -> API:
--    Copy 'Project URL' and 'Project API keys (anon public)'.
-- 2. Open 'js/storage.js' and set:
--    CLOUD_CONFIG.enabled = true;
--    CLOUD_CONFIG.supabaseUrl = "https://your-project-id.supabase.co";
--    CLOUD_CONFIG.supabaseAnonKey = "your-anon-public-key";
-- ====================================================================
