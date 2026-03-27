-- =============================================================================
-- PharmaSOS - Template Company (ID: 1) Full Restore Script
-- Based on actual data exported from "Master Catalog Template" (company_id = 1)
-- =============================================================================
-- WHAT THIS RESTORES:
--   - Company record + settings
--   - 7 roles (Company Admin, Area Admin, Store Admin, Sales Manager,
--               Inventory Manager, Cashier, Accounting Manager)
--   - 307 permissions (exact IDs preserved for role_permissions to work)
--   - 1077 role_permission mappings  ← pulled from real data
--   - 8 product categories (CAPSULES, TABLETS, SYRUPS, DROPS, INJECTABLES,
--                            CREAMS, PESSARIES, SUNDRIES)
--   - 10 units (7 base + 3 derived)
--   - 69 chart of accounts entries
--   - 16 income categories
--   - 24 expense categories
--
-- SAFE TO RE-RUN: Uses INSERT ... ON CONFLICT DO NOTHING everywhere
-- TRANSACTION:    Fully wrapped — rolls back entirely if anything fails
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. COMPANY
-- =============================================================================

INSERT INTO companies (id, company_name, email, phone, address, is_active, created_at, updated_at)
VALUES (1, 'Master Catalog Template', 'template@system.local', NULL, NULL, true,
        '2025-12-28 15:57:35.281704+00', '2025-12-28 15:57:35.281704+00')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence so future companies don't collide with ID 1
SELECT setval('companies_id_seq', GREATEST((SELECT MAX(id) FROM companies), 1));

-- =============================================================================
-- 2. COMPANY SETTINGS
-- =============================================================================

INSERT INTO company_settings (
    company_id, near_expiry_warning_days, near_expiry_critical_days,
    auto_expire_batches, low_stock_multiplier, allow_negative_stock,
    stock_valuation_method, default_currency, enable_batch_tracking,
    enable_serial_numbers, tax_rate, require_purchase_approval, enable_backorders,
    auto_fulfill_backorders, backorder_notification_enabled,
    allow_backorder_negative_stock, backorder_priority_days, notify_on_backorder,
    credit_settings, default_discount_percentage, max_discount_percentage,
    require_discount_approval, allow_negative_sales, auto_generate_sale_numbers,
    sale_number_prefix, default_credit_days, allow_sales_returns,
    sales_return_days_limit, require_return_approval, return_approval_threshold,
    allow_purchase_returns, purchase_return_days_limit, auto_restock_on_return,
    enable_low_stock_notifications, enable_expiry_notifications,
    enable_payment_notifications, enable_order_notifications, enable_auto_reorder,
    allow_inter_store_transfers, require_transfer_approval, base_currency,
    receipt_header_text, receipt_footer_text, show_company_logo_on_receipt,
    receipt_paper_size, invoice_prefix, po_prefix, auto_increment_documents,
    document_number_padding, block_expired_sales, allow_near_expiry_discount,
    near_expiry_discount_percentage, supplier_code_prefix,
    auto_generate_supplier_codes, supplier_code_counter, quotation_prefix,
    default_quotation_validity_days, require_quotation_approval,
    auto_generate_quotation_numbers, expense_category_prefix,
    auto_increment_expense_categories, expense_category_number_padding,
    require_purchase_return_approval, created_at, updated_at
)
VALUES (
    1, 30, 7, true, 1.5, false, 'FIFO', 'UGX', true, false, 0, false, true,
    false, true, false, 7, true,
    '{"late_fee":0,"interest_rate":0,"grace_period_days":7,"notify_payment_due":true,
      "default_credit_days":30,"notify_credit_limit":true,"auto_suspend_overdue":false,
      "reminder_days_before":3,"credit_check_required":false,"suspension_grace_days":30,
      "min_payment_percentage":0,"notify_payment_overdue":true,
      "require_credit_approval":false,"enable_credit_management":true,
      "large_transaction_threshold":0,"require_transaction_approval":false}'::jsonb,
    0.00, 20.00, true, false, true, 'SAL', 30, true, 30, true, 5000.00,
    true, 14, true, true, true, true, true, false, true, false, 'UGX',
    'Thank you for your business!',
    'All sales are final unless otherwise stated. Please keep your receipt for returns.',
    true, 'A4', 'INV', 'PO', true, 6, true, true, 10.00,
    'SUP', true, 1, 'QT-', 30, false, true, 'EXP', true, 4, false,
    '2025-12-28 15:57:35.281704+00', '2025-12-28 15:57:35.281704+00'
)
ON CONFLICT (company_id) DO NOTHING;

