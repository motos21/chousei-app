import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Scheduler",
  description: "ログイン不要！URLを送るだけの最もシンプルな日程調整ツール。スマホ・PC対応。",
  
  // SNSでシェアされた時の設定
  openGraph: {
    title: "Smart Scheduler | 最強の日程調整ツール",
    description: "ログイン不要！URLを送るだけの最もシンプルな日程調整ツール。スマホ・PC対応。",
    siteName: "Smart Scheduler",
    locale: "ja_JP",
    type: "website",
  },
  // Twitter(X)でのカード設定
  twitter: {
    card: "summary_large_image",
    title: "Smart Scheduler",
    description: "ログイン不要！URLを送るだけの最もシンプルな日程調整ツール。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}