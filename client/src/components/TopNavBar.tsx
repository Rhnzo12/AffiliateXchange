import { Settings, ChevronDown, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../hooks/useAuth";
import { Link } from "wouter";
import { NotificationCenter } from "./NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

interface TopNavBarProps {
  children?: React.ReactNode;
}

export function TopNavBar({ children }: TopNavBarProps) {
  const { user } = useAuth();

  const displayName = user?.firstName || user?.email || "Account";

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b">
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side content (can be search bar or other content) */}
          {children && <div className="flex-1">{children}</div>}

          {/* Right Side Icons */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Notification Center with Dropdown */}
            <NotificationCenter />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 font-semibold text-sm gap-2"
                >
                  <span>{displayName}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || 'creator'}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
