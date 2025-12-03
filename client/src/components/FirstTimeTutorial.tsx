import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface TutorialStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface FirstTimeTutorialProps {
  open: boolean;
  onComplete: () => void;
  steps: TutorialStep[];
  title?: string;
}

export function FirstTimeTutorial({
  open,
  onComplete,
  steps,
  title = "Welcome!",
}: FirstTimeTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setCurrentStep(0);
    onComplete();
  };

  const handleSkip = () => {
    setCurrentStep(0);
    onComplete();
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  if (!step) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} of {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </DialogHeader>

        <div className="py-6 space-y-4">
          {step.icon && (
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                {step.icon}
              </div>
            </div>
          )}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <DialogDescription className="text-sm leading-relaxed">
              {step.description}
            </DialogDescription>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex-1 sm:flex-initial gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {isFirstStep && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="flex-1 sm:flex-initial text-muted-foreground"
              >
                Skip
              </Button>
            )}
          </div>
          <Button onClick={handleNext} className="flex-1 sm:flex-initial gap-1">
            {isLastStep ? (
              "Ok, Got it!"
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
