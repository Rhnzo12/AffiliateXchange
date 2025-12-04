import * as React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useCompanyTour, TourStep } from "../contexts/CompanyTourContext";

interface TourTooltipProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  targetRect: DOMRect | null;
}

function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  targetRect,
}: TourTooltipProps) {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 16;
    const arrowSize = 12;

    let top = 0;
    let left = 0;

    const placement = step.placement || "bottom";

    switch (placement) {
      case "top":
        top = targetRect.top - tooltipRect.height - arrowSize - padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case "bottom":
        top = targetRect.bottom + arrowSize + padding;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case "left":
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - arrowSize - padding;
        break;
      case "right":
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + arrowSize + padding;
        break;
      case "center":
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
        break;
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    setTooltipPosition({ top, left });
  }, [targetRect, step.placement]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[10002] animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
      }}
    >
      <Card className="w-[320px] sm:w-[380px] shadow-2xl border-primary/20 overflow-hidden bg-background">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">
            Step {stepIndex + 1} of {totalSteps}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Icon */}
          {step.icon && (
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                {step.icon}
              </div>
            </div>
          )}
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.content}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-muted/30 border-t flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onSkip}
          >
            Skip tour
          </Button>
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={onNext} className="gap-1">
              {isLastStep ? (
                "Finish"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </Card>
    </div>
  );
}

interface SpotlightOverlayProps {
  targetRect: DOMRect | null;
  onClick?: () => void;
}

function SpotlightOverlay({ targetRect, onClick }: SpotlightOverlayProps) {
  const padding = 8;

  if (!targetRect) {
    // Center spotlight for welcome messages - lighter overlay like dialog backdrop
    return (
      <div
        className="fixed inset-0 z-[10000] bg-black/40 transition-all duration-300"
        onClick={onClick}
      />
    );
  }

  const spotlightStyle = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  return (
    <>
      {/* Lighter overlay with cutout */}
      <div
        className="fixed inset-0 z-[10000] transition-all duration-300"
        onClick={onClick}
        style={{
          background: `
            linear-gradient(to bottom,
              rgba(0,0,0,0.4) 0%,
              rgba(0,0,0,0.4) ${spotlightStyle.top}px,
              transparent ${spotlightStyle.top}px,
              transparent ${spotlightStyle.top + spotlightStyle.height}px,
              rgba(0,0,0,0.4) ${spotlightStyle.top + spotlightStyle.height}px
            ),
            linear-gradient(to right,
              rgba(0,0,0,0.4) 0%,
              rgba(0,0,0,0.4) ${spotlightStyle.left}px,
              transparent ${spotlightStyle.left}px,
              transparent ${spotlightStyle.left + spotlightStyle.width}px,
              rgba(0,0,0,0.4) ${spotlightStyle.left + spotlightStyle.width}px
            )
          `,
          backgroundBlendMode: "darken",
        }}
      />
      {/* Spotlight border */}
      <div
        className="fixed z-[10001] border-2 border-primary rounded-lg pointer-events-none"
        style={{
          top: spotlightStyle.top,
          left: spotlightStyle.left,
          width: spotlightStyle.width,
          height: spotlightStyle.height,
          boxShadow: `
            0 0 0 9999px rgba(0,0,0,0.4),
            0 0 15px 2px rgba(var(--primary), 0.2)
          `,
        }}
      />
    </>
  );
}

export function CompanyTour() {
  const {
    isRunning,
    currentStepIndex,
    currentPageSteps,
    nextStep,
    prevStep,
    skipTour,
  } = useCompanyTour();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = currentPageSteps[currentStepIndex];

  // Find and scroll to target element
  useEffect(() => {
    if (!isRunning || !currentStep) {
      setTargetRect(null);
      return;
    }

    const findElement = () => {
      // Handle "center" placement for welcome steps without target
      if (currentStep.target === "body" || currentStep.placement === "center") {
        setTargetRect(null);
        return;
      }

      const element = document.querySelector(currentStep.target);
      if (element) {
        // Scroll element into view
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });

        // Wait for scroll to complete then update rect
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        }, 300);
      } else {
        // Element not found, use center placement
        setTargetRect(null);
      }
    };

    // Small delay to allow DOM to settle
    const timer = setTimeout(findElement, 100);

    // Update position on resize/scroll
    const updatePosition = () => {
      if (currentStep.target === "body" || currentStep.placement === "center") {
        return;
      }
      const element = document.querySelector(currentStep.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isRunning, currentStep, currentStepIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isRunning) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        nextStep();
      } else if (e.key === "ArrowLeft") {
        prevStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, nextStep, prevStep, skipTour]);

  // Prevent body scroll when tour is active
  useEffect(() => {
    if (isRunning) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isRunning]);

  if (!isRunning || !currentStep) return null;

  return createPortal(
    <>
      <SpotlightOverlay targetRect={targetRect} />
      <TourTooltip
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={currentPageSteps.length}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
        targetRect={targetRect}
      />
    </>,
    document.body
  );
}

// Hook for individual pages to trigger their tour
export function usePageTour(pageId: string, steps: TourStep[]) {
  const { hasSeenPageTour, startTour, restartTour, isRunning, currentPageTourId } = useCompanyTour();
  const hasSeenRef = useRef(false);

  // Auto-start tour on first visit
  useEffect(() => {
    if (!hasSeenRef.current && !hasSeenPageTour(pageId) && steps.length > 0 && !isRunning) {
      hasSeenRef.current = true;
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        startTour(pageId, steps);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pageId, steps, hasSeenPageTour, startTour, isRunning]);

  const restart = useCallback(() => {
    restartTour(pageId, steps);
  }, [pageId, steps, restartTour]);

  return {
    restart,
    isActive: isRunning && currentPageTourId === pageId,
  };
}

