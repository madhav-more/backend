-- PostgreSQL Schema for G.U.R.U POS Backend

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to auto-update updated_at for users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(255),
  sku VARCHAR(255),
  price DECIMAL(10, 2) DEFAULT 0.00,
  unit VARCHAR(50),
  inventory_qty DECIMAL(10, 3) DEFAULT 0.000,
  category VARCHAR(100),
  recommended BOOLEAN DEFAULT FALSE,
  image_path VARCHAR(255),
  idempotency_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_user_updated ON items(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_items_idempotency ON items(user_id, idempotency_key);

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  idempotency_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_user_updated ON customers(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_idempotency ON customers(user_id, idempotency_key);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36),
  voucher_number VARCHAR(50),
  provisional_voucher VARCHAR(50),
  date TIMESTAMP,
  subtotal DECIMAL(10, 2) DEFAULT 0.00,
  tax DECIMAL(10, 2) DEFAULT 0.00,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  other_charges DECIMAL(10, 2) DEFAULT 0.00,
  grand_total DECIMAL(10, 2) DEFAULT 0.00,
  item_count INT DEFAULT 0,
  unit_count DECIMAL(10, 3) DEFAULT 0.000,
  payment_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'completed',
  receipt_path VARCHAR(255),
  idempotency_key VARCHAR(255),
  line_items TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_updated ON transactions(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_transactions_voucher ON transactions(user_id, voucher_number);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(user_id, idempotency_key);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS token_blacklist (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_expires ON token_blacklist(expires_at);
