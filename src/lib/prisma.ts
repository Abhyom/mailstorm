// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

const prismaInstance = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production")
	globalForPrisma.prisma = prismaInstance;

export const prisma = prismaInstance;

export const PLAN_LIMITS = {
	FREE: { dailyLimit: 50, monthlyLimit: 1500 },
	STARTER: { dailyLimit: 1000, monthlyLimit: 30000 },
	PRO: { dailyLimit: 5000, monthlyLimit: 150000 },
	ENTERPRISE: { dailyLimit: 20000, monthlyLimit: 600000 },
	PAY_PER_USE: { dailyLimit: Infinity, monthlyLimit: Infinity },
};

export async function getUserWithLimits(email: string) {
	const user = await prisma.user.findUnique({
		where: { email },
		include: {
			campaigns: {
				orderBy: { createdAt: "desc" },
				take: 5,
			},
		},
	});

	if (!user) return null;

	// Reset daily counter if it's a new day
	const today = new Date();
	const lastReset = new Date(user.lastResetDate);

	if (
		today.getDate() !== lastReset.getDate() ||
		today.getMonth() !== lastReset.getMonth() ||
		today.getFullYear() !== lastReset.getFullYear()
	) {
		await prisma.user.update({
			where: { id: user.id },
			data: {
				emailsSentToday: 0,
				lastResetDate: today,
			},
		});

		user.emailsSentToday = 0;
	}

	return user;
}

export async function checkUserLimit(userId: string, emailCount: number) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) throw new Error("User not found");

	const limits = PLAN_LIMITS[user.plan];
	const canSend = {
		daily: user.emailsSentToday + emailCount <= limits.dailyLimit,
		monthly: user.emailsSentThisMonth + emailCount <= limits.monthlyLimit,
	};

	return {
		canSend: canSend.daily && canSend.monthly,
		limits,
		current: {
			daily: user.emailsSentToday,
			monthly: user.emailsSentThisMonth,
		},
		remaining: {
			daily: Math.max(0, limits.dailyLimit - user.emailsSentToday),
			monthly: Math.max(
				0,
				limits.monthlyLimit - user.emailsSentThisMonth
			),
		},
	};
}

export async function updateEmailCount(userId: string, emailCount: number) {
	await prisma.user.update({
		where: { id: userId },
		data: {
			emailsSentToday: { increment: emailCount },
			emailsSentThisMonth: { increment: emailCount },
			totalEmailsSent: { increment: emailCount },
			lastEmailSentAt: new Date(),
		},
	});
}

export async function createOrUpdateUser(profile: {
	email: string;
	name?: string;
	image?: string;
	googleId: string;
	accessToken?: string;
	refreshToken?: string;
}) {
	return await prisma.user.upsert({
		where: { email: profile.email },
		update: {
			name: profile.name,
			image: profile.image,
			accessToken: profile.accessToken,
			refreshToken: profile.refreshToken,
		},
		create: {
			email: profile.email,
			name: profile.name,
			image: profile.image,
			googleId: profile.googleId,
			accessToken: profile.accessToken,
			refreshToken: profile.refreshToken,
			plan: "FREE",
		},
	});
}
