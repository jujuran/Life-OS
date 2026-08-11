import type { Metadata } from "next";
import { AiAgentWorkspace } from "../../components/ai/ai-agent-workspace";
import { readAiSettingsStore, toPublicAiSettings } from "../../lib/ai-settings-store";

export const metadata: Metadata = {
  title: "AI 模块 | Life OS"
};

type AiRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AiRoute({ searchParams }: AiRouteProps) {
  const resolvedSearchParams = await searchParams;
  const shouldOpenConfig = Boolean(resolvedSearchParams?.config);
  const presetParam = resolvedSearchParams?.preset;
  const keyParam = resolvedSearchParams?.key;
  const { settings, source } = await readAiSettingsStore();
  const publicSettings = toPublicAiSettings(settings, source);
  const initialPresetId = typeof presetParam === "string" ? presetParam : null;
  const initialEditKeyId = typeof keyParam === "string" ? keyParam : null;
  const initialNewKey = resolvedSearchParams?.newKey === "1";

  return (
    <main className="page-shell">
      <AiAgentWorkspace
        key={`${shouldOpenConfig ? "ai-config-open" : "ai-config-closed"}-${
          initialPresetId ?? "default"
        }-${initialNewKey ? "new" : initialEditKeyId ?? "active"}`}
        initialEditKeyId={initialEditKeyId}
        initialNewKey={initialNewKey}
        initialOpenSettings={shouldOpenConfig}
        initialPresetId={initialPresetId}
        initialSettings={publicSettings}
      />
    </main>
  );
}
