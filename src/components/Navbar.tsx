"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function Navbar() {
	const { data: session, status } = useSession();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef(null);
	const pathname = usePathname();

	const toggleDropdown = () => {
		setIsDropdownOpen((prev) => !prev);
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!(dropdownRef.current as HTMLElement).contains(
					event.target as Node
				)
			) {
				setIsDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<nav className="bg-black/80 backdrop-blur-md px-4 py-2 fixed w-full top-0 z-50 shadow-[0_0_10px_rgba(147,51,234,0.3)]">
			<div className="max-w-7xl mx-auto flex justify-between items-center h-[60px]">
				{/* Logo */}
				<Link
					href="/"
					className="flex items-center group h-[40px] gap-x-2 md:gap-x-4"
				>
					<Image
						src="/logo.png"
						alt="MailStorm Logo"
						width={128}
						height={40}
						className="transition-all duration-300 drop-shadow-lg w-20 md:w-24 object-contain"
					/>
					<span className="text-lg md:text-3xl mt-3 font-bold text-white transition-colors duration-300">
						Mail
						<span
							className="bg-clip-text text-transparent"
							style={{
								background:
									"linear-gradient(to top left, #ff0000, #fdcf58)",
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
							}}
						>
							Storm
						</span>
					</span>
				</Link>

				{/* Right Section */}
				<div className="relative" ref={dropdownRef}>
					{status === "loading" ? (
						<span className="text-slate-400">Loading...</span>
					) : session ? (
						<div>
							<button
								onClick={toggleDropdown}
								className="flex items-center space-x-2 text-white hover:text-purple-400 focus:outline-none"
							>
								<span>{session.user?.name || "User"}</span>
								<svg
									className={`w-4 h-4 transition-transform ${
										isDropdownOpen ? "rotate-180" : ""
									}`}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>

							{isDropdownOpen && (
								<div className="absolute right-0 mt-2 w-32 bg-black border border-gray-700 rounded-[10px] shadow-lg z-10">
									<button
										onClick={() =>
											signOut({ callbackUrl: "/" })
										}
										className="w-full px-2 py-2 text-white text-center hover:border border-amber-400 hover:rounded-[10px]"
									>
										Logout
									</button>
								</div>
							)}
						</div>
					) : (
						<button
							onClick={() =>
								signIn("google", { callbackUrl: pathname })
							}
							className="transform rounded-[10px] border !border-[#fdcf58] bg-transparent px-4 py-2 font-black uppercase text-transparent shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-white !bg-clip-text !bg-cover !bg-center"
							style={{
								background:
									"linear-gradient(to top left, #ff0000, #fdcf58)",
							}}
						>
							Login
						</button>
					)}
				</div>
			</div>
		</nav>
	);
}
