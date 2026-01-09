import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        success:
          "border-transparent bg-success text-success-foreground",
        warning:
          "border-transparent bg-warning text-warning-foreground",
        info:
          "border-transparent bg-info text-info-foreground",
        outline:
          "text-foreground",
        // Status badges
        new:
          "border-transparent bg-blue-100 text-blue-800",
        contacted:
          "border-transparent bg-purple-100 text-purple-800",
        qualified:
          "border-transparent bg-green-100 text-green-800",
        proposal:
          "border-transparent bg-amber-100 text-amber-800",
        negotiation:
          "border-transparent bg-orange-100 text-orange-800",
        "closed-won":
          "border-transparent bg-emerald-100 text-emerald-800",
        "closed-lost":
          "border-transparent bg-red-100 text-red-800",
        disqualified:
          "border-transparent bg-gray-100 text-gray-800",
        // Ticket status badges
        open:
          "border-transparent bg-blue-100 text-blue-800",
        "in-progress":
          "border-transparent bg-amber-100 text-amber-800",
        "waiting-respon":
          "border-transparent bg-yellow-100 text-yellow-800",
        "waiting-customer":
          "border-transparent bg-purple-100 text-purple-800",
        closed:
          "border-transparent bg-green-100 text-green-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
