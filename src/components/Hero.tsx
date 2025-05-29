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
					<h1 className="mb-8 text-5xl font-bold tracking-tight text-white  lg:text-7xl">
						{"MailStorm".split("").map((char, index) => {
							// Determine if the character belongs to "Mail" (0–3) or "Storm" (4–8)
							const isMail = index >= 0 && index <= 3;
							const isStorm = index >= 4;

							// Define gradient style
							const gradientStyle = isMail
								? {
										background:
											"linear-gradient(to top left, #8e44ad, #c27aff, #e0b3ff)",
										WebkitBackgroundClip: "text",
										WebkitTextFillColor: "transparent",
								  }
								: {
										background:
											"linear-gradient(to top left, #ff0000, #fdcf58)",
										WebkitBackgroundClip: "text",
										WebkitTextFillColor: "transparent",
								  };

							return (
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
									style={gradientStyle}
									className="inline-block"
								>
									{char}
								</motion.span>
							);
						})}
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

						<button
							className="w-60 transform rounded-[10px] border !border-[#c27aff] bg-transparent px-6 py-3 font-black uppercase text-transparent shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-white !bg-clip-text !bg-cover !bg-center"
							style={{
								background:
									"linear-gradient(to top left, #4b0082, #8e44ad, #c27aff)",
							}}
						>
							Learn More
						</button>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
