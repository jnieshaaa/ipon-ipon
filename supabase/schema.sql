-- ============================================
-- Ipon-Ipon App Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Savings Accounts Table
-- ============================================
-- Stores savings accounts for each person
CREATE TABLE IF NOT EXISTS savings_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  unique_id VARCHAR(100) NOT NULL,
  total_savings DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unique_id)
);

-- ============================================
-- 2. Savings Entries Table
-- ============================================
-- Stores individual savings transactions/entries
CREATE TABLE IF NOT EXISTS savings_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  savings_account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  week_range VARCHAR(100),
  amount_paid DECIMAL(10, 2) NOT NULL,
  entry_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Borrowers Table
-- ============================================
-- Stores loan/borrower information
CREATE TABLE IF NOT EXISTS borrowers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  unique_id VARCHAR(100) NOT NULL,
  borrowed_amount DECIMAL(10, 2) NOT NULL,
  borrow_date DATE NOT NULL,
  interest_rate DECIMAL(5, 2) DEFAULT 5.00, -- Percentage per month
  total_paid DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Loan Payments Table
-- ============================================
-- Stores payment transactions for loans
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_savings_accounts_user_id ON savings_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_group_id ON savings_accounts(group_id);
CREATE INDEX IF NOT EXISTS idx_savings_entries_account_id ON savings_entries(savings_account_id);
CREATE INDEX IF NOT EXISTS idx_savings_entries_date ON savings_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_borrowers_user_id ON borrowers(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_status ON borrowers(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_borrower_id ON loan_payments(borrower_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Enable RLS on all tables
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can view savings accounts
CREATE POLICY "Authenticated users can view savings accounts"
  ON savings_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only group creators (leaders) can manage savings accounts in their group
CREATE POLICY "Group leaders can create savings accounts"
  ON savings_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = savings_accounts.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can update savings accounts"
  ON savings_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = savings_accounts.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can delete savings accounts"
  ON savings_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = savings_accounts.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

-- Savings Entries policies
-- Anyone authenticated can view entries
CREATE POLICY "Authenticated users can view savings entries"
  ON savings_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only group creators (leaders) can manage entries
CREATE POLICY "Group leaders can insert savings entries"
  ON savings_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_accounts
      JOIN savings_groups ON savings_groups.id = savings_accounts.group_id
      WHERE savings_accounts.id = savings_entries.savings_account_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can update savings entries"
  ON savings_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_accounts
      JOIN savings_groups ON savings_groups.id = savings_accounts.group_id
      WHERE savings_accounts.id = savings_entries.savings_account_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can delete savings entries"
  ON savings_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM savings_accounts
      JOIN savings_groups ON savings_groups.id = savings_accounts.group_id
      WHERE savings_accounts.id = savings_entries.savings_account_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

-- Borrowers policies
CREATE POLICY "Users can view their own borrowers"
  ON borrowers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own borrowers"
  ON borrowers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own borrowers"
  ON borrowers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own borrowers"
  ON borrowers FOR DELETE
  USING (auth.uid() = user_id);

-- Loan Payments policies
CREATE POLICY "Users can view their own loan payments"
  ON loan_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM borrowers
      WHERE borrowers.id = loan_payments.borrower_id
      AND borrowers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own loan payments"
  ON loan_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM borrowers
      WHERE borrowers.id = loan_payments.borrower_id
      AND borrowers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own loan payments"
  ON loan_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM borrowers
      WHERE borrowers.id = loan_payments.borrower_id
      AND borrowers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own loan payments"
  ON loan_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM borrowers
      WHERE borrowers.id = loan_payments.borrower_id
      AND borrowers.user_id = auth.uid()
    )
  );

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_savings_accounts_updated_at
  BEFORE UPDATE ON savings_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_savings_entries_updated_at
  BEFORE UPDATE ON savings_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_borrowers_updated_at
  BEFORE UPDATE ON borrowers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update total_savings when entries change
CREATE OR REPLACE FUNCTION update_savings_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE savings_accounts
  SET total_savings = (
    SELECT COALESCE(SUM(amount_paid), 0)
    FROM savings_entries
    WHERE savings_account_id = COALESCE(NEW.savings_account_id, OLD.savings_account_id)
  )
  WHERE id = COALESCE(NEW.savings_account_id, OLD.savings_account_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update total_savings
CREATE TRIGGER update_total_savings_on_insert
  AFTER INSERT ON savings_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_savings_total();

CREATE TRIGGER update_total_savings_on_update
  AFTER UPDATE ON savings_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_savings_total();

CREATE TRIGGER update_total_savings_on_delete
  AFTER DELETE ON savings_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_savings_total();

-- Function to automatically update borrower's total_paid
CREATE OR REPLACE FUNCTION update_borrower_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE borrowers
  SET total_paid = (
    SELECT COALESCE(SUM(amount), 0)
    FROM loan_payments
    WHERE borrower_id = COALESCE(NEW.borrower_id, OLD.borrower_id)
  )
  WHERE id = COALESCE(NEW.borrower_id, OLD.borrower_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update total_paid
CREATE TRIGGER update_total_paid_on_insert
  AFTER INSERT ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_borrower_total_paid();

CREATE TRIGGER update_total_paid_on_update
  AFTER UPDATE ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_borrower_total_paid();

CREATE TRIGGER update_total_paid_on_delete
  AFTER DELETE ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_borrower_total_paid();


-- ============================================
-- 5. Public Users Table
-- ============================================
-- Stores custom profile information for users, linked to auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to users"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Allow users to update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Trigger function to automatically insert new user profiles from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function when a user is created in auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- 6. Savings Groups Table
-- ============================================
CREATE TABLE IF NOT EXISTS savings_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_code VARCHAR(6) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  cycle_year VARCHAR(4) NOT NULL,
  weekly_amount DECIMAL(10, 2) NOT NULL,
  payment_due VARCHAR(50) NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. Group Members Table
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES savings_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  members_code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_savings_groups_creator ON savings_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_code ON group_members(members_code);

-- Enable RLS
ALTER TABLE savings_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies
-- Anyone authenticated can view groups
CREATE POLICY "Authenticated users can view groups"
  ON savings_groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert groups
CREATE POLICY "Authenticated users can create groups"
  ON savings_groups FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Group creators can update their groups
CREATE POLICY "Creators can update their groups"
  ON savings_groups FOR UPDATE
  USING (auth.uid() = creator_id);

-- Group creators can delete their groups
CREATE POLICY "Creators can delete their groups"
  ON savings_groups FOR DELETE
  USING (auth.uid() = creator_id);

-- group_members Policies:
-- Anyone authenticated can view memberships
CREATE POLICY "Authenticated users can view memberships"
  ON group_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can join a group if they are authenticated
CREATE POLICY "Users can join a group"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Leaders can approve/update join requests
CREATE POLICY "Group leaders can update memberships"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = group_members.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

-- Leaders or members can delete/remove memberships
CREATE POLICY "Group leaders can delete memberships"
  ON group_members FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = group_members.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

-- Trigger to automatically update updated_at for savings_groups
CREATE TRIGGER update_savings_groups_updated_at
  BEFORE UPDATE ON savings_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Hiram/Loans Database Schema Migrations
-- ============================================
-- Alter borrowers table schema to allow guest users and group relationships
ALTER TABLE borrowers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS interest_type VARCHAR(20) DEFAULT 'percentage' CHECK (interest_type IN ('percentage', 'fixed'));
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS interest_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (interest_frequency IN ('weekly', 'monthly'));

-- Drop old restrict-to-self policies
DROP POLICY IF EXISTS "Users can view their own borrowers" ON borrowers;
DROP POLICY IF EXISTS "Users can insert their own borrowers" ON borrowers;
DROP POLICY IF EXISTS "Users can update their own borrowers" ON borrowers;
DROP POLICY IF EXISTS "Users can delete their own borrowers" ON borrowers;
DROP POLICY IF EXISTS "Users can view their own loan payments" ON loan_payments;
DROP POLICY IF EXISTS "Users can insert their own loan payments" ON loan_payments;
DROP POLICY IF EXISTS "Users can update their own loan payments" ON loan_payments;
DROP POLICY IF EXISTS "Users can delete their own loan payments" ON loan_payments;

-- Create group-aware RLS policies
CREATE POLICY "Members and leaders can view borrowers"
  ON borrowers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = borrowers.group_id
      AND savings_groups.creator_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = borrowers.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.approved = true
    )
  );

CREATE POLICY "Group leaders can insert borrowers"
  ON borrowers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = borrowers.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can update borrowers"
  ON borrowers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = borrowers.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Group leaders can delete borrowers"
  ON borrowers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM savings_groups
      WHERE savings_groups.id = borrowers.group_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

CREATE POLICY "Members and leaders can view loan payments"
  ON loan_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM borrowers
      JOIN savings_groups ON savings_groups.id = borrowers.group_id
      WHERE borrowers.id = loan_payments.borrower_id
      AND (
        savings_groups.creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM group_members
          WHERE group_members.group_id = borrowers.group_id
          AND group_members.user_id = auth.uid()
          AND group_members.approved = true
        )
      )
    )
  );

CREATE POLICY "Group leaders can manage loan payments"
  ON loan_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM borrowers
      JOIN savings_groups ON savings_groups.id = borrowers.group_id
      WHERE borrowers.id = loan_payments.borrower_id
      AND savings_groups.creator_id = auth.uid()
    )
  );

-- ============================================
-- 11. Personal Loans Table (For tracking personal lent money)
-- ============================================
CREATE TABLE IF NOT EXISTS personal_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  borrower_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) DEFAULT 0.00,
  borrow_date DATE NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid')),
  type VARCHAR(20) DEFAULT 'lent' CHECK (type IN ('lent', 'borrowed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. Personal Loan Payments Table
-- ============================================
CREATE TABLE IF NOT EXISTS personal_loan_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personal_loan_id UUID NOT NULL REFERENCES personal_loans(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE personal_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_loan_payments ENABLE ROW LEVEL SECURITY;

-- Policies for Personal Loans
CREATE POLICY "Users can manage their own personal loans"
  ON personal_loans FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage payments for their own personal loans"
  ON personal_loan_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM personal_loans
      WHERE personal_loans.id = personal_loan_payments.personal_loan_id
        AND personal_loans.user_id = auth.uid()
    )
  );
