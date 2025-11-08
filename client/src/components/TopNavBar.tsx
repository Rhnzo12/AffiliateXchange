import { Bell, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../hooks/useAuth";
import { Link } from "wouter";

interface TopNavBarProps {
  children?: React.ReactNode;
}

export function TopNavBar({ children }: TopNavBarProps) {
  const { user } = useAuth();

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    const name = user.name || user.email || "User";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side content (can be search bar or other content) */}
          {children && <div className="flex-1">{children}</div>}

          {/* Right Side Icons */}
          <div className="flex items-center gap-3 ml-auto">
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              {getUserInitials()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
