import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Home,
  TrendingUp,
  FileText,
  MessageSquare,
  Heart,
  Settings,
  DollarSign,
  Star,
  Building2,
  Users,
  ShieldCheck,
  Zap,
  ChevronDown,
  LogOut,
  Video,
  CalendarClock,
  ScrollText,
  Sliders,
} from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";

export function AppSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  // Close sidebar on mobile when navigation link is clicked
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const creatorItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
    },
    {
      title: "Browse Offers",
      url: "/browse",
      icon: TrendingUp,
    },
    {
      title: "Monthly Retainers",
      url: "/retainers",
      icon: CalendarClock,
    },
    {
      title: "My Applications",
      url: "/applications",
      icon: FileText,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: TrendingUp,
    },
    {
      title: "Messages",
      url: "/messages",
      icon: MessageSquare,
    },
    {
      title: "Favorites",
      url: "/favorites",
      icon: Heart,
    },
    {
      title: "Payment Management",
      url: "/creator/payment-settings",
      icon: DollarSign,
    },
  ];

  const companyItems = [
    {
      title: "Dashboard",
      url: "/company",
      icon: Home,
    },
    {
      title: "My Offers",
      url: "/company/offers",
      icon: TrendingUp,
    },
    {
      title: "Videos",
      url: "/company/videos",
      icon: Video,
    },
    {
      title: "Monthly Retainers",
      url: "/company/retainers",
      icon: CalendarClock,
    },
    {
      title: "Applications",
      url: "/company/applications",
      icon: FileText,
    },
    {
      title: "Creators",
      url: "/company/creators",
      icon: Users,
    },
    {
      title: "Analytics",
      url: "/company/analytics",
      icon: TrendingUp,
    },
    {
      title: "Messages",
      url: "/company/messages",
      icon: MessageSquare,
    },
    {
      title: "Reviews",
      url: "/company/reviews",
      icon: Star,
    },
    {
      title: "Payment Management",
      url: "/company/payment-settings",
      icon: DollarSign,
    },
  ];

  const adminItems = [
    {
      title: "Dashboard",
      url: "/admin",
      icon: Home,
    },
    {
      title: "Company Approvals",
      url: "/admin/companies",
      icon: Building2,
    },
    {
      title: "Offer Approvals",
      url: "/admin/offers",
      icon: TrendingUp,
    },
    {
      title: "Creator Management",
      url: "/admin/creators",
      icon: Users,
    },
    {
      title: "Review Management",
      url: "/admin/reviews",
      icon: Star,
    },
    {
      title: "Payment Management",
      url: "/admin/payment-settings",
      icon: DollarSign,
    },
    {
      title: "Audit Trail",
      url: "/admin/audit-logs",
      icon: ScrollText,
    },
    {
      title: "Platform Settings",
      url: "/admin/platform-settings",
      icon: Sliders,
    },
  ];

  const getMenuItems = () => {
    if (user?.role === 'company') return companyItems;
    if (user?.role === 'admin') return adminItems;
    return creatorItems;
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={handleNavClick}>
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
              <span className="font-bold text-lg">AffiliateXchange</span>
            </div>
          </Link>
          <NotificationCenter />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {user?.role === 'company' ? 'Company Portal' : user?.role === 'admin' ? 'Admin Panel' : 'Creator Portal'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/settings'} data-testid="nav-settings">
                  <Link href="/settings" onClick={handleNavClick}>
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full hover-elevate p-2 rounded-md" data-testid="button-user-menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || ''} alt={user?.firstName || 'User'} />
                <AvatarFallback>{user?.firstName?.[0] || user?.email?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{user?.firstName || user?.email || 'User'}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role || 'creator'}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={handleNavClick}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={async () => {
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
              }}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}