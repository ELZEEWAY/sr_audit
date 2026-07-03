-- =========================================================================
-- PostgreSQL UPSERT Queries for Offline Synchronization
-- =========================================================================
-- These queries use the 'ON CONFLICT (id) DO UPDATE' syntax to handle data pushes.
-- If a record with the same ID already exists, it updates the record's details.
-- Otherwise, it inserts the record as a new row.
--
-- NOTE: In your existing schema, 'id' columns set to 'SERIAL' (auto-incrementing integers)
-- must be changed to 'VARCHAR(50)' or 'UUID' to allow client-side generated UUID strings.
-- Example Migration:
-- ALTER TABLE inventory_items ALTER COLUMN id TYPE VARCHAR(50);
-- =========================================================================

-- 1. Inventory Items Table UPSERT Statement
INSERT INTO inventory_items (
    id, 
    item_name, 
    serial_number, 
    classification, 
    qty, 
    condition, 
    custodian, 
    barangay_id, 
    last_updated
) VALUES (
    $1, -- id (UUID string generated on client)
    $2, -- item_name
    $3, -- serial_number
    $4, -- classification
    $5, -- qty
    $6, -- condition
    $7, -- custodian
    $8, -- barangay_id
    $9  -- last_updated (timestamp)
)
ON CONFLICT (id) 
DO UPDATE SET 
    item_name = EXCLUDED.item_name,
    serial_number = EXCLUDED.serial_number,
    classification = EXCLUDED.classification,
    qty = EXCLUDED.qty,
    condition = EXCLUDED.condition,
    custodian = EXCLUDED.custodian,
    barangay_id = EXCLUDED.barangay_id,
    last_updated = EXCLUDED.last_updated;


-- 2. Financial Records Table UPSERT Statement
-- Assumes a corresponding 'financial_records' table exists.
INSERT INTO financial_records (
    id,
    barangay_id,
    budget_amount,
    bond_amount,
    bank_amount,
    last_updated
) VALUES (
    $1, -- id (UUID string)
    $2, -- barangay_id
    $3, -- budget_amount
    $4, -- bond_amount
    $5, -- bank_amount
    $6  -- last_updated (timestamp)
)
ON CONFLICT (id)
DO UPDATE SET
    barangay_id = EXCLUDED.barangay_id,
    budget_amount = EXCLUDED.budget_amount,
    bond_amount = EXCLUDED.bond_amount,
    bank_amount = EXCLUDED.bank_amount,
    last_updated = EXCLUDED.last_updated;


-- 3. Documents Table UPSERT Statement
-- Assumes a corresponding 'documents' table exists.
INSERT INTO documents (
    id,
    barangay_id,
    category,
    title,
    last_updated
) VALUES (
    $1, -- id (UUID string)
    $2, -- barangay_id
    $3, -- category
    $4, -- title
    $5  -- last_updated (timestamp)
)
ON CONFLICT (id)
DO UPDATE SET
    barangay_id = EXCLUDED.barangay_id,
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    last_updated = EXCLUDED.last_updated;
