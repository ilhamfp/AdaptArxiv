import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProviders } from "@/providers/motion-providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdaptArxiv",
  description: "Real research, structured.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#ebebeb",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <head>
        <link
          rel="preload"
          href="/fonts/TRJN-DaVinci-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/TRJN-DaVinci-Italic.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/TRJN-DaVinci-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-dust text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-linen focus:text-black focus:px-4 focus:py-2 focus:c-link"
        >
          Skip to content
        </a>
        <MotionProviders>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProviders>
      </body>
    </html>
  );
}
