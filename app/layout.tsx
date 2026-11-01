import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ボートレース 予想・買い目一覧",
  description: "出走情報を確認して予想と買い目の一覧を作成します。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
