import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mie Mantap Okarei — Makan enak dekat asrama",
  description: "Pesan mie, makanan, dan minuman favoritmu di Asrama Telkom.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
