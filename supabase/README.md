# Supabase Database Setup

This folder contains the SQL schema for the Ipon-Ipon App database.

## Setup Instructions

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the Schema**
   - Open `schema.sql` file
   - Copy all the contents
   - Paste into the SQL Editor

4. **Run the Query**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for the query to complete successfully

5. **Verify the Tables**
   - Go to "Table Editor" in the left sidebar
   - You should see these tables:
     - `savings_accounts`
     - `savings_entries`
     - `borrowers`
     - `loan_payments`

## What the Schema Creates

### Tables
- **savings_accounts**: Stores savings accounts for each person
- **savings_entries**: Individual savings transactions
- **borrowers**: Loan/borrower information
- **loan_payments**: Payment transactions for loans

### Security (RLS)
- Row Level Security (RLS) is enabled on all tables
- Users can only access their own data
- Policies ensure data isolation between users

### Automatic Features
- `total_savings` is automatically calculated from entries
- `total_paid` is automatically calculated from loan payments
- `updated_at` timestamps are automatically updated

## Notes

- The schema uses UUIDs for all primary keys
- All tables are linked to `auth.users` via `user_id`
- Foreign key constraints ensure data integrity
- Indexes are created for better query performance

