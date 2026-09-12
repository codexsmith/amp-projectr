import type { Metadata } from "next";
import "./app.css";

export const metadata: Metadata = {
  title: "Projectr / YouTube Knowledge Explorer",
  description: "Turn a long video into navigable, searchable, timestamped knowledge whose answers stay tied to source evidence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
