"use client";

const Navbar = () => {
	return (
		<nav className="relative z-50 flex w-full items-center justify-between px-6 py-4 backdrop-blur-md bg-black border-b border-white/20">
			<div className="flex items-center gap-3">
				<div className="size-8 rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-100 shadow-[0_0_10px_rgba(147,51,234,0.6)] " />
				<h1 className="text-xl font-extrabold tracking-tight text-white">
					MailStorm
				</h1>
			</div>

			<button className="rounded-2xl border border-white px-5 py-2 text-sm font-medium text-white shadow-[0_0_10px_rgba(147,51,234,0.4)] transition-all hover:-translate-y-0.5 hover:bg-white hover:text-black">
				Login
			</button>
		</nav>
	);
};

export default Navbar;
