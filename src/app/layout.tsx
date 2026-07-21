import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DRAGHUB — Virtual GitHub Desktop",
  description:
    "An adapter-ready virtual desktop UX for repositories, files, GitHub features and development tools.",
  openGraph: {
    title: "DRAGHUB — Virtual GitHub Desktop",
    description:
      "An adapter-ready virtual desktop UX for repositories, files, GitHub features and development tools.",
    images: ["/branding/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/branding/logo.png"],
  },
};

// Runs before React hydrates and before first paint, so the persisted theme
// is on <html> immediately — no light-then-dark (or dark-then-light) flash.
// React itself always starts from "light" (see DraghubThemeProvider) so
// hydration never disagrees with what the server rendered; this script only
// ever affects the DOM directly, which is exactly what
// `suppressHydrationWarning` on <html> below is for.
const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("draghub-theme");
    var mode = stored === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
