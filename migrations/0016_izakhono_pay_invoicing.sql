-- IZAKHONO PAY invoicing engine
CREATE TABLE IF NOT EXISTS pay_customers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  external_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pay_customers_merchant ON pay_customers(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_customers_email ON pay_customers(merchant_id, email);

CREATE TABLE IF NOT EXISTS pay_invoices (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  customer_id TEXT,
  invoice_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_paid','paid','overdue','void')),
  due_at TEXT,
  issued_at TEXT,
  paid_at TEXT,
  notes TEXT,
  payment_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(merchant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_pay_invoices_merchant ON pay_invoices(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_invoices_status ON pay_invoices(merchant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_pay_invoices_customer ON pay_invoices(merchant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pay_invoices_due ON pay_invoices(merchant_id, due_at);

CREATE TABLE IF NOT EXISTS pay_invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_amount REAL NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pay_invoice_items_invoice ON pay_invoice_items(invoice_id, created_at);

CREATE TABLE IF NOT EXISTS pay_invoice_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pay_invoice_events_invoice ON pay_invoice_events(invoice_id, created_at DESC);
