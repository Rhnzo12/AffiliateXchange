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
    const scrollPosition = window.scrollY + 120; // Offset for header

    // Find the current section based on scroll position
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      const element = document.getElementById(section.id);
      if (element) {
        const offsetTop = element.offsetTop;
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
      const offsetTop = element.offsetTop - 100; // Offset for header
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth",
      });
    }
  };

  return (
    <nav
      className={cn(
        "sticky top-24 h-fit w-56 shrink-0 hidden lg:block",
        className
      )}
    >
      <div className="space-y-1">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left",
              activeSection === section.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
