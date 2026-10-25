import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OUR'S Smart Classroom",
  description: "A secure multi-institution campus portal for academics, attendance, assessments, fees and classroom intelligence.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true, title:"OUR'S", statusBarStyle:"default"},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
