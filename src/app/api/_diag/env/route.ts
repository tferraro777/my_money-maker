import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL || "";
  // Return only safe parts
  const safe = url
    .replace(/:\/\/([^:]+):[^@]+@/,"//$1:***@") // mask password if present
    .slice(0, 200);
  return NextResponse.json({
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseUrlPrefix: safe,
    nodeEnv: process.env.NODE_ENV,
  });
}
