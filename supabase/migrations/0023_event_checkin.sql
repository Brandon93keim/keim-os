-- ============================================================
-- 0023_event_checkin.sql
-- "I'm here" check-in on calendar events.
--   arrived_*        : GPS fix captured when you tap the button on site
--   roundtrip_miles  : Home -> site -> Home driving miles for this event,
--                      used for invoice mileage lines (from the check-in, or
--                      computed from the event's address when first needed)
-- ============================================================
BEGIN;
ALTER TABLE events
  ADD COLUMN arrived_at       timestamptz,
  ADD COLUMN arrived_lat      double precision,
  ADD COLUMN arrived_lng      double precision,
  ADD COLUMN arrived_address  text,
  ADD COLUMN roundtrip_miles  numeric(8,1) CHECK (roundtrip_miles IS NULL OR roundtrip_miles >= 0);
COMMIT;
