import "./globals.css";

export const metadata = {
  title: "PLAYWELL 안내문 스튜디오",
  description: "분기·대회·특강 안내문 작성과 PDF·이미지 다운로드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
