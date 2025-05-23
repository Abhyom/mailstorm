import { auth } from "@/app/api/auth/[...nextauth]/route";

export const middleware = auth;

export const config = {
	matcher: ["/edit"],
};
