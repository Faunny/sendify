import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    region: process.env.AWS_REGION ?? "eu-west-1",
  });
}
