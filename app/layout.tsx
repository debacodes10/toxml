import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wireframe to XML",
  description: "Convert AI-generated wireframe text into draw.io XML.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
