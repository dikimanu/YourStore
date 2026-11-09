import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Us - YourStore",
  description:
    "Get in touch with YourStore. Send us a message, find our email, or connect on social media.",
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
