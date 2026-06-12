import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { HomestayLayout } from "@/components/homestay/HomestayLayout";
import { HS, HS_FONT } from "@/lib/homestay-theme";

// 5. CONTACT US — content from the Million Homestay site-content doc (page 5).
// Reuses the existing public contact endpoint (POST /v1/public/contact-inquiries),
// mapping the "I am a" role to `subject`.
const ROLES = ["Host family", "Student", "Agent or institute", "Other"];

const SHORTCUTS = [
  { label: "Apply now", href: "/students/apply", note: "Students" },
  { label: "Become a Host", href: "/for-homestay-host", note: "Host families" },
  { label: "Partner with us", href: "/partners", note: "Agents & institutes" },
];

export default function HomestayContact() {
  const [form, setForm] = useState({ first_name: "", email: "", subject: ROLES[0], message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.first_name || !form.email || !form.message) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${getApiBase()}/api/v1/public/contact-inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: "",
          email: form.email,
          subject: `[Homestay] ${form.subject}`,
          message: form.message,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <HomestayLayout title="Contact">
      <section className="max-w-5xl mx-auto px-5 py-16 md:py-20">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Let's talk</h1>
          <p className="mt-3 text-gray-600">Whether you want to host, find a homestay, or partner with us, we're here to help.</p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
            <span><span className="font-medium">Email:</span>{" "}
              <a href="mailto:millionstay.com@gmail.com" className="hover:underline" style={{ color: HS.brand }}>millionstay.com@gmail.com</a>
            </span>
            <span><span className="font-medium">Location:</span> Melbourne, Victoria, Australia</span>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-xl border border-gray-100 p-4 flex items-center justify-between" style={{ backgroundColor: HS.cream }}>
              <span>
                <span className="block text-xs text-gray-500">{s.note}</span>
                <span className="font-semibold" style={{ color: HS.darkBrown }}>{s.label}</span>
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: HS.brand }} />
            </Link>
          ))}
        </div>

        <div className="mt-12 max-w-xl mx-auto">
          {done ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: HS.brand }} />
              <h2 className="mt-4 text-xl font-bold" style={{ fontFamily: HS_FONT.head, color: HS.darkBrown }}>Thanks — message sent</h2>
              <p className="mt-2 text-gray-600">We'll get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="w-full py-3 rounded-lg font-semibold text-white inline-flex items-center justify-center gap-2" style={{ backgroundColor: HS.brand }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send message"}
              </button>
            </form>
          )}
        </div>
      </section>
    </HomestayLayout>
  );
}
