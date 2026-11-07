import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Returns Policy",
  description: "Details regarding order dispatch, delivery timelines, cancellation, and return procedures.",
};

export default function ShippingReturnsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Shipping &amp; Returns Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Last updated: November 2026</p>
      </div>

      <div className="prose dark:prose-invert text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-6">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">1. Shipping Coverage &amp; Rates</h2>
          <p>
            We ship across all serviceable pincodes in India. Standard flat shipping applies on orders below the free shipping threshold. Orders exceeding the threshold qualify for complimentary standard shipping.
          </p>
          <p>
            Typical delivery takes between 3 to 7 business days depending on location and courier logistics.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">2. Order Cancellation</h2>
          <p>
            Customers may cancel an order directly from their account dashboard as long as the order status remains <span className="font-semibold">Placed</span> or <span className="font-semibold">Processing</span>. Once an order is marked <span className="font-semibold">Dispatched</span>, cancellation is no longer possible and the order must be received before requesting a return.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">3. Returns &amp; Refunds</h2>
          <p>
            Eligible non-perishable goods may be returned within 7 days of delivery if they are unused, with all original tags and packaging intact. Approved returns will trigger a refund to the original payment method or bank account within 5–7 business days.
          </p>
        </section>
      </div>
    </div>
  );
}
