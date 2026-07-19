import { CheckCircle2, XCircle } from "lucide-react";
import { useSupportEmail } from "@/lib/guest-api";
import { APP_NAME } from "../lib/appName";

// Stripe redirect target for payments (homestay placements + regular invoices).
// Reads ?status=success|cancelled&ref=… (HSP-… or MS-INV-…) and shows a confirmation.
export default function PaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") ?? "success";
  const ref = params.get("ref") ?? "";
  const ok = status === "success";
  const supportEmail = useSupportEmail();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        {ok ? (
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
        ) : (
          <XCircle className="w-12 h-12 mx-auto text-gray-400" />
        )}
        <h1 className="mt-5 text-2xl font-bold text-gray-900">
          {ok ? "Payment received" : "Payment cancelled"}
        </h1>
        <p className="mt-2 text-gray-600">
          {ok
            ? "Thank you — your payment has been received. A receipt will follow by email."
            : "Your payment was not completed. You can use your payment link again at any time, or contact us for help."}
        </p>
        {ref && (
          <p className="mt-4 text-sm text-gray-400">
            Reference: <span className="font-mono font-medium text-gray-600">{ref}</span>
          </p>
        )}
        <a
          href="/"
          className="mt-7 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        >
          Back to {APP_NAME}
        </a>
        <p className="mt-4 text-xs text-gray-400">
          Questions? <a href={`mailto:${supportEmail}`} className="underline">{supportEmail}</a>
        </p>
      </div>
    </div>
  );
}
