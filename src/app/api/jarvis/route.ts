import { NextResponse } from "next/server";
import { answerJarvis } from "@/lib/jarvis-brain";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { message } = (await request.json()) as { message?: string };
    if (!message?.trim()) return NextResponse.json({ error: "Enter a message." }, { status: 400 });
    const answer = await answerJarvis(message.trim(), request.signal);
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Jarvis could not respond." }, { status: 500 });
  }
}
