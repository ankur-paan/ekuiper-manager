
import React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "gradient" | "neon-blue" | "neon-purple" | "neon-green";
    hoverEffect?: boolean;
}

export function GlassCard({
    children,
    className,
    variant = "default",
    hoverEffect = false,
    ...props
}: GlassCardProps) {
    const variants = {
        default: "bg-background/60 border-border/50",
        gradient: "bg-gradient-to-br from-background/80 to-background/40 border-primary/20",
        "neon-blue": "bg-blue-500/5 border-blue-500/20 shadow-[0_0_15px_-5px_rgba(59,130,246,0.1)]",
        "neon-purple": "bg-purple-500/5 border-purple-500/20 shadow-[0_0_15px_-5px_rgba(168,85,247,0.1)]",
        "neon-green": "bg-green-500/5 border-green-500/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.1)]",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "rounded-xl border backdrop-blur-md shadow-sm relative overflow-hidden",
                variants[variant],
                hoverEffect && "hover:shadow-md hover:border-primary/40 hover:-translate-y-1 transition-all duration-300",
                className
            )}
            {...props}
        >
            {/* Subtle shine effect on hover for gradient variant */}
            {variant === "gradient" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            )}
            {children}
        </motion.div>
    );
}
