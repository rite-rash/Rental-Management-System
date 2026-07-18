DROP TABLE IF EXISTS utility_bills CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS leases CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS property_address CASCADE;
DROP TABLE IF EXISTS tenant_phone_numbers CASCADE; 
DROP TABLE IF EXISTS tenant_occupations CASCADE; 
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS property_bills CASCADE;
DROP TABLE IF EXISTS property_documents CASCADE;

DROP TYPE IF EXISTS room_type_options CASCADE;
DROP TYPE IF EXISTS lease_status_options CASCADE;
DROP TYPE IF EXISTS payment_status_options CASCADE;
DROP TYPE IF EXISTS contact_number_provider_options CASCADE;

CREATE TYPE room_type_options AS ENUM ('Studio', '1-bedroom');
CREATE TYPE lease_status_options AS ENUM('pending', 'active', 'terminated', 'complete', 'cancelled', 'breached');
CREATE TYPE payment_status_options AS ENUM('unpaid', 'paid', 'overdue');
CREATE TYPE contact_number_provider_options AS ENUM('not specified','smart', 'globe', 'TNT', 'sun', 'DITO', 'GOMO');


CREATE TABLE tenants (
    tenant_id SERIAL PRIMARY KEY,
    tenant_name TEXT NOT NULL,
    id_picture TEXT NULL
);

CREATE TABLE tenant_phone_numbers (
    phone_id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL, 
    phone_number VARCHAR(20) NOT NULL,
    provider contact_number_provider_options NOT NULL DEFAULT 'not specified',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_phone_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE TABLE tenant_occupations (
    occupation_id SERIAL PRIMARY KEY,
    tenant_id INT UNIQUE NOT NULL, 
    occupation_name VARCHAR(30) NOT NULL DEFAULT 'not specified',
    occupation_company VARCHAR(50) DEFAULT 'not specified',
    CONSTRAINT fk_occupation_tenant FOREIGN KEY (tenant_id) 
        REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE TABLE property_address (
    address_id SERIAL PRIMARY KEY,
    property_postal_code TEXT,
    property_city_name TEXT,
    property_street_name TEXT,
    property_block_number INT,
    property_lot_number INT
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    user_role VARCHAR(10) DEFAULT 'guest' NOT NULL
);

CREATE TABLE properties (
    property_id SERIAL PRIMARY KEY,
    property_name TEXT,
    address_id INT NOT NULL,
    CONSTRAINT fk_property_address FOREIGN KEY (address_id) 
        REFERENCES property_address(address_id) ON DELETE CASCADE
);

CREATE TABLE property_documents (
    document_id SERIAL PRIMARY KEY,
    property_id INT NOT NULL,
    document_name VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATE,
    CONSTRAINT fk_document_property FOREIGN KEY (property_id)   
        REFERENCES properties(property_id) ON DELETE CASCADE
);

CREATE TABLE property_bills (
    property_bill_id SERIAL PRIMARY KEY,
    property_id INT NOT NULL,
    bill_name VARCHAR(100) NOT NULL,
    amount_due NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_at DATE NOT NULL
    is_paid BOOLEAN not null DEFAULT FALSE,
    receipt_url TEXT,
    CONSTRAINT check_bill_amount CHECK (amount_due >= 0),
    CONSTRAINT fk_bill_property FOREIGN KEY (property_id) 
        REFERENCES properties(property_id) ON DELETE CASCADE
);


CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    room_number VARCHAR(10),
    room_type room_type_options NOT NULL,
    price NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    property_id INT NOT NULL,
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT fk_room_property FOREIGN KEY (property_id) 
        REFERENCES properties(property_id) ON DELETE CASCADE
);

CREATE TABLE leases (
    lease_id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    room_id INT NOT NULL,
    lease_amount NUMERIC(10, 2),
    lease_start DATE NOT NULL,
    lease_end DATE NOT NULL,
    notice_given_date DATE,
    lease_status lease_status_options NOT NULL DEFAULT 'pending',
    CONSTRAINT fk_lease_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT fk_lease_room FOREIGN KEY (room_id)
        REFERENCES rooms(room_id) ON DELETE CASCADE,
    CONSTRAINT check_lease_dates CHECK (lease_end > lease_start)
);

CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    lease_id INT NOT NULL,
    amount_due NUMERIC(10,2),
    amount_paid NUMERIC(10,2) DEFAULT 0.00,
    custom_penalty NUMERIC(10, 2) DEFAULT 0.00,
    LANDLORD_NOTES text,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    payment_status payment_status_options NOT NULL DEFAULT 'unpaid',
    CONSTRAINT fk_payment_lease FOREIGN KEY (lease_id) 
        REFERENCES leases(lease_id) ON DELETE CASCADE
);


CREATE TABLE utility_bills (
    utility_bills_id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL,
    previous_kwh NUMERIC(10, 2) DEFAULT 0.00,
    current_kwh NUMERIC(10,2) DEFAULT 0.00,
    kwh_rate NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,

    water_consumption_cubic_meters NUMERIC(10,2) DEFAULT 0.00,
    water_rate_per_excess_cubic NUMERIC(10,2) NOT NULL DEFAULT 20.00,
    water_base_allowance_cubic NUMERIC(10,2) NOT NULL DEFAULT 10.00,
    water_base_flat_fee NUMERIC(10,2) NOT NULL DEFAULT 200.00,
    water_total NUMERIC(10,2) NOT NULL,

    misc_utility_fee NUMERIC(10,2) NOT NULL DEFAULT 75.00,

    CONSTRAINT fk_utility_payment FOREIGN KEY (payment_id) 
        REFERENCES payments(payment_id) ON DELETE CASCADE
);
