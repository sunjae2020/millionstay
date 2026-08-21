import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      // Auth headers
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "req.headers['x-migration-secret']",
      "res.headers['set-cookie']",
      // Body — auth + secrets
      "*.password",
      "*.password_hash",
      "*.passwordHash",
      "*.current_password",
      "*.new_password",
      "*.token",
      "*.access_token",
      "*.refresh_token",
      "*.api_key",
      "*.apiKey",
      "*.secret",
      "*.client_secret",
      "*.session_token",
      // Body — Australian Privacy Act sensitive PII
      "*.passport_no",
      "*.passport_number",
      // 주민등록번호 — 한국 고유식별정보. 계약서 발급에만 쓰이고 로그에는 절대 남지 않는다.
      "*.resident_no",
      "*.resident_registration_no",
      "*.tfn",
      "*.medicare_number",
      "*.driver_license",
      "*.driver_licence",
      "*.credit_card",
      "*.card_number",
      "*.cvv",
      "*.cvc",
      "*.bank_account",
      "*.bank_account_name",
      "*.bank_account_number",
      "*.bank_bsb",
      "*.bank_name",
      // Bank reconciliation rows (bank_accounts / bank_transactions): the
      // account identifiers travel together with statement lines, so a logged
      // row would expose the account they belong to.
      "*.bank_accounts",
      "*.bank_account_id",
      "*.account_number",
      "*.dob",
      "*.date_of_birth",
      "*.passport_expiry",
      "*.visa",
      "*.visa_type",
      "*.visa_expiry",
      "*.nationality",
      // 관리자 프로필(설정 → 사용자)의 개인 연락 정보
      "*.emergency_contact_name",
      "*.emergency_contact_relation",
      "*.emergency_contact_phone",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
