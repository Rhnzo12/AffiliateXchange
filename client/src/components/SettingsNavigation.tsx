import { useEffect, useState, useCallback } from "react";
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

  const handleScroll = useCallback(() => {
    const scrollPosition = window.scrollY + 150; // Offset for header

    // Find the current section based on scroll position
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      const element = document.getElementById(section.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        const offsetTop = rect.top + window.scrollY;
        if (scrollPosition >= offsetTop) {
          setActiveSection(section.id);
          break;
        }
      }
    }
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
      const rect = element.getBoundingClientRect();
      const offsetTop = rect.top + window.scrollY - 100; // Offset for header
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
      setActiveSection(sectionId);
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
