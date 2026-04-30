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
      "*.dob",
      "*.date_of_birth",
      "*.passport_expiry",
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
