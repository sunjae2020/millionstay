-- Metheim exchange-rate seed — tracked comparison currencies (all vs AUD).
--
-- WHY: the guest site quotes/collects in KRW but shows reference conversions
-- (USD/JPY/CNY/THB/VND) next to each listing price. Conversion goes via AUD, and
-- the daily auto-sync (exchangeRateSync.ts) only refreshes currencies that ALREADY
-- have a row here. This seed registers that tracked set with today's live rates;
-- thereafter the scheduled sync keeps them current. AUD is 1:1 and injected by the
-- API, so it is not stored here.
-- Snapshot: open.er-api.com, Fri, 24 Jul 2026 00:02:31 +0000 (stored as 1 X = N AUD).

INSERT INTO exchange_rates (from_currency, to_currency, rate, source, effective_date)
VALUES
  ('KRW', 'AUD', 0.00097216, 'manual', CURRENT_DATE),
  ('USD', 'AUD', 1.43374726, 'manual', CURRENT_DATE),
  ('JPY', 'AUD', 0.00875939, 'manual', CURRENT_DATE),
  ('CNY', 'AUD', 0.21149326, 'manual', CURRENT_DATE),
  ('THB', 'AUD', 0.04236229, 'manual', CURRENT_DATE),
  ('VND', 'AUD', 0.00005460, 'manual', CURRENT_DATE)
ON CONFLICT (from_currency, to_currency, effective_date)
DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, updated_at = now();
