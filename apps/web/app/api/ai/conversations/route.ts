import { NextResponse } from "next/server";
import {
  normalizeAiConversationStore,
  readAiConversationStore,
  writeAiConversationStore,
  type AiConversationStore
} from "../../../../lib/ai-conversation-store";

export const runtime = "nodejs";

type AiConversationsResponse = {
  ok: true;
  store: AiConversationStore;
};

export async function GET() {
  const store = await readAiConversationStore();

  return NextResponse.json<AiConversationsResponse>({
    ok: true,
    store
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<AiConversationStore>;
  const store = await writeAiConversationStore(normalizeAiConversationStore(body));

  return NextResponse.json<AiConversationsResponse>({
    ok: true,
    store
  });
}
