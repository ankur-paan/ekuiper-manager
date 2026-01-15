
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HealthRingProps {
    score: number; // 0 to 100
    size?: number;
    label?: string;
    subLabel?: string;
    className?: string;
}

export function HealthRing({
    score,
    size = 120,
    label = "System Health",
    subLabel,
    className,
}: HealthRingProps) {
    const radius = size * 0.4;
    const strokeWidth = size * 0.1;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(Math.max(score, 0), 100);
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    // Color logic
    const getColor = (val: number) => {
        if (val >= 90) return "text-green-500";
        if (val >= 70) return "text-blue-500";
        if (val >= 50) return "text-yellow-500";
        return "text-red-500";
    };

    const colorClass = getColor(progress);

    return (
        <div className={cn("relative flex flex-col items-center justify-center", className)}>
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background Ring */}
                <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-muted/20"
                    />
                    {/* Progress Ring */}
                    <motion.circle
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeLinecap="round"
                        className={colorClass}
                    />
                </svg>

                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className={cn("text-3xl font-bold", colorClass)}
                    >
                        {progress}%
                    </motion.span>
                </div>
            </div>

            {label && (
                <div className="mt-2 text-center">
                    <p className="font-medium text-muted-foreground">{label}</p>
                    {subLabel && <p className="text-xs text-muted-foreground/70">{subLabel}</p>}
                </div>
            )}
        </div>
    );
}
