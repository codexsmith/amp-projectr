import type { Metadata } from "next";
import "./app.css";

export const metadata: Metadata = {
  title: "Projectr / YouTube Knowledge Explorer",
  description: "Turn long-form YouTube sources into searchable transcripts and navigable knowledge maps.",
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
