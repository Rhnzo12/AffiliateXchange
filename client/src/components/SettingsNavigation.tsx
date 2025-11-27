import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "../lib/utils";

export interface SettingsSection {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SettingsNavigationProps {
  sections: SettingsSection[];
  className?: string;
}

export function SettingsNavigation({ sections, className }: SettingsNavigationProps) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id || "");
  const isScrollingRef = useRef(false);

  const handleScroll = useCallback(() => {
    // Don't update during programmatic scroll
    if (isScrollingRef.current) return;

    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;

    // Find which section is currently in the viewport
    let currentSection = sections[0]?.id || "";

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const element = document.getElementById(section.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        // Check if the top of the section is within the top half of the viewport
        // or if the section takes up most of the viewport
        if (rect.top <= viewportHeight * 0.4) {
          currentSection = section.id;
        }
      }
    }

    setActiveSection(currentSection);
  }, [sections]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Set scrolling flag to prevent scroll handler from interfering
      isScrollingRef.current = true;
      setActiveSection(sectionId);

      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      // Reset the flag after scroll animation completes
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 1000);
    }
  };

  return (
    <nav
      className={cn(
        "sticky top-24 h-fit w-48 shrink-0 hidden lg:block",
        className
      )}
    >
      <div className="space-y-1 border-l border-border pl-4">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all text-left border-l-2 -ml-[17px] pl-[15px]",
              activeSection === section.id
                ? "border-l-gray-900 bg-gray-100 text-gray-900 dark:border-l-gray-100 dark:bg-gray-800 dark:text-gray-100"
                : "border-l-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-300"
            )}
          >
            {section.icon}
            <span className="truncate">{section.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
