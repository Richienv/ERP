import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { isLocalDemoAllowed, LOCAL_DEMO_COOKIE, LOCAL_DEMO_EMAIL } from "@/lib/local-demo"
import { prisma } from "@/lib/prisma"

export async function GET() {
    if (!isLocalDemoAllowed()) {
        return NextResponse.json({ error: "Demo lokal tidak aktif" }, { status: 404 })
    }
    const jar = await cookies()
    const active = jar.get(LOCAL_DEMO_COOKIE)?.value === "1"
    return NextResponse.json({
        active,
        email: active ? LOCAL_DEMO_EMAIL : null,
    })
}

export async function POST() {
    if (!isLocalDemoAllowed()) {
        return NextResponse.json({ error: "Demo lokal tidak aktif" }, { status: 404 })
    }

    await prisma.user.upsert({
        where: { email: LOCAL_DEMO_EMAIL },
        create: { email: LOCAL_DEMO_EMAIL, name: "Demo KRI", role: "ADMIN" },
        update: { role: "ADMIN", name: "Demo KRI" },
    })

    const res = NextResponse.json({ ok: true })
    res.cookies.set(LOCAL_DEMO_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 60 * 12,
    })
    return res
}

export async function DELETE() {
    if (!isLocalDemoAllowed()) {
        return NextResponse.json({ error: "Demo lokal tidak aktif" }, { status: 404 })
    }
    const res = NextResponse.json({ ok: true })
    res.cookies.set(LOCAL_DEMO_COOKIE, "", { path: "/", maxAge: 0 })
    return res
}
