"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation"; // Import usePathname
import Image from "next/image";

export function Navbar() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pathname = usePathname(); // Get the current path

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <nav className="bg-black/80 backdrop-blur-md p-4 fixed w-full top-0 z-50 shadow-[0_0_10px_rgba(147,51,234,0.3)]">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link
          href="/"
          className="flex items-center space-x-2 group transition-all duration-300"
        >
          <div className="relative flex items-center justify-center h-4 w-14 overflow-hidden">
            {/* Main logo with tilt and effects */}
            <Image
              src="/logo.png" // Place your PNG in the public folder
              alt="MailStorm Logo"
              width={56}
              height={56}
              className="transform -rotate-12 transition-all duration-300 group-hover:rotate-0 group-hover:scale-110 drop-shadow-lg group-hover:drop-shadow-[0_0_8px_rgba(147,51,234,0.4)]"
            />
          </div>
          <span className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors duration-300">
            MailStorm
          </span>
        </Link>

        <div className="relative">
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
                <div className="absolute right-0 mt-2 w-48 bg-black border border-gray-700 rounded-[0.25rem] shadow-lg">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl: pathname })} // Use current path as callbackUrl
              className="transform rounded-[10px] border !border-[#fdcf58] bg-transparent px-4 py-2 font-black uppercase text-transparent shadow-[0_0_10px_rgba(147,51,234,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-white !bg-clip-text !bg-cover !bg-center"
              style={{
                background: "linear-gradient(to top left, #ff0000, #fdcf58)",
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
