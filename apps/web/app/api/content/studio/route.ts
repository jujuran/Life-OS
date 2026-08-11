import { NextResponse } from "next/server";
import {
  normalizeContentStudioStore,
  readContentStudioStore,
  writeContentStudioStore,
  type ContentStudioStore
} from "../../../../lib/content-studio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContentStudioResponse = {
  ok: true;
  state: ContentStudioStore | null;
  source: "file" | "empty";
  message?: string;
};

type SaveContentStudioRequest = {
  state?: unknown;
};

export async function GET() {
  const { store, source } = await readContentStudioStore();

  return NextResponse.json<ContentStudioResponse>({
    ok: true,
    state: store,
    source
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaveContentStudioRequest;
  const nextStore = normalizeContentStudioStore(body.state ?? body);

  if (!nextStore) {
    return NextResponse.json(
      {
        message: "内容系统数据格式不正确，未写入本地文件。"
      },
      { status: 400 }
    );
  }

  await writeContentStudioStore(nextStore);

  return NextResponse.json<ContentStudioResponse>({
    ok: true,
    state: nextStore,
    source: "file",
    message: "内容系统数据已保存到本地文件。"
  });
}
