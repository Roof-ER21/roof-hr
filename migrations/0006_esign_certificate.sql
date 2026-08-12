-- ESIGN/UETA audit-certificate fields on employee_contracts:
-- affirmative consent-to-e-sign, signer user agent, tamper-evident document
-- hashes, and the certificate-of-completion record itself.

ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS consent_to_esign BOOLEAN;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS signature_user_agent TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE employee_contracts ADD COLUMN IF NOT EXISTS esign_certificate JSONB;
