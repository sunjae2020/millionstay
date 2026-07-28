-- Metheim: write country values in Korean.
--
-- `accounts.address_country` is free text and had drifted into ISO codes ("KR")
-- on the 70 rows imported from the 임대리스트. The admin now stores country
-- names in the language the record is kept in ("대한민국"), so a raw row is
-- readable without a lookup table.
--
-- Idempotent: matches the legacy spellings only, so re-running is a no-op.
UPDATE accounts
   SET address_country = '대한민국',
       updated_at = now()
 WHERE address_country IN ('KR', 'KOR', 'Korea', 'South Korea', 'Republic of Korea', '한국');

UPDATE accounts
   SET secondary_address_country = '대한민국',
       updated_at = now()
 WHERE secondary_address_country IN ('KR', 'KOR', 'Korea', 'South Korea', 'Republic of Korea', '한국');

-- Contacts keep addresses too — same treatment so the two agree.
UPDATE contacts
   SET country = '대한민국',
       updated_at = now()
 WHERE country IN ('KR', 'KOR', 'Korea', 'South Korea', 'Republic of Korea', '한국');

-- Nationality follows the same rule as the address country.
UPDATE contacts
   SET nationality = '대한민국',
       updated_at = now()
 WHERE nationality IN ('KR', 'KOR', 'Korea', 'South Korea', 'Republic of Korea', '한국');
