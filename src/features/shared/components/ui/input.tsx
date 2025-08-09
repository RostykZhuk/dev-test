import React from "react";
import { cn } from "@/utils/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
