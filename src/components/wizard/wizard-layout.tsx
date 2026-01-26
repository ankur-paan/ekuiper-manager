
import * as React from "react";
import { WizardStepper } from "./wizard-stepper";
import { WizardOnboarding } from "./wizard-onboarding";
import { useQueryWizardStore } from "@/stores/wizard-store";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export function WizardLayout({ children, onFinish }: { children: React.ReactNode, onFinish?: () => void }) {
    const { currentStep, nextStep, prevStep, resetWizard } = useQueryWizardStore();

    const handleNext = () => {
        // TODO: Validate current step
        nextStep();
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-950/30">
            <WizardOnboarding />
            {/* Top Stepper */}
            <div className="flex-none">
                <WizardStepper />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                <ScrollArea className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto w-full min-h-full">
                        {children}
                    </div>
                </ScrollArea>

                {/* Navigation Footer */}
                <div className="flex-none p-4 border-t bg-card flex items-center justify-between">
                    <div className="flex gap-2">
                        <Button
                            id="tour-footer-back"
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 0}
                            className="gap-2"
                        >
                            <ChevronLeft className="h-4 w-4" /> Back
                        </Button>

                        <Button
                            id="tour-footer-reset"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 gap-1"
                            onClick={() => {
                                resetWizard();
                                toast.info("Wizard has been reset to defaults");
                            }}
                        >
                            <RotateCcw className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Reset</span>
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        {currentStep < 4 ? (
                            <Button id="tour-footer-next" onClick={handleNext} className="gap-2 min-w-[100px]">
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button id="tour-footer-finish" onClick={onFinish} className="gap-2 min-w-[100px] bg-green-600 hover:bg-green-700">
                                Finish
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
