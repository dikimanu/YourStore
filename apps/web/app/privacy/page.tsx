import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how YourStore collects, protects, and manages your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Last updated: November 2026</p>
      </div>

      <div className="prose dark:prose-invert text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-6">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">1. Information We Collect</h2>
          <p>
            At YourStore, we collect information necessary to deliver products and services to you. This includes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Personal details: Name, email address, phone number.</li>
            <li>Shipping information: Delivery addresses, postal codes.</li>
            <li>Transactional data: Order history and payment status records (card numbers are processed securely by Stripe and never stored on our servers).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">2. How We Use Your Information</h2>
          <p>
            We use collected data solely for authenticating accounts, processing orders, coordinating deliveries, handling returns, and communicating updates. We do not sell your personal information to third parties.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">3. Cookies &amp; Authentication</h2>
          <p>
            We utilize secure, first-party httpOnly cookies for session authentication and CSRF prevention. We do not store sensitive authentication tokens in browser localStorage or sessionStorage.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">4. Contact &amp; Data Rights</h2>
          <p>
            You have the right to request access to or deletion of your stored profile and address data. For enquiries, contact us at <span className="font-mono text-xs">privacy@yourstore.in</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
