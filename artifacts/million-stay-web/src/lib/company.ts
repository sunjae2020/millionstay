/**
 * Per-instance operating-company details (white-label, spec §2.4).
 *
 * Legal name, ABN, city and bank-transfer details appear on receipts, the
 * booking bank-transfer panel and the privacy policy. For a white-label
 * instance these belong to the *operating company*, not MillionStay, so they
 * are injected at build time. All default to the primary MillionStay values so
 * the primary instance is unaffected.
 *
 * Bank details are non-sensitive account identifiers (BSB/account number are
 * public payment coordinates), not secrets — safe to bake into the client bundle.
 */
import { APP_NAME } from "./appName";

const env = import.meta.env;
const val = (v: string | undefined, fallback: string) => v?.trim() || fallback;

export const COMPANY = {
  legalName: val(env.VITE_COMPANY_LEGAL_NAME, `${APP_NAME} Pty Ltd`),
  abn: val(env.VITE_COMPANY_ABN, "12 345 678 901"),
  city: val(env.VITE_COMPANY_CITY, "Melbourne, VIC, Australia"),
  bank: {
    name: val(env.VITE_BANK_NAME, "Commonwealth Bank of Australia"),
    accountName: val(env.VITE_BANK_ACCOUNT_NAME, `${APP_NAME} Pty Ltd`),
    bsb: val(env.VITE_BANK_BSB, "063-000"),
    accountNo: val(env.VITE_BANK_ACCOUNT_NO, "1234 5678"),
  },
} as const;