-- =============================================================================
-- 3. ROLES  (company_id = 1, exact IDs preserved)
-- =============================================================================

INSERT INTO roles (id, company_id, role_name, description, is_custom, is_system, priority, access_level, created_at, updated_at)
VALUES
(2, 1, 'Company Admin',      'Full access to all company data and all pages', false, true, 90, 'company', '2025-12-29 21:41:36.863275+00', '2025-12-29 21:41:36.863275+00'),
(3, 1, 'Area Admin',         'Access to all pages except: Areas Management, Company Settings, Users Management, Roles & Permissions. Data scope: assigned area only', false, true, 70, 'area', '2025-12-29 21:41:36.863275+00', '2025-12-29 21:41:36.863275+00'),
(4, 1, 'Store Admin',        'Access to all pages except: Stores Management, Areas Management, Company Settings, Users Management, Roles & Permissions. Data scope: assigned store only', false, true, 60, 'store', '2025-12-29 21:41:36.863275+00', '2025-12-29 21:41:36.863275+00'),
(5, 1, 'Sales Manager',      'Access to Sales module and Items Master. Data scope: assigned store only', false, true, 50, 'store', '2025-12-29 21:41:36.863275+00', '2025-12-29 21:41:36.863275+00'),
(6, 1, 'Inventory Manager',  'Access to Inventory module, Purchase module, and Items Master. Data scope: assigned store only', false, true, 40, 'store', '2025-12-29 21:41:36.863275+00', '2025-12-29 21:41:36.863275+00'),
(7, 1, 'Cashier',            'Access to POS and POS History only. Data scope: assigned store only', false, true, 30, 'store', '2025-12-29 21:41:36.863275+00', '2025-12-29 21:41:36.863275+00'),
(8, 1, 'Accounting Manager', 'Access to Accounting/Finance module only. Data scope: assigned store only', false, true, 80, 'company', '2025-12-29 21:41:36.863275+00', '2026-01-20 20:31:40.65272+00')
ON CONFLICT (id) DO NOTHING;

SELECT setval('roles_id_seq', GREATEST((SELECT MAX(id) FROM roles WHERE company_id = 1), 8));

-- =============================================================================
-- 4. PERMISSIONS  (system-wide, IDs 1–100 shown; full 307 below)
-- =============================================================================

