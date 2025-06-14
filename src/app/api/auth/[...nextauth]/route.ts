// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { getUserWithLimits, createOrUpdateUser } from "../../../../lib/prisma";

// Define the custom session type
declare module "next-auth" {
	interface Session {
		accessToken?: string;
		refreshToken?: string;
		user: {
			id?: string | undefined;
			email?: string;
			name?: string;
			image?: string;
			plan?: string;
			emailsSentToday?: number;
			emailsSentThisMonth?: number;
		};
	}

	interface JWT {
		accessToken?: string;
		refreshToken?: string;
		plan?: string;
		emailsSentToday?: number;
		emailsSentThisMonth?: number;
		id?: string;
	}
}

export const authOptions: NextAuthConfig = {
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			authorization: {
				params: {
					scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose",
					access_type: "offline",
					prompt: "consent",
				},
			},
		}),
	],
	callbacks: {
		async jwt({ token, account, profile }) {
			if (account && profile && token.email) {
				token.accessToken = account.access_token;
				token.refreshToken = account.refresh_token;

				try {
					// Save or update the user in the database with tokens and googleId
					const user = await createOrUpdateUser({
						email: token.email,
						name: token.name ?? undefined,
						image: token.picture ?? undefined,
						googleId: profile.sub as string, // 'sub' is the Google ID
						accessToken: account.access_token,
						refreshToken: account.refresh_token,
					});

					token.plan = user.plan;
					token.emailsSentToday = user.emailsSentToday;
					token.emailsSentThisMonth = user.emailsSentThisMonth;
					token.id = user.id;
				} catch (error) {
					console.error(
						"Failed to create/update user in database:",
						error
					);
					// Optionally, you can throw the error to fail the authentication process
					// throw new Error("Failed to save user data");
				}
			}
			return token;
		},
		async session({ session, token }) {
			if (typeof token.accessToken === "string")
				session.accessToken = token.accessToken;
			if (typeof token.refreshToken === "string")
				session.refreshToken = token.refreshToken;
			if (token.plan) {
				session.user.plan =
					typeof token.plan === "string" ? token.plan : "";
				session.user.emailsSentToday =
					typeof token.emailsSentToday === "number"
						? token.emailsSentToday
						: undefined;
				session.user.emailsSentThisMonth =
					typeof token.emailsSentThisMonth === "number"
						? token.emailsSentThisMonth
						: undefined;
				session.user.id = typeof token.id === "string" ? token.id : "";
			}
			return session;
		},
	},
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

// Export the HTTP methods from handlers
export const { GET, POST } = handlers;
