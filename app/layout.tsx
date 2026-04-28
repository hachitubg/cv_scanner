import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "@/app/globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "Lệ HR - CV Manager Scanner",
  description: "Ứng dụng nội bộ giúp team HR scan CV, quản lý pipeline và workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={plusJakartaSans.variable}>{children}</body>
    </html>
  );
}
