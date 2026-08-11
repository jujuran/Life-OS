import type { Metadata } from "next";
import { ContentStudio } from "../../components/content/content-studio";

export const metadata: Metadata = {
  title: "内容系统"
};

export default function ContentPage() {
  return (
    <main className="page-shell">
      <ContentStudio />
    </main>
  );
}
