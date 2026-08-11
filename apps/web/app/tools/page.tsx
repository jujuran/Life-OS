import type { Metadata } from "next";
import { ToolDesk } from "../../components/tools/tool-desk";

export const metadata: Metadata = {
  title: "工具台"
};

export default function ToolsPage() {
  return (
    <main className="page-shell">
      <ToolDesk />
    </main>
  );
}
