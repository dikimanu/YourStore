import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions governing the use of YourStore platform and services.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Last updated: November 2026</p>
      </div>

      <div className="prose dark:prose-invert text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-6">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">1. Acceptance of Terms</h2>
          <p>
            By accessing or placing an order through YourStore, you agree to be bound by these Terms of Service and all applicable laws and regulations in India.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">2. Purchasing &amp; Pricing</h2>
          <p>
            All listed prices are in Indian Rupees (INR) and are computed server-side. Shipping and applicable Goods &amp; Services Tax (GST) are calculated prior to final order confirmation. We reserve the right to cancel orders arising from erroneous inventory levels or pricing errors.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">3. Vehicles &amp; Enquiry Listings</h2>
          <p>
            Vehicle listings marked as enquiry-only are not sold directly online. Submissions generate an enquiry or visit booking routed to our dealer partners; no online transaction or vehicle title transfer occurs on this website.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">4. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your credentials. Accounts subjected to excessive automated requests or malicious security testing may be locked or terminated.
          </p>
        </section>
      </div>
    </div>
  );
}