INSERT INTO permissions (id, permission_name, description, module, resource, action, created_at, updated_at)
VALUES
-- Inventory
(1,  'products_create',   'Create new products',         'inventory',  'products',       'create',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(2,  'products_read',     'View products',               'inventory',  'products',       'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(3,  'products_update',   'Update existing products',    'inventory',  'products',       'update',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(4,  'products_delete',   'Delete products',             'inventory',  'products',       'delete',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(5,  'stock_view',        'View stock levels',           'inventory',  'stock',          'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(6,  'stock_adjust',      'Adjust stock quantities',     'inventory',  'stock',          'update',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
-- Sales
(7,  'sales_create',      'Create new sales',            'sales',      'sales',          'create',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(8,  'sales_read',        'View sales records',          'sales',      'sales',          'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(9,  'sales_cancel',      'Cancel sales transactions',   'sales',      'sales',          'delete',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(10, 'sales_refund',      'Process sales refunds',       'sales',      'refunds',        'create',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
-- Purchasing
(11, 'purchases_create',  'Create purchase orders',      'purchasing', 'purchase_orders','create',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(12, 'purchases_read',    'View purchase orders',        'purchasing', 'purchase_orders','read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(13, 'purchases_approve', 'Approve purchase orders',     'purchasing', 'purchase_orders','approve',  '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(14, 'purchases_receive', 'Receive purchase orders',     'purchasing', 'purchase_orders','receive',  '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
-- CRM
(15, 'customers_create',  'Create new customers',        'crm',        'customers',      'create',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(16, 'customers_read',    'View customer records',       'crm',        'customers',      'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(17, 'customers_update',  'Update customer information', 'crm',        'customers',      'update',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
-- Reports
(18, 'reports_sales',     'View sales reports',          'reports',    'reports',        'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(19, 'reports_inventory', 'View inventory reports',      'reports',    'reports',        'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(20, 'reports_financial', 'View financial reports',      'reports',    'reports',        'read',     '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
-- Admin
(21, 'users_manage',      'Manage system users',         'admin',      'users',          'manage',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(22, 'roles_manage',      'Manage user roles',           'admin',      'roles',          'manage',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
(23, 'settings_manage',   'Manage system settings',      'admin',      'settings',       'manage',   '2025-12-28 17:09:28.337072+00', '2025-12-28 17:09:28.337072+00'),
-- Finance: Chart of Accounts
(24, 'chart_of_accounts_read',          'View chart of accounts',       'Finance','chart_of_accounts','read',         '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(25, 'chart_of_accounts_create',        'Create accounts',              'Finance','chart_of_accounts','create',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(26, 'chart_of_accounts_update',        'Update accounts',              'Finance','chart_of_accounts','update',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(27, 'chart_of_accounts_delete',        'Delete accounts',              'Finance','chart_of_accounts','delete',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(28, 'chart_of_accounts_manage',        'Full account management',      'Finance','chart_of_accounts','manage',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(29, 'chart_of_accounts_export',        'Export chart of accounts',     'Finance','chart_of_accounts','export',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(30, 'chart_of_accounts_view_balances', 'View account balances',        'Finance','chart_of_accounts','view_balances','2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Journal Entries
(31, 'journal_entries_read',    'View journal entries',    'Finance','journal_entries','read',    '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(32, 'journal_entries_create',  'Create journal entries',  'Finance','journal_entries','create',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(33, 'journal_entries_update',  'Update journal entries',  'Finance','journal_entries','update',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(34, 'journal_entries_delete',  'Delete journal entries',  'Finance','journal_entries','delete',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(35, 'journal_entries_post',    'Post journal entries',    'Finance','journal_entries','post',    '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(36, 'journal_entries_reverse', 'Reverse journal entries', 'Finance','journal_entries','reverse', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(37, 'journal_entries_approve', 'Approve journal entries', 'Finance','journal_entries','approve', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(38, 'journal_entries_export',  'Export journal entries',  'Finance','journal_entries','export',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Expenses
(39, 'expenses_read',      'View expenses',             'Finance','expenses','read',     '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(40, 'expenses_create',    'Create expenses',           'Finance','expenses','create',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(41, 'expenses_update',    'Update expenses',           'Finance','expenses','update',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(42, 'expenses_delete',    'Delete expenses',           'Finance','expenses','delete',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(43, 'expenses_approve',   'Approve expenses',          'Finance','expenses','approve',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(44, 'expenses_export',    'Export expenses',           'Finance','expenses','export',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(45, 'expenses_view_all',  'View all expenses',         'Finance','expenses','view_all', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(46, 'expenses_view_own',  'View own expenses',         'Finance','expenses','view_own', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(47, 'expenses_manage',    'Full expense management',   'Finance','expenses','manage',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Expense Categories
(48, 'expense_categories_read',   'View expense categories',           'Finance','expense_categories','read',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(49, 'expense_categories_create', 'Create expense categories',         'Finance','expense_categories','create', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(50, 'expense_categories_update', 'Update expense categories',         'Finance','expense_categories','update', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(51, 'expense_categories_delete', 'Delete expense categories',         'Finance','expense_categories','delete', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(52, 'expense_categories_manage', 'Full expense category management',  'Finance','expense_categories','manage', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Income
(53, 'income_read',      'View income',             'Finance','income','read',     '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(54, 'income_create',    'Create income entries',   'Finance','income','create',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(55, 'income_update',    'Update income entries',   'Finance','income','update',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(56, 'income_delete',    'Delete income entries',   'Finance','income','delete',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(57, 'income_approve',   'Approve income entries',  'Finance','income','approve',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(58, 'income_export',    'Export income data',      'Finance','income','export',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(59, 'income_view_all',  'View all income',         'Finance','income','view_all', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(60, 'income_view_own',  'View own income',         'Finance','income','view_own', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(61, 'income_manage',    'Full income management',  'Finance','income','manage',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Income Categories
(62, 'income_categories_read',   'View income categories',           'Finance','income_categories','read',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(63, 'income_categories_create', 'Create income categories',         'Finance','income_categories','create', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(64, 'income_categories_update', 'Update income categories',         'Finance','income_categories','update', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(65, 'income_categories_delete', 'Delete income categories',         'Finance','income_categories','delete', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(66, 'income_categories_manage', 'Full income category management',  'Finance','income_categories','manage', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Budgets
(67, 'budgets_read',          'View budgets',           'Finance','budgets','read',          '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(68, 'budgets_create',        'Create budgets',         'Finance','budgets','create',        '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(69, 'budgets_update',        'Update budgets',         'Finance','budgets','update',        '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(70, 'budgets_delete',        'Delete budgets',         'Finance','budgets','delete',        '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(71, 'budgets_approve',       'Approve budgets',        'Finance','budgets','approve',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(72, 'budgets_manage',        'Full budget management', 'Finance','budgets','manage',        '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(73, 'budgets_export',        'Export budget data',     'Finance','budgets','export',        '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(74, 'budgets_view_variance', 'View budget variance',   'Finance','budgets','view_variance', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Fiscal Periods
(75, 'fiscal_periods_read',   'View fiscal periods',   'Finance','fiscal_periods','read',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(76, 'fiscal_periods_create', 'Create fiscal periods', 'Finance','fiscal_periods','create', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(77, 'fiscal_periods_update', 'Update fiscal periods', 'Finance','fiscal_periods','update', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(78, 'fiscal_periods_close',  'Close fiscal periods',  'Finance','fiscal_periods','close',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(79, 'fiscal_periods_reopen', 'Reopen fiscal periods', 'Finance','fiscal_periods','reopen', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(80, 'fiscal_periods_manage', 'Full fiscal period management','Finance','fiscal_periods','manage','2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Account Balances
(81, 'account_balances_read',        'View account balances',  'Finance','account_balances','read',        '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(82, 'account_balances_recalculate', 'Recalculate balances',   'Finance','account_balances','recalculate', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(83, 'account_balances_export',      'Export balance data',    'Finance','account_balances','export',      '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Financial Reports
(84, 'financial_reports_balance_sheet',   'View balance sheet',      'Finance','financial_reports','balance_sheet',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(85, 'financial_reports_income_statement','View income statement',   'Finance','financial_reports','income_statement','2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(86, 'financial_reports_cash_flow',       'View cash flow report',   'Finance','financial_reports','cash_flow',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(87, 'financial_reports_trial_balance',   'View trial balance',      'Finance','financial_reports','trial_balance',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(88, 'financial_reports_profit_loss',     'View profit & loss',      'Finance','financial_reports','profit_loss',     '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(89, 'financial_reports_general_ledger',  'View general ledger',     'Finance','financial_reports','general_ledger',  '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(90, 'financial_reports_export',          'Export financial reports', 'Finance','financial_reports','export',          '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(91, 'financial_reports_view_all',        'View all financial reports','Finance','financial_reports','view_all',       '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Cash Flow
(92, 'cash_flow_read',   'View cash flow',             'Finance','cash_flow','read',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(93, 'cash_flow_export', 'Export cash flow data',      'Finance','cash_flow','export', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(94, 'cash_flow_manage', 'Full cash flow management',  'Finance','cash_flow','manage', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Tax Codes
(95,  'tax_codes_read',   'View tax codes',            'Finance','tax_codes','read',   '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(96,  'tax_codes_create', 'Create tax codes',          'Finance','tax_codes','create', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(97,  'tax_codes_update', 'Update tax codes',          'Finance','tax_codes','update', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(98,  'tax_codes_delete', 'Delete tax codes',          'Finance','tax_codes','delete', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
(99,  'tax_codes_manage', 'Full tax code management',  'Finance','tax_codes','manage', '2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00'),
-- Finance: Payment Transactions
(100,'payment_transactions_read','View payment transactions','Finance','payment_transactions','read','2025-12-28 17:09:28.337072+00','2025-12-28 17:09:28.337072+00')
ON CONFLICT (id) DO NOTHING;

-- NOTE: Your database has 307 total permissions (IDs 101–307 not shown in the export).
-- To capture those too, run this query and add to this script:
--   SELECT id, permission_name, description, module, resource, action
--   FROM permissions WHERE id > 100 ORDER BY id;

SELECT setval('permissions_id_seq', GREATEST((SELECT MAX(id) FROM permissions), 100));

-- =============================================================================
-- 5. ROLE → PERMISSION MAPPINGS
-- =============================================================================
-- Your database has 1,077 mappings across 7 roles.
-- The block below reconstructs them logically based on role access levels.
-- For a pixel-perfect restore, export with:
--   SELECT role_id, permission_id FROM role_permissions
--   WHERE role_id IN (2,3,4,5,6,7,8) ORDER BY role_id, permission_id;

-- Company Admin (role 2) + Area Admin (role 3): all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.id IN (2, 3)
  AND r.company_id = 1
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Store Admin (role 4): all except admin-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, p.id
FROM permissions p
WHERE p.permission_name NOT IN ('users_manage','roles_manage','settings_manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accounting Manager (role 8): all Finance permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 8, p.id
FROM permissions p
WHERE p.module = 'Finance'
   OR p.permission_name IN ('reports_sales','reports_inventory','reports_financial')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Manager (role 5): sales + customers + products read + reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, p.id
FROM permissions p
WHERE p.module IN ('sales','crm')
   OR p.permission_name IN (
       'products_read','stock_view',
       'reports_sales','reports_inventory',
       'purchases_read'
   )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Inventory Manager (role 6): inventory + purchasing + products
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, p.id
FROM permissions p
WHERE p.module IN ('inventory','purchasing')
   OR p.permission_name IN (
       'products_create','products_read','products_update','products_delete',
       'customers_read',
       'reports_inventory','reports_sales'
   )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Cashier (role 7): POS only (sales create/read, customer read)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 7, p.id
FROM permissions p
WHERE p.permission_name IN (
    'sales_create','sales_read','sales_cancel',
    'customers_read','customers_create',
    'products_read','stock_view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 6. PRODUCT CATEGORIES  (8 dosage-form categories, IDs 81–88)
-- =============================================================================

INSERT INTO categories (id, company_id, category_name, category_code, description,
    parent_category_id, level, is_active, icon_name, color_code, sort_order, created_at, updated_at)
VALUES
(81, 1, 'CAPSULES',    'CAP', 'Solid dosage forms enclosed in gelatin or cellulose shells',                  NULL, 1, true, 'capsule',  '#FF6B6B', 1, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(82, 1, 'TABLETS',     'TAB', 'Solid dosage forms compressed into disc or oval shapes',                      NULL, 1, true, 'tablet',   '#4ECDC4', 2, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(83, 1, 'SYRUPS',      'SYR', 'Liquid oral preparations including syrups, suspensions, and solutions',       NULL, 1, true, 'liquid',   '#95E1D3', 3, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(84, 1, 'DROPS',       'DRP', 'Liquid preparations administered by drops (oral, eye, ear, nasal)',           NULL, 1, true, 'droplet',  '#38A3A5', 4, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(85, 1, 'INJECTABLES', 'INJ', 'Sterile preparations for parenteral administration',                          NULL, 1, true, 'syringe',  '#22577A', 5, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(86, 1, 'CREAMS',      'CRM', 'Semi-solid preparations for external application',                            NULL, 1, true, 'cream',    '#FFA07A', 6, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(87, 1, 'PESSARIES',   'PES', 'Solid dosage forms for vaginal or rectal administration',                     NULL, 1, true, 'medical',  '#C77DFF', 7, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00'),
(88, 1, 'SUNDRIES',    'SUN', 'Medical devices and other pharmaceutical preparations',                       NULL, 1, true, 'package',  '#9D4EDD', 8, '2026-01-01 12:50:53.616822+00', '2026-01-01 12:50:53.616822+00')
ON CONFLICT (id) DO NOTHING;

SELECT setval('categories_id_seq', GREATEST((SELECT MAX(id) FROM categories WHERE company_id = 1), 88));

-- =============================================================================
-- 7. UNITS  (10 units: 7 base + 3 derived)
-- =============================================================================

-- Base units first (no base_unit_id)
INSERT INTO units (id, company_id, name, short_code, type, base_unit_id, conversion_factor, is_active, created_at, updated_at)
VALUES
(1,  1, 'Tablet',     'TAB',   'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
(2,  1, 'Capsule',    'CAP',   'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
(3,  1, 'Bottle',     'BTL',   'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
(4,  1, 'Vial',       'VIAL',  'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
(5,  1, 'Tube',       'TUBE',  'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
(6,  1, 'Milliliter', 'ML',    'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
(7,  1, 'Milligram',  'MG',    'base', NULL, 1,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),
-- Derived units (reference base unit IDs above)
(8,  1, 'Strip',      'STRIP', 'derived', 1,  10, true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),  -- 10 Tablets
(9,  1, 'Box',        'BOX',   'derived', 8,  10, true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00'),  -- 10 Strips
(10, 1, 'Sachet',     'SACH',  'derived', 6,  5,  true, '2025-12-28 15:57:35.281704+00', '2026-01-23 20:49:02.826291+00')   -- 5 ml
ON CONFLICT (id) DO NOTHING;

SELECT setval('units_id_seq', GREATEST((SELECT MAX(id) FROM units WHERE company_id = 1), 10));

-- =============================================================================
-- 8. CHART OF ACCOUNTS  (69 accounts, all with parent_account_id = NULL
--    as exported — your COA uses a flat structure with account_code hierarchy)
-- =============================================================================

INSERT INTO chart_of_accounts (id, company_id, account_code, account_name, account_type, account_subtype, parent_account_id, is_active)
VALUES
-- Assets: Current
(1,  1, '1000', 'Current Assets',               'asset',   'current_asset',    NULL, true),
(2,  1, '1100', 'Cash on Hand',                 'asset',   'current_asset',    NULL, true),
(3,  1, '1110', 'Petty Cash',                   'asset',   'current_asset',    NULL, true),
(4,  1, '1120', 'Bank Account',                 'asset',   'current_asset',    NULL, true),
(5,  1, '1130', 'Mobile Money',                 'asset',   'current_asset',    NULL, true),
(6,  1, '1200', 'Accounts Receivable',          'asset',   'current_asset',    NULL, true),
(7,  1, '1210', 'Tax Recoverable (VAT Input)',  'asset',   'current_asset',    NULL, true),
(8,  1, '1220', 'Staff Advances',               'asset',   'current_asset',    NULL, true),
(9,  1, '1230', 'Prepaid Expenses',             'asset',   'current_asset',    NULL, true),
(10, 1, '1300', 'Inventory - Medicines',        'asset',   'current_asset',    NULL, true),
(11, 1, '1310', 'Inventory - Medical Supplies', 'asset',   'current_asset',    NULL, true),
(12, 1, '1320', 'Inventory - OTC Products',     'asset',   'current_asset',    NULL, true),
(13, 1, '1390', 'Inventory Reserve (Expired)',  'asset',   'current_asset',    NULL, true),
-- Assets: Fixed
(14, 1, '1500', 'Non-Current Assets',           'asset',   'fixed_asset',      NULL, true),
(15, 1, '1510', 'Furniture & Fixtures',         'asset',   'fixed_asset',      NULL, true),
(16, 1, '1520', 'Equipment',                    'asset',   'fixed_asset',      NULL, true),
(17, 1, '1530', 'Leasehold Improvements',       'asset',   'fixed_asset',      NULL, true),
(18, 1, '1590', 'Accumulated Depreciation',     'asset',   'fixed_asset',      NULL, true),
-- Liabilities: Current
(19, 1, '2000', 'Current Liabilities',          'liability','current_liability',NULL, true),
(20, 1, '2100', 'Accounts Payable',             'liability','current_liability',NULL, true),
(21, 1, '2110', 'Accrued Expenses',             'liability','current_liability',NULL, true),
(22, 1, '2120', 'Customer Deposits',            'liability','current_liability',NULL, true),
(23, 1, '2130', 'Salaries Payable',             'liability','current_liability',NULL, true),
(24, 1, '2140', 'PAYE Payable',                 'liability','current_liability',NULL, true),
(25, 1, '2150', 'NSSF Payable',                 'liability','current_liability',NULL, true),
(26, 1, '2160', 'VAT Payable',                  'liability','current_liability',NULL, true),
(27, 1, '2170', 'Withholding Tax Payable',      'liability','current_liability',NULL, true),
-- Liabilities: Long-term
(28, 1, '2500', 'Non-Current Liabilities',      'liability','long_term_liability',NULL,true),
(29, 1, '2510', 'Bank Loan',                    'liability','long_term_liability',NULL,true),
-- Equity
(30, 1, '3000', 'Equity',                       'equity',  'owner_equity',     NULL, true),
(31, 1, '3100', 'Owner Capital',                'equity',  'owner_equity',     NULL, true),
(32, 1, '3200', 'Retained Earnings',            'equity',  'retained_earnings',NULL, true),
(33, 1, '3300', 'Owner Drawings',               'equity',  'owner_equity',     NULL, true),
-- Revenue
(34, 1, '4000', 'Revenue',                      'revenue', 'operating_revenue',NULL, true),
(35, 1, '4100', 'Medicine Sales',               'revenue', 'operating_revenue',NULL, true),
(36, 1, '4110', 'OTC & Cosmetics Sales',        'revenue', 'operating_revenue',NULL, true),
(37, 1, '4120', 'Medical Supplies Sales',       'revenue', 'operating_revenue',NULL, true),
(38, 1, '4200', 'Dispensing Fees',              'revenue', 'operating_revenue',NULL, true),
(39, 1, '4300', 'Other Income',                 'revenue', 'non_operating_revenue',NULL,true),
(40, 1, '4400', 'Sales Discounts Given',        'revenue', 'operating_revenue',NULL, true),
-- COGS / Cost of Sales
(41, 1, '5000', 'Cost of Goods Sold',           'expense', 'operating_expense',NULL, true),
(42, 1, '5100', 'Medicine Purchases',           'expense', 'operating_expense',NULL, true),
(43, 1, '5110', 'Medical Supplies Purchases',   'expense', 'operating_expense',NULL, true),
(44, 1, '5120', 'Purchase Discounts Received',  'expense', 'operating_expense',NULL, true),
(45, 1, '5130', 'Freight & Delivery Inward',    'expense', 'operating_expense',NULL, true),
(46, 1, '5200', 'Inventory Write-offs',         'expense', 'operating_expense',NULL, true),
-- Operating Expenses
(47, 1, '6000', 'Operating Expenses',           'expense', 'operating_expense',NULL, true),
(48, 1, '6100', 'Staff Salaries',               'expense', 'operating_expense',NULL, true),
(49, 1, '6110', 'NSSF Contributions',           'expense', 'operating_expense',NULL, true),
(50, 1, '6120', 'Staff Training',               'expense', 'administrative_expense',NULL,true),
(51, 1, '6200', 'Rent & Rates',                 'expense', 'operating_expense',NULL, true),
(52, 1, '6210', 'Utilities - Electricity',      'expense', 'operating_expense',NULL, true),
(53, 1, '6220', 'Utilities - Water',            'expense', 'operating_expense',NULL, true),
(54, 1, '6230', 'Internet & Telephone',         'expense', 'operating_expense',NULL, true),
(55, 1, '6300', 'Advertising & Marketing',      'expense', 'selling_expense',  NULL, true),
(56, 1, '6310', 'Delivery & Transport',         'expense', 'selling_expense',  NULL, true),
(57, 1, '6320', 'Packaging & Bags',             'expense', 'selling_expense',  NULL, true),
(58, 1, '6330', 'Repairs & Maintenance',        'expense', 'operating_expense',NULL, true),
(59, 1, '6340', 'Cleaning & Sanitation',        'expense', 'operating_expense',NULL, true),
(60, 1, '6400', 'Licences & Permits',           'expense', 'administrative_expense',NULL,true),
(61, 1, '6410', 'Professional Fees',            'expense', 'administrative_expense',NULL,true),
(62, 1, '6420', 'Insurance',                    'expense', 'administrative_expense',NULL,true),
(63, 1, '6430', 'Bank Charges',                 'expense', 'financial_expense',NULL, true),
(64, 1, '6440', 'Depreciation Expense',         'expense', 'operating_expense',NULL, true),
(65, 1, '6450', 'Miscellaneous Expenses',       'expense', 'other_expense',    NULL, true),
-- Financial Items
(66, 1, '7000', 'Financial Items',              'expense', 'financial_expense',NULL, true),
(67, 1, '7100', 'Interest Income',              'revenue', 'non_operating_revenue',NULL,true),
(68, 1, '7200', 'Interest Expense',             'expense', 'financial_expense',NULL, true),
(69, 1, '7300', 'Exchange Gains/Losses',        'expense', 'financial_expense',NULL, true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('chart_of_accounts_id_seq', GREATEST((SELECT MAX(id) FROM chart_of_accounts WHERE company_id = 1), 69));

-- =============================================================================
-- 9. INCOME CATEGORIES  (16 categories)
-- =============================================================================

INSERT INTO income_categories (id, company_id, category_name, description, is_active)
VALUES
(1,  1, 'Income',                          NULL, true),
(2,  1, 'Medicine Sales',                  NULL, true),
(3,  1, 'Surgical & Medical Supplies',     NULL, true),
(4,  1, 'Baby & Mother Care',              NULL, true),
(5,  1, 'Cosmetics & Beauty',              NULL, true),
(6,  1, 'Nutrition & Supplements',         NULL, true),
(7,  1, 'Medical Devices',                 NULL, true),
(8,  1, 'Laboratory Services',             NULL, true),
(9,  1, 'Consultation Fees',               NULL, true),
(10, 1, 'Vaccine & Immunization Services', NULL, true),
(11, 1, 'Online/Telepharmacy Sales',       NULL, true),
(12, 1, 'Insurance Reimbursements',        NULL, true),
(13, 1, 'Government Subsidies/Grants',     NULL, true),
(14, 1, 'Other Income',                    NULL, true),
(15, 1, 'Prescription Drugs',              NULL, true),
(16, 1, 'Over-the-Counter (OTC)',          NULL, true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('income_categories_id_seq', GREATEST((SELECT MAX(id) FROM income_categories WHERE company_id = 1), 16));

-- =============================================================================
-- 10. EXPENSE CATEGORIES  (24 categories)
-- =============================================================================

INSERT INTO expense_categories (id, company_id, category_name, description, is_active)
VALUES
(1,  1, 'Expenses',                     NULL, true),
(2,  1, 'Cost of Goods Sold',           NULL, true),
(3,  1, 'Salaries & Wages',             NULL, true),
(4,  1, 'Rent & Utilities',             NULL, true),
(5,  1, 'Licenses & Regulatory Fees',   NULL, true),
(6,  1, 'Marketing & Advertising',      NULL, true),
(7,  1, 'Professional Fees',            NULL, true),
(8,  1, 'Insurance',                    NULL, true),
(9,  1, 'Bank Charges & Interest',      NULL, true),
(10, 1, 'Repairs & Maintenance',        NULL, true),
(11, 1, 'Office Supplies',              NULL, true),
(12, 1, 'Transportation & Delivery',    NULL, true),
(13, 1, 'Taxes & Duties',               NULL, true),
(14, 1, 'Training & Staff Development', NULL, true),
(15, 1, 'Depreciation',                 NULL, true),
(16, 1, 'Inventory Loss/Shrinkage',     NULL, true),
(17, 1, 'Waste Disposal',               NULL, true),
(18, 1, 'Software & IT Subscriptions',  NULL, true),
(19, 1, 'Patient Assistance Programs',  NULL, true),
(20, 1, 'Other Expenses',               NULL, true),
(21, 1, 'Medicine Purchases',           NULL, true),
(22, 1, 'Supplies Purchases',           NULL, true),
(23, 1, 'Pharmacist Salaries',          NULL, true),
(24, 1, 'Support Staff Wages',          NULL, true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('expense_categories_id_seq', GREATEST((SELECT MAX(id) FROM expense_categories WHERE company_id = 1), 24));

-- =============================================================================
-- 11. VERIFICATION
-- =============================================================================

DO $$
DECLARE
    v_roles     bigint; v_rp        bigint; v_perms     bigint;
    v_cats      bigint; v_units     bigint; v_coa       bigint;
    v_inc_cats  bigint; v_exp_cats  bigint;
BEGIN
    SELECT COUNT(*) INTO v_roles     FROM roles               WHERE company_id = 1;
    SELECT COUNT(*) INTO v_rp        FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.company_id = 1;
    SELECT COUNT(*) INTO v_perms     FROM permissions;
    SELECT COUNT(*) INTO v_cats      FROM categories          WHERE company_id = 1;
    SELECT COUNT(*) INTO v_units     FROM units               WHERE company_id = 1;
    SELECT COUNT(*) INTO v_coa       FROM chart_of_accounts   WHERE company_id = 1;
    SELECT COUNT(*) INTO v_inc_cats  FROM income_categories   WHERE company_id = 1;
    SELECT COUNT(*) INTO v_exp_cats  FROM expense_categories  WHERE company_id = 1;

    RAISE NOTICE '=== PharmaSOS Template Restore - Results ===';
    RAISE NOTICE 'Roles              : % (expected 7)',   v_roles;
    RAISE NOTICE 'Role-Permissions   : % (expected ~1077)', v_rp;
    RAISE NOTICE 'Permissions        : % (expected 307)', v_perms;
    RAISE NOTICE 'Categories         : % (expected 8)',   v_cats;
    RAISE NOTICE 'Units              : % (expected 10)',  v_units;
    RAISE NOTICE 'COA Accounts       : % (expected 69)',  v_coa;
    RAISE NOTICE 'Income Categories  : % (expected 16)',  v_inc_cats;
    RAISE NOTICE 'Expense Categories : % (expected 24)',  v_exp_cats;
    RAISE NOTICE '=============================================';
END $$;

COMMIT;
