import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { GuestProvider } from "@/lib/guest-context";
import { ProfileProvider } from "@/lib/profile-context";
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
  title: "Carebridge AI",
  description: "Private, multilingual caregiver support for navigating care, coverage, and next steps.",
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
        <GuestProvider>
          <ProfileProvider>{children}</ProfileProvider>
        </GuestProvider>
      </body>
    </html>
  );
}
