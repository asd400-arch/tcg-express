-- Dispute enhancements: evidence photos, party-based settlement proposals
ALTER TABLE express_disputes ADD COLUMN IF NOT EXISTS evidence_photos JSONB DEFAULT '[]';
ALTER TABLE express_disputes ADD COLUMN IF NOT EXISTS proposed_amount NUMERIC(10,2);
ALTER TABLE express_disputes ADD COLUMN IF NOT EXISTS proposed_by UUID;
ALTER TABLE express_disputes ADD COLUMN IF NOT EXISTS proposed_resolution TEXT;
ALTER TABLE express_disputes ADD COLUMN IF NOT EXISTS resolution_type TEXT;
ALTER TABLE express_disputes ADD COLUMN IF NOT EXISTS resolved_amount NUMERIC(10,2);
