import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "opengorky",
  description: "A free, local-first interactive canvas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cloudflareAnalyticsToken = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();

  return (
    <html lang="en">
      <body>
        {children}
        {cloudflareAnalyticsToken ? (
          <script
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cloudflareAnalyticsToken })}
          />
        ) : null}
      </body>
    </html>
  );
}
