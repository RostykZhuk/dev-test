import React from "react";
import { cn } from "@/utils/cn";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn("block text-sm font-medium text-gray-700", className)}
      {...props}
    />
  );
});
Label.displayName = "Label";
