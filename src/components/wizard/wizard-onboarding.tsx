"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, MousePointer2, Info, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryWizardStore } from "@/stores/wizard-store";

/**
 * THE REACTIVE GUIDE
 * Instead of a fixed sequence, this guide looks at the STORE STATE
 * and identifies exactly which action is missing.
 */
export function WizardOnboarding() {
    const state = useQueryWizardStore();
    const [isVisible, setIsVisible] = React.useState(true);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0, height: 0 });

    // --- DECISION ENGINE ---
    const getActiveStep = () => {
        // STEP 1: SOURCE
        if (state.currentStep === 0) {
            if (state.sources.length === 0) {
                return {
                    targetId: "tour-step1-resource",
                    title: "1. Data Intake",
                    content: "Pick a stream (e.g. sdm120_stream) to start hearing industrial data.",
                    type: 'action'
                };
            }
            return {
                targetId: "tour-footer-next",
                title: "2. Progress",
                content: "Source is set! Click Next to define your logic.",
                type: 'info'
            };
        }

        // STEP 2: FILTER (The Layered Logic)
        if (state.currentStep === 1) {
            if (state.filters.length === 0) {
                return {
                    targetId: "tour-step2-add-first-condition",
                    title: "1. Create Logic Layer",
                    content: "Click this button to start your decision tree.",
                    type: 'action'
                };
            }

            const firstExpr = state.filters[0].expressions[0];

            if (firstExpr.field === "") {
                return {
                    targetId: "tour-step2-field-box",
                    title: "2. Define Target",
                    content: "Click this box. We need to tell the rule which device to watch.",
                    type: 'action'
                };
            }

            if (state.tourFocus === "step2-field-0" && firstExpr.field === "") {
                return {
                    targetId: "tour-step2-sidebar-devices",
                    title: "3. Pick a Device",
                    content: "Click an ID from the 'Devices' list on the right.",
                    type: 'action'
                };
            }

            if (firstExpr.field === "meta(topic)" && firstExpr.value !== "" && state.filters[0].expressions.length === 1) {
                return {
                    targetId: "tour-step2-add-requirement",
                    title: "4. Check the Data",
                    content: "Now add an 'AND' layer to check the sensor value (ON/OFF).",
                    type: 'action'
                };
            }

            if (state.filters[0].expressions.length > 1) {
                return {
                    targetId: "tour-footer-next",
                    title: "5. Logic Complete",
                    content: "You've mapped Topic -> Value. Ready for transform!",
                    type: 'info'
                };
            }
        }

        // STEP 3: TRANSFORM
        if (state.currentStep === 2) {
            if (state.selections.length === 0 && !state.aggregation.enabled) {
                return {
                    targetId: "tour-step3-keep-all-toggle",
                    title: "Data Selection",
                    content: "Decide if you want to keep ALL data or pick specific fields.",
                    type: 'info'
                };
            }
            return {
                targetId: "tour-footer-next",
                title: "Forward Result",
                content: "Looking good. One last step to set the target.",
                type: 'info'
            };
        }

        // STEP 4: SINK
        if (state.currentStep === 3) {
            return {
                targetId: "tour-footer-finish",
                title: "Final Act",
                content: "Set your target topic and deploy your industrial intelligence!",
                type: 'info'
            };
        }

        return null;
    };

    const activeTip = getActiveStep();

    // Position updates based on target element
    const targetId = activeTip?.targetId;

    React.useEffect(() => {
        if (!isVisible || !targetId) return;

        const updatePosition = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                setCoords(prev => {
                    // Poka-Yoke: Prevent infinite loop by checking if values actually changed
                    if (
                        prev.top === rect.top &&
                        prev.left === rect.left &&
                        prev.width === rect.width &&
                        prev.height === rect.height
                    ) return prev;

                    return {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    };
                });
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [targetId, isVisible]);

    if (!isVisible || !activeTip) return null;

    // --- VIEWPORT CALCULATIONS ---
    const isTargetInBottomHalf = coords.top > (typeof window !== 'undefined' ? window.innerHeight / 2 : 500);
    const tipVerticalGap = 24;
    const finalTop = isTargetInBottomHalf
        ? coords.top - tipVerticalGap - 120 // 120 is roughly tip height, or use -40 for simpler offset
        : coords.top + coords.height + tipVerticalGap;

    const finalLeft = Math.min(
        (typeof window !== 'undefined' ? window.innerWidth : 1200) - 340,
        Math.max(20, coords.left + (coords.width / 2) - 160)
    );

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Spotlight overlay with hole */}
            <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-all duration-300"
                style={{
                    clipPath: `polygon(
                        0% 0%, 0% 100%,
                        ${coords.left - 8}px 100%,
                        ${coords.left - 8}px ${coords.top - 8}px,
                        ${coords.left + coords.width + 8}px ${coords.top - 8}px,
                        ${coords.left + coords.width + 8}px ${coords.top + coords.height + 8}px,
                        ${coords.left - 8}px ${coords.top + coords.height + 8}px,
                        ${coords.left - 8}px 100%,
                        100% 100%, 100% 0%
                    )`
                }}
            />

            {/* Target Highlight */}
            <motion.div
                initial={false}
                animate={{
                    top: coords.top - 8,
                    left: coords.left - 8,
                    width: coords.width + 16,
                    height: coords.height + 16
                }}
                className={`absolute border-2 rounded-xl shadow-2xl pointer-events-none ${activeTip.type === 'action' ? 'border-orange-500 shadow-orange-500/20' : 'border-primary shadow-primary/20'}`}
            >
                <div className="absolute top-0 right-0 -mr-2 -mt-2">
                    <div className={`w-4 h-4 rounded-full animate-ping ${activeTip.type === 'action' ? 'bg-orange-500' : 'bg-primary'}`} />
                </div>
            </motion.div>

            {/* Instruction Bubble */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    top: isTargetInBottomHalf ? coords.top - 160 : coords.top + coords.height + 24,
                    left: finalLeft
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="absolute w-[320px] bg-card border shadow-2xl rounded-2xl p-6 pointer-events-auto glass-morphism overflow-hidden ring-1 ring-white/10"
            >
                <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-xl ${activeTip.type === 'action' ? 'bg-orange-500/10 text-orange-500' : 'bg-primary/10 text-primary'}`}>
                        {activeTip.type === 'action' ? <MousePointer2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black tracking-tight uppercase mb-1">{activeTip.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                            {activeTip.content}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full -mt-2 -mr-2" onClick={() => setIsVisible(false)}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>

                {activeTip.type === 'info' && (
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] font-bold uppercase tracking-widest text-primary"
                            onClick={() => setIsVisible(false)}
                        >
                            Got it
                        </Button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
