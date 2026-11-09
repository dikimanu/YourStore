"use client";

export default function ContactPage() {
  const email = "satyabratapal50@gmail.com";
  const subject = encodeURIComponent("Enquiry from YourStore");
  const mailtoBase = `mailto:${email}?subject=${subject}`;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
          Contact Us
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Have a question, feedback, or just want to say hello? We&apos;d love to hear from you.
        </p>
      </div>

      {/* Contact details */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Reach out directly
        </h2>
        <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <a
            href={`mailto:${email}`}
            className="text-blue-600 dark:text-blue-400 hover:underline break-all"
          >
            {email}
          </a>
        </div>

        {/* Social links */}
        <div className="flex gap-4 pt-2">
          <a
            href="https://www.linkedin.com/in/satyabrata-pal-03b5a7373"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn profile of Satyabrata Pal"
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-400 transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 0h-14C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5V5c0-2.761-2.239-5-5-5zM8 19H5V9h3v10zM6.5 7.5a1.5 1.5 0 11.001-3.001A1.5 1.5 0 016.5 7.5zM20 19h-3v-5.5c0-1.378-.028-3.152-1.921-3.152-1.921 0-2.217 1.5-2.217 3.049V19h-3V9h2.882v1.368h.04c.401-.76 1.381-1.561 2.843-1.561C18.92 8.807 20 10.44 20 13.13V19z" />
            </svg>
            LinkedIn
          </a>
          <a
            href="https://www.instagram.com/_satyabrata.pal"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram profile of Satyabrata Pal"
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Instagram
          </a>
        </div>
      </div>

      {/* Mailto form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Send a message
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Fill in the fields below and click &ldquo;Open in Mail&rdquo; to send via your email client.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
            const senderEmail = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
            const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim();
            const body = encodeURIComponent(
              `Name: ${name}\nEmail: ${senderEmail}\n\n${message}`,
            );
            window.location.href = `${mailtoBase}&body=${body}`;
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="contact-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Your name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              placeholder="Ravi Kumar"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-transparent focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 transition"
            />
          </div>
          <div>
            <label
              htmlFor="contact-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Your email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-transparent focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 transition"
            />
          </div>
          <div>
            <label
              htmlFor="contact-message"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              required
              placeholder="How can we help you?"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-transparent focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 transition resize-y"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Open in Mail →
          </button>
        </form>
      </div>
    </div>
  );
}
