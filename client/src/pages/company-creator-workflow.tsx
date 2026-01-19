import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { TopNavBar } from "../components/TopNavBar";
import CompanyVideos from "./company-videos";
import CompanyApplications from "./company-applications";
import CompanyCreators from "./company-creators";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, creatorWorkflowTourSteps } from "../lib/companyTourConfig";

type WorkflowTab = "videos" | "applications" | "creators";

const tabRoutes: Record<WorkflowTab, string> = {
  videos: "/company/videos",
  applications: "/company/applications",
  creators: "/company/creators",
};

function isWorkflowTab(value: string): value is WorkflowTab {
  return value === "videos" || value === "applications" || value === "creators";
}

function tabFromPath(path: string): WorkflowTab | null {
  const match = (Object.entries(tabRoutes) as [WorkflowTab, string][]).find(([, route]) => route === path);
  return match ? match[0] : null;
}

type CompanyCreatorWorkflowProps = {
  defaultTab?: WorkflowTab;
};

export default function CompanyCreatorWorkflow({ defaultTab = "videos" }: CompanyCreatorWorkflowProps) {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<WorkflowTab>(defaultTab);

  // Quick tour for creator workflow page
  useCompanyPageTour(COMPANY_TOUR_IDS.CREATOR_WORKFLOW, creatorWorkflowTourSteps);

  useEffect(() => {
    const routeTab = tabFromPath(location);
    if (routeTab && routeTab !== activeTab) {
      setActiveTab(routeTab);
    }
  }, [activeTab, location]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = (value: string) => {
    if (!isWorkflowTab(value)) return;
    setActiveTab(value);
    const nextPath = tabRoutes[value];
    if (nextPath !== location) {
      setLocation(nextPath);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar />

      {/* Header with Gradient Wave */}
      <div className="relative bg-white border-b">
        {/* Gradient Wave Decoration - Hidden on mobile for cleaner look */}
        <div className="absolute top-0 right-0 w-64 md:w-96 h-full pointer-events-none overflow-hidden hidden sm:block">
          <svg
            viewBox="0 0 400 200"
            className="absolute -right-10 md:-right-20 -top-5 md:-top-10 w-[300px] md:w-[500px] h-[150px] md:h-[250px] opacity-60"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#99f6e4" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#5eead4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path
              d="M0,100 Q100,50 200,80 T400,60 L400,0 L0,0 Z"
              fill="url(#waveGradient1)"
            />
            <path
              d="M0,120 Q150,70 250,100 T400,80 L400,0 L0,0 Z"
              fill="url(#waveGradient2)"
            />
            <path
              d="M0,140 Q120,100 220,120 T400,100 L400,0 L0,0 Z"
              fill="url(#waveGradient1)"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 relative z-10">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Creator Workflow</h1>

          {/* Tabs - Scrollable on mobile */}
          <div className="mt-4 md:mt-6 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="flex w-max min-w-full items-center justify-start gap-6 md:gap-8 border-b border-gray-200 bg-transparent p-0">
                <TabsTrigger
                  value="videos"
                  className="relative h-auto rounded-none bg-transparent px-0 pb-2.5 md:pb-3 text-sm font-semibold text-gray-500 whitespace-nowrap data-[state=active]:bg-transparent data-[state=active]:text-gray-900 data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:top-full data-[state=active]:after:block data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
                >
                  Promotional Videos
                </TabsTrigger>
                <TabsTrigger
                  value="applications"
                  className="relative h-auto rounded-none bg-transparent px-0 pb-2.5 md:pb-3 text-sm font-semibold text-gray-500 whitespace-nowrap data-[state=active]:bg-transparent data-[state=active]:text-gray-900 data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:top-full data-[state=active]:after:block data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
                >
                  Applications
                </TabsTrigger>
                <TabsTrigger
                  value="creators"
                  className="relative h-auto rounded-none bg-transparent px-0 pb-2.5 md:pb-3 text-sm font-semibold text-gray-500 whitespace-nowrap data-[state=active]:bg-transparent data-[state=active]:text-gray-900 data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:top-full data-[state=active]:after:block data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
                >
                  Approved Creators
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsContent value="videos" className="mt-0">
            <CompanyVideos hideTopNav />
          </TabsContent>

          <TabsContent value="applications" className="mt-0">
            <CompanyApplications hideTopNav />
          </TabsContent>

          <TabsContent value="creators" className="mt-0">
            <CompanyCreators hideTopNav />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
