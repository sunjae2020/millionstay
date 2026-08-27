-- AI 사용량 미터 — API 호출 1건 = 1행
--
-- 여러 벤더(Anthropic·Kimi·Gemini)를 작업별로 나눠 쓰기 시작하면서, "어떤 작업이
-- 어느 모델을 얼마나 쓰는가"를 벤더 청구서 세 장을 대조하지 않고는 알 수 없게 됐다.
-- 이 표가 그 질문에 답한다 — 작업·프로바이더·모델·토큰·지연·성공여부.
--
-- 실패한 호출도 ok = false 로 남긴다. 키가 죽은 프로바이더는 관리자가 가장 먼저
-- 봐야 할 신호인데, 실패를 버리면 "안 쓰는 중"과 구별되지 않는다.
--
-- cost_usd 는 lib/ai/pricing.ts 단가표로 계산한 추정치이지 청구액이 아니다.
-- 단가표에 없는 모델이면 NULL 이고, 그때 화면은 토큰만 보여준다.
--
-- 프롬프트·응답 본문은 저장하지 않는다. 본문은 각 기능 테이블에 각자의 보존기간
-- 규칙 아래 이미 있고, 여기에 복사하면 관리되지 않는 고객정보 사본이 하나 더 생긴다.
--
-- Additive-only.
CREATE TABLE IF NOT EXISTS "ai_usage_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "task" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "cache_read_tokens" integer NOT NULL DEFAULT 0,
  "cache_write_tokens" integer NOT NULL DEFAULT 0,
  "latency_ms" integer NOT NULL DEFAULT 0,
  "ok" boolean NOT NULL DEFAULT true,
  "error" text,
  "cost_usd" numeric(12, 6),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- 조회는 항상 기간으로 먼저 자르고, 그 다음 작업/프로바이더로 묶는다.
CREATE INDEX IF NOT EXISTS "idx_ai_usage_created" ON "ai_usage_events" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_task_created" ON "ai_usage_events" ("task", "created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_provider_created" ON "ai_usage_events" ("provider", "created_at");
