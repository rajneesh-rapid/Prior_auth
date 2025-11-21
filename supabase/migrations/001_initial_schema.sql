-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id TEXT UNIQUE NOT NULL,
  patient_name TEXT NOT NULL,
  date_of_service DATE NOT NULL,
  total_amt NUMERIC(12, 2) NOT NULL,
  accepted_amt NUMERIC(12, 2) NOT NULL DEFAULT 0,
  denied_amt NUMERIC(12, 2) NOT NULL DEFAULT 0,
  approval_status TEXT,
  approval_reason TEXT,
  query_reason TEXT,
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create claim_items table
CREATE TABLE IF NOT EXISTS claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  procedure TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  approved_amt NUMERIC(12, 2),
  qty INTEGER NOT NULL,
  status TEXT,
  approval_status TEXT,
  query_reason TEXT,
  reason TEXT,
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason_history JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create claim_documents table
CREATE TABLE IF NOT EXISTS claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  upload_date DATE NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chart_configurations table
CREATE TABLE IF NOT EXISTS chart_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_type TEXT NOT NULL,
  config JSONB NOT NULL,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_claims_claim_id ON claims(claim_id);
CREATE INDEX IF NOT EXISTS idx_claims_date_of_service ON claims(date_of_service);
CREATE INDEX IF NOT EXISTS idx_claims_approval_status ON claims(approval_status);
CREATE INDEX IF NOT EXISTS idx_claim_items_claim_id ON claim_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_items_item_code ON claim_items(item_code);
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_chart_configurations_chart_type ON chart_configurations(chart_type);
CREATE INDEX IF NOT EXISTS idx_chart_configurations_user_id ON chart_configurations(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claim_items_updated_at
  BEFORE UPDATE ON claim_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chart_configurations_updated_at
  BEFORE UPDATE ON chart_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) - Allow all operations for now
-- You can customize these policies based on your authentication needs
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on claims" ON claims
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on claim_items" ON claim_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on claim_documents" ON claim_documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on chart_configurations" ON chart_configurations
  FOR ALL USING (true) WITH CHECK (true);

