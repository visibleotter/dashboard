-- ============================================================================
-- 0014 — Payment terms per case
-- ----------------------------------------------------------------------------
-- Free-text field for תנאי תשלום ("Net 30", "30/50/20", "advance 30% + balance
-- on delivery", etc.). Distinct from payment_milestones which model concrete
-- staged payments; this is the contractual wording.
-- ============================================================================

alter table cases add column if not exists payment_terms text;
