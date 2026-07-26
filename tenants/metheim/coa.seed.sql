-- MetHeim Chart of Accounts (계정과목) — Korean real-estate lease/sale/management.
-- Codes align with the auto-posting GL (journal.ts): 1000 현금, 2100 임대보증금,
-- 2200 미지급금, 4000 임대수익, 5100 지급수수료. Idempotent (ON CONFLICT DO NOTHING).
INSERT INTO chart_of_accounts (code, name, account_type, parent_code, sort_order) VALUES
  -- 자산 Assets
  ('1000', '현금및현금성자산', 'asset',     NULL,   10),
  ('1010', '현금',            'asset',     '1000', 20),
  ('1020', '보통예금',         'asset',     '1000', 30),
  ('1100', '매출채권',         'asset',     NULL,   40),
  ('1110', '임대료 미수금',     'asset',     '1100', 50),
  ('1120', '관리비 미수금',     'asset',     '1100', 60),
  ('1200', '선급금',           'asset',     NULL,   70),
  ('1500', '유형자산',         'asset',     NULL,   80),
  ('1510', '건물',            'asset',     '1500', 90),
  ('1520', '토지',            'asset',     '1500', 100),
  ('1530', '비품',            'asset',     '1500', 110),
  ('1590', '감가상각누계액',    'asset',     '1500', 120),
  -- 부채 Liabilities
  ('2000', '매입채무',         'liability', NULL,   130),
  ('2100', '임대보증금',        'liability', NULL,   140),
  ('2200', '미지급금',         'liability', NULL,   150),
  ('2300', '선수금',           'liability', NULL,   160),
  ('2310', '선수임대료',        'liability', '2300', 170),
  ('2400', '예수금',           'liability', NULL,   180),
  ('2410', '부가세예수금',      'liability', '2400', 190),
  -- 자본 Equity
  ('3000', '자본금',           'equity',    NULL,   200),
  ('3100', '이익잉여금',        'equity',    NULL,   210),
  -- 수익 Revenue
  ('4000', '임대수익',         'revenue',   NULL,   220),
  ('4100', '분양·매매수익',     'revenue',   NULL,   230),
  ('4200', '관리수수료수익',    'revenue',   NULL,   240),
  ('4300', '부가서비스수익',    'revenue',   NULL,   250),
  ('4900', '기타수익',         'revenue',   NULL,   260),
  -- 비용 Expense
  ('5000', '매출원가',         'expense',   NULL,   270),
  ('5100', '지급수수료',        'expense',   NULL,   280),
  ('5200', '급여',            'expense',   NULL,   290),
  ('5300', '임차료',           'expense',   NULL,   300),
  ('5400', '수도광열비',        'expense',   NULL,   310),
  ('5500', '수선비',           'expense',   NULL,   320),
  ('5600', '청소비',           'expense',   NULL,   330),
  ('5700', '광고선전비',        'expense',   NULL,   340),
  ('5800', '감가상각비',        'expense',   NULL,   350),
  ('5900', '세금과공과',        'expense',   NULL,   360)
ON CONFLICT (code) DO NOTHING;
