import { TourStep } from "../contexts/CompanyTourContext";

// Tour IDs for each company page
export const COMPANY_TOUR_IDS = {
  DASHBOARD: "company-dashboard-tour",
  OFFERS: "company-offers-tour",
  OFFER_CREATE: "company-offer-create-tour",
  OFFER_DETAIL: "company-offer-detail-tour",
  RETAINERS: "company-retainers-tour",
  CREATOR_WORKFLOW: "company-creator-workflow-tour",
  ANALYTICS: "company-analytics-tour",
  REVIEWS: "company-reviews-tour",
  WEBSITE_VERIFICATION: "company-website-verification-tour",
  PAYMENT_SETTINGS: "company-payment-settings-tour",
} as const;

// Dashboard Tour Steps
export const dashboardTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Welcome to Your Company Dashboard!",
    content: "Let's take a quick tour to help you get started. We'll show you the key features and how to make the most of your company account.",
    placement: "center",
  },
  {
    target: "[data-testid='button-sidebar-toggle']",
    title: "Navigation Sidebar",
    content: "Access all your company features from the sidebar. Click here to expand or collapse it anytime.",
    placement: "right",
  },
  {
    target: "[data-testid='button-create-offer']",
    title: "Create Your First Offer",
    content: "Start attracting creators by creating affiliate offers. Click here to set up commission rates, requirements, and promotional materials.",
    placement: "bottom",
  },
  {
    target: "[data-testid='badge-applications-count']",
    title: "Manage Applications",
    content: "Review and manage creator applications here. You can approve, reject, or mark work as complete directly from the dashboard.",
    placement: "left",
  },
];

// Offers Page Tour Steps
export const offersTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Your Offers Hub",
    content: "This is where you manage all your affiliate offers. Create, edit, and track the performance of each offer.",
    placement: "center",
  },
  {
    target: "[data-testid='button-create-offer']",
    title: "Create New Offer",
    content: "Click here to create a new affiliate offer. You can set commission rates, add promotional materials, and define creator requirements.",
    placement: "bottom",
  },
  {
    target: ".grid.md\\:grid-cols-2",
    title: "Filter Your Offers",
    content: "Use these filters to find specific offers by status, commission type, or niche category.",
    placement: "bottom",
  },
];

// Offer Create Tour Steps
export const offerCreateTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Create Your Affiliate Offer",
    content: "Let's walk through creating an offer that will attract quality creators to promote your products or services.",
    placement: "center",
  },
  {
    target: "input[name='title']",
    title: "Offer Title",
    content: "Give your offer a compelling title that clearly describes what creators will be promoting.",
    placement: "bottom",
  },
  {
    target: "select, [role='combobox']",
    title: "Commission Settings",
    content: "Set your commission type and rate. Higher commissions typically attract more creators!",
    placement: "bottom",
  },
];

// Retainers Page Tour Steps
export const retainersTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Monthly Retainer Contracts",
    content: "Manage ongoing partnerships with creators through monthly retainer contracts. This provides consistent promotion for your brand.",
    placement: "center",
  },
];

// Creator Workflow Tour Steps
export const creatorWorkflowTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Creator Workflow Hub",
    content: "This is your central hub for managing all creator-related activities. Review applications, track active creators, and manage submitted content.",
    placement: "center",
  },
  {
    target: "[role='tablist']",
    title: "Switch Between Views",
    content: "Use these tabs to switch between Applications, Active Creators, and Video submissions.",
    placement: "bottom",
  },
];

// Analytics Tour Steps
export const analyticsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Analytics Dashboard",
    content: "Track your campaign performance with detailed analytics. Monitor clicks, conversions, and revenue across all your offers.",
    placement: "center",
  },
];

// Reviews Tour Steps
export const reviewsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Company Reviews",
    content: "View and respond to reviews from creators. Building a positive reputation helps attract quality creators to your offers.",
    placement: "center",
  },
];

// Website Verification Tour Steps
export const websiteVerificationTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Verify Your Website",
    content: "Verify ownership of your website to build trust with creators. Verified companies get a special badge and higher visibility.",
    placement: "center",
  },
];

// Payment Settings Tour Steps
export const paymentSettingsTourSteps: TourStep[] = [
  {
    target: "body",
    title: "Payment Settings",
    content: "Configure your payment methods and manage creator payouts. Set up automatic payments to keep your creators happy!",
    placement: "center",
  },
];

// Get tour steps by page ID
export function getTourSteps(pageId: string): TourStep[] {
  switch (pageId) {
    case COMPANY_TOUR_IDS.DASHBOARD:
      return dashboardTourSteps;
    case COMPANY_TOUR_IDS.OFFERS:
      return offersTourSteps;
    case COMPANY_TOUR_IDS.OFFER_CREATE:
      return offerCreateTourSteps;
    case COMPANY_TOUR_IDS.RETAINERS:
      return retainersTourSteps;
    case COMPANY_TOUR_IDS.CREATOR_WORKFLOW:
      return creatorWorkflowTourSteps;
    case COMPANY_TOUR_IDS.ANALYTICS:
      return analyticsTourSteps;
    case COMPANY_TOUR_IDS.REVIEWS:
      return reviewsTourSteps;
    case COMPANY_TOUR_IDS.WEBSITE_VERIFICATION:
      return websiteVerificationTourSteps;
    case COMPANY_TOUR_IDS.PAYMENT_SETTINGS:
      return paymentSettingsTourSteps;
    default:
      return [];
  }
}
