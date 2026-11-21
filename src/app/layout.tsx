import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
const roboto = localFont({
  src: [
    { path: "../../public/fonts/roboto-complete-300.woff", weight: "300" },
    { path: "../../public/fonts/roboto-complete-400.woff", weight: "400" },
    { path: "../../public/fonts/roboto-complete-500.woff", weight: "500" },
    { path: "../../public/fonts/roboto-complete-700.woff", weight: "700" },
  ],
  variable: "--font-roboto",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "Opti-X Billing", template: "%s · Opti-X" },
  description:
    "Optical billing, prescriptions and orders in one calm workspace.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await headers();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={roboto.variable}>{children}</body>
    </html>
  );
}
