"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Wallet, Menu, X, LogOut, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet-context";
import { Identicon } from "@/components/identicon";
import { ConnectWalletModal } from "@/components/connect-wallet-modal";

const LANDING_NAV = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Send Money", href: "/send" },
];

const APP_NAV = [
  { label: "Home", href: "/" },
  { label: "Send Money", href: "/send" },
];

function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const button = e.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;

  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

interface PopHeaderProps {
  variant?: "landing" | "app";
}

export function PopHeader({ variant = "landing" }: PopHeaderProps) {
  const { status, truncatedAddress, address, disconnect } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navLinks = variant === "app" ? APP_NAV : LANDING_NAV;

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);

      // Calculate scroll progress
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setScrollProgress((window.scrollY / docHeight) * 100);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (href.startsWith("#")) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const offset = 80;
          const top =
            target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: "smooth" });
        }
        setMobileMenuOpen(false);
      } else {
        setMobileMenuOpen(false);
      }
    },
    []
  );

  const copyAddress = useCallback(() => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  return (
    <>
      {/* Scroll progress bar */}
      {variant === "landing" && (
        <div
          className="scroll-progress"
          style={{ width: `${scrollProgress}%` }}
          aria-hidden="true"
        />
      )}

      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]",
          scrolled
            ? "border-b border-border/50 bg-[rgba(0,0,0,0.8)] backdrop-blur-xl shadow-lg shadow-black/20"
            : "bg-transparent"
        )}
      >
        <nav
          className={cn(
            "mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-8 transition-all duration-500",
            scrolled ? "py-2" : "py-4"
          )}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-bold text-foreground transition-opacity duration-300 hover:opacity-80"
          >
            <Image
              src="/isotipo.png"
              alt="POP logo"
              width={36}
              height={36}
              className={cn(
                "rounded-lg transition-all duration-500",
                scrolled ? "h-8 w-8" : "h-9 w-9"
              )}
            />
            <span className="tracking-tight">POP</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={cn(
                    "text-sm font-medium text-muted-foreground",
                    "transition-all duration-200",
                    "hover:text-foreground",
                    "focus-visible:outline-none focus-visible:text-foreground"
                  )}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium text-muted-foreground",
                    "transition-all duration-200",
                    "hover:text-foreground",
                    "focus-visible:outline-none focus-visible:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-3">
            {status === "connected" && truncatedAddress && address ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className={cn(
                    "ripple-container flex items-center gap-2 rounded-xl border border-border px-3 py-2",
                    "transition-all duration-200",
                    "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/10",
                    "active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <Identicon address={address} size={24} />
                  <span className="hidden text-sm font-mono font-medium text-foreground sm:block">
                    {truncatedAddress}
                  </span>
                </button>

                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileOpen(false)}
                      onKeyDown={() => {}}
                      role="button"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-xl shadow-black/30 animate-fade-in-scale">
                      <div className="mb-2 border-b border-border px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Connected
                        </p>
                        <p className="font-mono text-sm text-foreground">
                          {truncatedAddress}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          copyAddress();
                          setProfileOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground",
                          "transition-all duration-150",
                          "hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copied ? "Copied!" : "Copy Address"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          disconnect();
                          setProfileOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive",
                          "transition-all duration-150",
                          "hover:bg-destructive/10"
                        )}
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  addRipple(e);
                  setModalOpen(true);
                }}
                className={cn(
                  "ripple-container btn-shimmer flex items-center gap-2 rounded-xl px-5 py-2.5",
                  "bg-primary text-primary-foreground font-medium text-sm",
                  "transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5",
                  "active:scale-[0.98] active:shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "glow-pulse"
                )}
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn(
                "rounded-lg p-2 text-muted-foreground md:hidden",
                "transition-all duration-200",
                "hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border/50 bg-[rgba(0,0,0,0.9)] backdrop-blur-xl md:hidden animate-fade-in-up">
            <div className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) =>
                link.href.startsWith("#") ? (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground",
                      "transition-all duration-200",
                      "hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground",
                      "transition-all duration-200",
                      "hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          </div>
        )}
      </header>

      <ConnectWalletModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
