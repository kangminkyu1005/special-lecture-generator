import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://special-lecture-generator.rotmxm.chatgpt.site"),
  title: "PLAYWELL 안내문 스튜디오",
  description: "분기·대회·특강 안내문 작성과 PDF·이미지 다운로드",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "PLAYWELL 안내문 스튜디오",
    title: "PLAYWELL 안내문 스튜디오",
    description: "분기·대회·특강 안내문 작성과 PDF·이미지 다운로드",
    images: [{ url: "/og.png?v=20261001", width: 1200, height: 630, alt: "PLAYWELL 안내문 스튜디오 · 대회·특강·분기 안내문" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLAYWELL 안내문 스튜디오",
    description: "분기·대회·특강 안내문 작성과 PDF·이미지 다운로드",
    images: ["/og.png?v=20261001"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
