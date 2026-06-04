-- ============================================================================
-- VM Robotics Document Tracker — 0004 seed
--
-- Seeds the five meaningful groups and their starter document checklists (brief §4).
-- These are starting defaults from the company process handbook; the owner refines
-- them in-app later. Re-run safe via ON CONFLICT (key).
-- ============================================================================

insert into case_types (key, "group", name_he, name_en, expected_documents) values
  -- Import (ייבוא): a single shipment from abroad.
  -- (commercial_invoice may be satisfied by proforma_invoice — handled in app logic.)
  (
    'import', 'import', 'ייבוא', 'Import',
    '["commercial_invoice","packing_list","rashimon","carrier_receipt","customs_voucher_184"]'::jsonb
  ),
  -- Sales & Service (מכירות ושירות): a service job for a client.
  -- (credit_note is optional, used only on a correction — not part of the "complete" set.)
  (
    'sale_service', 'sale_service', 'מכירות ושירות', 'Sales & Service',
    '["delivery_note","tax_invoice","receipt"]'::jsonb
  ),
  -- Procurement (רכש מקומי): local purchase from an Israeli supplier.
  (
    'procurement', 'procurement', 'רכש מקומי', 'Procurement',
    '["tax_invoice","receipt"]'::jsonb
  ),
  -- Projects (פרויקטים): large client integration project; usually a parent case
  -- with import child-cases. vendor_onboarding may also be required (kept optional).
  (
    'project', 'project', 'פרויקטים', 'Projects',
    '["quote","purchase_order","tax_invoice","delivery_note","receipt"]'::jsonb
  ),
  -- Tax & Regulatory (מסים ורגולציה): key compliance documents.
  (
    'tax', 'tax', 'מסים ורגולציה', 'Tax & Regulatory',
    '["tax_withholding_cert","form_101"]'::jsonb
  )
on conflict (key) do nothing;
