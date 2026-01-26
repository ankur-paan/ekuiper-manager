
import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useQueryWizardStore } from "@/stores/wizard-store";

export function WizardStepper() {
    const { currentStep, setStep } = useQueryWizardStore();

    const steps = [
        { title: "Source", description: "Select Data" },
        { title: "Filter", description: "Filter Rows" },
        { title: "Transform", description: "Select / Agg" },
        { title: "Sink", description: "Output Action" },
        { title: "Test", description: "Validate & Deploy" }
    ];

    return (
        <div className="flex w-full items-center justify-between p-4 bg-card border-b">
            {steps.map((step, idx) => {
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;

                return (
                    <div key={idx} className="flex flex-col items-center relative flex-1">
                        {/* Connector Line */}
                        {idx !== 0 && (
                            <div className={cn(
                                "absolute top-4 right-[50%] w-full h-[2px] -z-10",
                                isCompleted ? "bg-primary" : "bg-muted"
                            )} />
                        )}

                        <button
                            onClick={() => idx <= currentStep && setStep(idx)} // Allow clicking back
                            disabled={idx > currentStep}
                            className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 z-10",
                                isActive ? "border-primary bg-primary text-primary-foreground scale-110" :
                                    isCompleted ? "border-primary bg-primary text-primary-foreground" : "border-muted bg-muted text-muted-foreground"
                            )}
                        >
                            {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                        </button>

                        <div className="mt-2 text-center">
                            <div className={cn("text-xs font-semibold uppercase tracking-wide", isActive ? "text-primary" : "text-muted-foreground")}>
                                {step.title}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
