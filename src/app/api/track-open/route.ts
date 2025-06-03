// src/app/api/track-open/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
	const logId = request.nextUrl.searchParams.get("logId");

	if (!logId) {
		return new NextResponse(null, { status: 400 });
	}

	try {
		await prisma.emailAnalytics.upsert({
			where: { emailLogId: logId },
			update: {
				openedAt: new Date(),
			},
			create: {
				emailLogId: logId,
				openedAt: new Date(),
			},
		});

		// Return a 1x1 transparent pixel
		const pixel = Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
			"base64"
		);
		return new NextResponse(pixel, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "no-cache",
			},
		});
	} catch (error) {
		console.error("Error tracking email open:", error);
		return new NextResponse(null, { status: 500 });
	}
}
