import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppFrameNav } from "../components/app-frame-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Life OS",
    template: "%s | Life OS"
  },
  description: "Personal operating system with finance as the first live module."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-frame">
          <div className="app-frame__bar">
            <Link className="app-frame__brand" href="/">
              Life OS
            </Link>
            <AppFrameNav />
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
