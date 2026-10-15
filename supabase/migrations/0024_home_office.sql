-- ============================================================
-- 0024_home_office.sql
-- Home office deduction inputs (per tax year).
-- The planner computes both IRS methods and uses the larger by default:
--   simplified: $5 x office sq ft (max 300 sq ft)
--   actual    : business % x (utilities + homeowners insurance + property tax)
--               + depreciation on the business % of the building (39-yr, mid-month)
-- ============================================================
BEGIN;
ALTER TABLE tax_settings
  ADD COLUMN home_office_sqft       numeric(8,1) NOT NULL DEFAULT 0 CHECK (home_office_sqft >= 0),
  ADD COLUMN home_total_sqft        numeric(8,1) NOT NULL DEFAULT 0 CHECK (home_total_sqft >= 0),
  ADD COLUMN home_insurance_annual  numeric(12,2) NOT NULL DEFAULT 0 CHECK (home_insurance_annual >= 0),
  ADD COLUMN property_tax_annual    numeric(12,2) NOT NULL DEFAULT 0 CHECK (property_tax_annual >= 0),
  ADD COLUMN home_building_basis    numeric(12,2) NOT NULL DEFAULT 0 CHECK (home_building_basis >= 0),
  ADD COLUMN home_in_service_date   date,
  ADD COLUMN home_office_method     text NOT NULL DEFAULT 'auto' CHECK (home_office_method IN ('auto', 'simplified', 'actual'));
COMMIT;
