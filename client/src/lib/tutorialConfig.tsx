import * as React from "react";
import {
  LayoutDashboard,
  Search,
  FileText,
  MessageSquare,
  TrendingUp,
  Settings,
  DollarSign,
  Users,
  Plus,
  CheckCircle,
  Heart,
  BarChart3,
  Wallet,
  ClipboardList,
} from "lucide-react";
import type { TutorialStep } from "../components/FirstTimeTutorial";

// Tutorial IDs
export const TUTORIAL_IDS = {
  CREATOR_DASHBOARD: "creator-dashboard-tutorial",
  COMPANY_DASHBOARD: "company-dashboard-tutorial",
  BROWSE_PAGE: "browse-page-tutorial",
} as const;

// Creator Dashboard Tutorial Steps
export const creatorDashboardTutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to Your Dashboard!",
    description:
      "This is your central hub for managing your affiliate campaigns. Here you can track your performance, view recommended offers, and take quick actions.",
    icon: <LayoutDashboard className="h-8 w-8 text-primary" />,
  },
  {
    title: "Discover Your Perks",
    description:
      "Check out the carousel above to learn about all the benefits of being a creator on our platform, including competitive commissions and real-time analytics.",
    icon: <Heart className="h-8 w-8 text-primary" />,
  },
  {
    title: "Track Your Activity",
    description:
      "The activity chart shows your earnings over time. You can see trends in your performance and click 'View full analytics suite' for detailed insights.",
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
  },
  {
    title: "Quick Actions",
    description:
      "Use the Quick Actions cards to navigate to common tasks like browsing offers, viewing applications, checking messages, and updating your profile.",
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
  },
  {
    title: "Recommended Offers",
    description:
      "We match you with offers based on your content niches. Make sure to set up your niches in Settings to get personalized recommendations!",
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
  },
];

// Company Dashboard Tutorial Steps
export const companyDashboardTutorialSteps: TutorialStep[] = [
  {
    title: "Welcome to Your Company Dashboard!",
    description:
      "This is your command center for managing affiliate campaigns. Track creator performance, manage applications, and monitor your offers.",
    icon: <LayoutDashboard className="h-8 w-8 text-primary" />,
  },
  {
    title: "Create New Offers",
    description:
      "Click the 'Create New Offer' button to post new affiliate opportunities. Creators will be able to discover and apply to your offers.",
    icon: <Plus className="h-8 w-8 text-primary" />,
  },
  {
    title: "Monitor Your Stats",
    description:
      "The stats cards show your active creators, live offers, total applications, and click performance at a glance.",
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
  },
  {
    title: "Manage Applications",
    description:
      "Review creator applications in the 'Recent Applications' section. You can approve, reject, or mark work as complete from here.",
    icon: <FileText className="h-8 w-8 text-primary" />,
  },
  {
    title: "Top Performing Creators",
    description:
      "See which creators are driving the most results for your campaigns. Use this insight to build stronger partnerships.",
    icon: <Users className="h-8 w-8 text-primary" />,
  },
];

// Browse Page Tutorial Steps
export const browsePageTutorialSteps: TutorialStep[] = [
  {
    title: "Discover Affiliate Offers",
    description:
      "Welcome to the Browse page! Here you can find affiliate opportunities from verified brands that match your content style.",
    icon: <Search className="h-8 w-8 text-primary" />,
  },
  {
    title: "Filter by Category",
    description:
      "Use the category pills at the top to quickly filter offers by type. Select 'Trending' for popular offers or choose specific niches.",
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
  },
  {
    title: "Advanced Filters",
    description:
      "Click the 'Filters' button to access advanced options like commission type, minimum payout, company rating, and more.",
    icon: <Settings className="h-8 w-8 text-primary" />,
  },
  {
    title: "Save Your Favorite Offers",
    description:
      "Click the heart icon on any offer card to save it to your favorites. You can access them later from the Favorites page.",
    icon: <Heart className="h-8 w-8 text-primary" />,
  },
  {
    title: "Save Your Searches",
    description:
      "Found a useful filter combination? Save it using the 'Save search' button to quickly apply the same filters later.",
    icon: <CheckCircle className="h-8 w-8 text-primary" />,
  },
];
