    -- =========================================================================
    -- Santa Rosa Barangay Audit System PostgreSQL Database Setup
    -- =========================================================================

    -- Create custom enum type for modules & roles
    CREATE TYPE module_type AS ENUM ('inventory', 'financial', 'documents', 'all');
    CREATE TYPE user_role AS ENUM ('user', 'admin');

    -- 1. Create Barangays Table
    CREATE TABLE barangays (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        district_zone VARCHAR(50) NOT NULL
    );

    -- 2. Create Users Table (Secure authentication structure)
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, -- Stored as bcrypt / argon2 hash
        barangay_id INT REFERENCES barangays(id) ON DELETE SET NULL, -- NULL for DILG Global Admin
        authorized_module module_type NOT NULL,
        role user_role NOT NULL DEFAULT 'user'
    );

    -- 3. Create Inventory Items Table (Multi-tenant)
    CREATE TABLE inventory_items (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(150) NOT NULL,
        serial_number VARCHAR(100),
        classification VARCHAR(100) NOT NULL,
        qty INT NOT NULL CHECK (qty >= 0),
        condition VARCHAR(50) NOT NULL,
        custodian VARCHAR(150),
        barangay_id INT NOT NULL REFERENCES barangays(id) ON DELETE CASCADE,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Create Audit Comparisons Table (Admin dashboard snapshots & logs)
    CREATE TABLE audit_comparisons (
        id SERIAL PRIMARY KEY,
        snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        barangay_id INT REFERENCES barangays(id) ON DELETE CASCADE,
        total_items INT NOT NULL,
        good_condition_count INT NOT NULL,
        damaged_condition_count INT NOT NULL,
        logged_by_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT
    );

    -- =========================================================================
    -- SECURITY & TENANT ISOLATION CONFIGURATION (ROW-LEVEL SECURITY)
    -- =========================================================================

    -- Enable Row-Level Security on tenant tables
    ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;

    -- Policy for Users table: Users can read only their own details; Admins can read all.
    CREATE POLICY user_tenant_isolation_policy ON users
        FOR ALL
        USING (
            (current_setting('app.current_user_role', true) = 'admin') OR
            (username = current_user)
        );

    -- Policy for Inventory table: 
    -- 1. If user is 'admin', allow ALL actions across all barangays.
    -- 2. If user is a standard barangay user, they can only view/modify if their barangay_id matches.
    CREATE POLICY inventory_tenant_isolation_policy ON inventory_items
        FOR ALL
        USING (
            (current_setting('app.current_user_role', true) = 'admin') OR
            (barangay_id = NULLIF(current_setting('app.current_barangay_id', true), '')::integer)
        );

    -- =========================================================================
    -- SEED INITIAL SYSTEM DATA
    -- =========================================================================

    -- Seed Santa Rosa Barangays
    INSERT INTO barangays (id, name, district_zone) VALUES
    (1, 'Aplaya', 'Zone 1'),
    (2, 'Balibago', 'Zone 1'),
    (3, 'Caingin', 'Zone 1'),
    (4, 'Dila', 'Zone 2'),
    (5, 'Dita', 'Zone 2'),
    (6, 'Don Jose', 'Zone 3'),
    (7, 'Ibaba', 'Zone 1'),
    (8, 'Kanluran', 'Zone 1'),
    (9, 'Labas', 'Zone 2'),
    (10, 'Macabling', 'Zone 2'),
    (11, 'Malitlit', 'Zone 3'),
    (12, 'Malusak', 'Zone 1'),
    (13, 'Market Area', 'Zone 1'),
    (14, 'Pooc (Pook)', 'Zone 2'),
    (15, 'Pulong Santa Cruz', 'Zone 3'),
    (16, 'Santo Domingo', 'Zone 3'),
    (17, 'Sinalhan', 'Zone 1'),
    (18, 'Tagapo', 'Zone 2');

    -- Seed Users for the four core security roles (Plaintext passwords match server query validation)
    INSERT INTO users (username, password_hash, barangay_id, authorized_module, role) VALUES
    ('dilgadmin', 'dilgadmin_2026', NULL, 'all', 'admin'),
    ('dilginventory', 'dilginventory_2026', 1, 'inventory', 'user'),
    ('dilfinancial', 'dilfinancial_2026', 1, 'financial', 'user'),
    ('dilgdocument', 'dilgdocument_2026', 1, 'documents', 'user');
