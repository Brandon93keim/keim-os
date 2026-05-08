ALTER TABLE events ADD COLUMN golf_purpose text;

ALTER TABLE events ADD CONSTRAINT golf_purpose_check
  CHECK (
    golf_purpose IS NULL
    OR (type = 'golf' AND golf_purpose IN
       ('workout', 'practice', 'practice_round', 'tournament'))
  );
