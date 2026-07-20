import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DRAGHUB — Virtual GitHub Desktop",
  description:
    "An adapter-ready virtual desktop UX for repositories, files, GitHub features and development tools.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
