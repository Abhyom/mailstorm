"use client";

import { motion } from "framer-motion";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation"; // Import useRouter

export function Hero() {
	const { data: session, status } = useSession(); // Check session status
	const router = useRouter(); // For navigation

	const handleGetStarted = () => {
		if (session) {
			// If user is logged in, navigate directly to /upload
			router.push("/upload");
		} else {
			// If user is not logged in, initiate sign-in
			signIn("google", { callbackUrl: "/upload" });
		}
	};

	return (
		<div className="relative h-screen overflow-hidden">
			<div className="absolute inset-0">
				<div className="absolute inset-0 -z-10 h-full w-full [background:radial-gradient(125%_125%_at_50%_10%,#000_40%,#9333ea_100%)]" />
			</div>

			<div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
				<div className="max-w-3xl text-center">
					<h1 className="mb-8 text-2xl font-bold tracking-tight text-white sm:text-4xl lg:text-7xl">
						{"MailStorm".split("").map((char, index) => (
							<motion.span
								key={index}
								initial={{
									opacity: 0,
									filter: "blur(4px)",
									y: 10,
								}}
								animate={{
									opacity: 1,
									filter: "blur(0px)",
									y: 0,
								}}
								transition={{
									duration: 0.3,
									delay: index * 0.05,
								}}
								className={
									index >= 4 && index <= 8
										? "inline-block text-purple-400"
										: "inline-block"
								}
							>
								{char}
							</motion.span>
						))}
					</h1>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.4, delay: 0.8 }}
						className="mx-auto mb-8 max-w-2xl text-lg text-slate-300"
					>
						Upload your CSV and launch a storm of personalized bulk
						cold emails.
					</motion.p>

					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.3, delay: 1 }}
						className="flex flex-wrap justify-center gap-4"
					>
						<button
							onClick={handleGetStarted} // Use the new handler
							className="w-60 transform rounded-[10px] border !border-[#fdcf58] bg-transparent px-6 py-3 font-black uppercase text-transparent shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-white !bg-clip-text !bg-cover !bg-center"
							style={{
								background:
									"linear-gradient(to top left, #ff0000, #fdcf58)",
							}}
						>
							Get Started
						</button>

						<button className="w-60 transform rounded-[10px] border border-slate-700 bg-slate-800 px-6 py-3 font-medium text-white shadow-[0_0_10px_rgba(147,51,234,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-700">
							Learn More
						</button>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
