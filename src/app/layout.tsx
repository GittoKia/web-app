import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { GuestProvider } from "@/lib/guest-context";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caregiver AI",
  description: "AI-powered caregiver support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfairDisplay.variable} ${dmSans.variable} antialiased`}
      >
        <GuestProvider>{children}</GuestProvider>
      </body>
    </html>
  );
}
