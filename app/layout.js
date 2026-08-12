import "./globals.css";

export const metadata = {
  title: "특강 안내문 생성기",
  description: "대회 및 특강 안내문을 작성하고 미리 보는 PLAYWELL 도구",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
