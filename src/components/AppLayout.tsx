import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home, Shield, LogOut, Menu, User, Moon, Sun, XCircle, LogIn, Info, Brain, Sparkles,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SplashScreen } from "@/components/SplashScreen";
import pbLogo from "@/assets/pb-logo.png";

const navItems = [
  { to: "/dashboard", label: "होम / Home", icon: Home },
  { to: "/smart-revision", label: "स्मार्ट रिवीजन / Smart Revision", icon: Brain },
  { to: "/ai-mock-analyzer", label: "AI Mock Analyzer", icon: Sparkles },
];
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SplashScreen } from "@/components/SplashScreen";
import pbLogo from "@/assets/pb-logo.png";

const navItems = [
  { to: "/dashboard", label: "होम / Home", icon: Home },
  { to: "/smart-revision", label: "स्मार्ट रिवीजन / Smart Revision", icon: Brain },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <>
      {navItems.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to || location.pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && (localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches))
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Toggle theme">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, isGuest, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? (isGuest ? "GT" : "ST");

  return (
    <div className="min-h-screen bg-background">
      <SplashScreen />
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={pbLogo} alt="Practice Book logo" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <span className="text-base font-bold font-display leading-tight">Practice Book<br className="hidden sm:block" /> <span className="text-secondary">By Ajit</span></span>
          </Link>


          <nav className="hidden items-center gap-1 md:flex">
            <NavItems />
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-muted"
              >
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isGuest && !user && (
              <Button size="sm" onClick={() => navigate("/auth")} className="hidden sm:inline-flex">
                <LogIn className="mr-1 h-4 w-4" /> Sign In
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm text-muted-foreground truncate">
                  {user?.email ?? (isGuest ? "Guest / अतिथि" : "")}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" /> Profile / प्रोफ़ाइल
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/about")}>
                  <Info className="mr-2 h-4 w-4" /> About
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="mr-2 h-4 w-4" /> Admin Dashboard
                  </DropdownMenuItem>
                )}
                {isGuest && !user ? (
                  <DropdownMenuItem onClick={() => navigate("/auth")}>
                    <LogIn className="mr-2 h-4 w-4" /> Sign In / Create Account
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Logout / लॉगआउट
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>


            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="mt-8 flex flex-col gap-1">
                  <SheetClose><NavItems /></SheetClose>
                  {isAdmin && (
                    <Link to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-muted">
                      <Shield className="h-4 w-4" /> Admin
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="container py-6 animate-fade-in">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <img src={pbLogo} alt="Practice Book logo" width={28} height={28} className="mx-auto mb-2 h-7 w-7 rounded-lg" loading="lazy" />
        <p>© {new Date().getFullYear()} Practice Book By Ajit</p>
        <p className="mt-0.5">Designed &amp; Developed by Ajit Singh</p>
        <Link to="/about" className="story-link mt-1 inline-block text-primary">About</Link>
      </footer>

    </div>
  );
}

// Simple wrapper so NavItems closes the sheet on click
function SheetClose({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
