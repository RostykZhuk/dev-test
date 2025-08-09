import React from "react";
import { cn } from "@/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
