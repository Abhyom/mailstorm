import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const { handlers, signIn, signOut, auth } = NextAuth({
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		}),
	],
	debug: true, // Enable debug logs for more detailed error messages
});

export const { GET, POST } = handlers;
export { auth };
