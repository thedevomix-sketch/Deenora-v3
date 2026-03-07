-- Voice Broadcast Module Schema

-- 1. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    balance NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(institution_id)
);

-- 2. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('recharge', 'deduction')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Voice Templates Table
CREATE TABLE IF NOT EXISTS voice_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    provider_voice_id VARCHAR(255),
    duration INTEGER, -- in seconds
    provider_status VARCHAR(20) DEFAULT 'pending' CHECK (provider_status IN ('pending', 'approved', 'rejected')),
    admin_status VARCHAR(20) DEFAULT 'pending' CHECK (admin_status IN ('pending', 'approved', 'rejected')),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Voice Broadcasts Table
CREATE TABLE IF NOT EXISTS voice_broadcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    voice_template_id UUID REFERENCES voice_templates(id) ON DELETE CASCADE,
    target_type VARCHAR(50) CHECK (target_type IN ('students', 'guardians', 'custom')),
    total_numbers INTEGER DEFAULT 0,
    estimated_cost NUMERIC(10, 2) DEFAULT 0.00,
    provider_campaign_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Voice Call Logs Table
CREATE TABLE IF NOT EXISTS voice_call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    broadcast_id UUID REFERENCES voice_broadcasts(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    call_status VARCHAR(50),
    call_duration INTEGER,
    provider_call_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_call_logs ENABLE ROW LEVEL SECURITY;

-- Wallets RLS
CREATE POLICY "Institutions can view their own wallet" ON wallets
    FOR SELECT USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));

-- Wallet Transactions RLS
CREATE POLICY "Institutions can view their own wallet transactions" ON wallet_transactions
    FOR SELECT USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));

-- Voice Templates RLS
CREATE POLICY "Institutions can view their own voice templates" ON voice_templates
    FOR SELECT USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));
CREATE POLICY "Institutions can insert their own voice templates" ON voice_templates
    FOR INSERT WITH CHECK (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));
CREATE POLICY "Institutions can update their own voice templates" ON voice_templates
    FOR UPDATE USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));
CREATE POLICY "Institutions can delete their own voice templates" ON voice_templates
    FOR DELETE USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));

-- Voice Broadcasts RLS
CREATE POLICY "Institutions can view their own voice broadcasts" ON voice_broadcasts
    FOR SELECT USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));
CREATE POLICY "Institutions can insert their own voice broadcasts" ON voice_broadcasts
    FOR INSERT WITH CHECK (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));

-- Voice Call Logs RLS
CREATE POLICY "Institutions can view their own voice call logs" ON voice_call_logs
    FOR SELECT USING (institution_id IN (
        SELECT institution_id FROM profiles WHERE id = auth.uid()
    ));

-- Function to create wallet on institution creation
CREATE OR REPLACE FUNCTION create_wallet_for_new_institution()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (institution_id, balance) VALUES (NEW.id, 0.00);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create wallet when a new institution is created
DROP TRIGGER IF EXISTS on_institution_created_create_wallet ON institutions;
CREATE TRIGGER on_institution_created_create_wallet
AFTER INSERT ON institutions
FOR EACH ROW EXECUTE FUNCTION create_wallet_for_new_institution();

-- Function to deduct balance when broadcast is created
CREATE OR REPLACE FUNCTION deduct_wallet_balance_for_broadcast()
RETURNS TRIGGER AS $$
DECLARE
    current_balance NUMERIC;
BEGIN
    -- Get current balance
    SELECT balance INTO current_balance FROM wallets WHERE institution_id = NEW.institution_id;
    
    -- Check if sufficient balance
    IF current_balance < NEW.estimated_cost THEN
        RAISE EXCEPTION 'Insufficient wallet balance for this broadcast.';
    END IF;
    
    -- Deduct balance
    UPDATE wallets SET balance = balance - NEW.estimated_cost WHERE institution_id = NEW.institution_id;
    
    -- Record transaction
    INSERT INTO wallet_transactions (institution_id, amount, type, description)
    VALUES (NEW.institution_id, NEW.estimated_cost, 'deduction', 'Voice Broadcast Cost - ' || NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to deduct balance before broadcast creation
DROP TRIGGER IF EXISTS before_voice_broadcast_insert ON voice_broadcasts;
CREATE TRIGGER before_voice_broadcast_insert
BEFORE INSERT ON voice_broadcasts
FOR EACH ROW EXECUTE FUNCTION deduct_wallet_balance_for_broadcast();
