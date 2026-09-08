import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // text-base (16px) below `sm:` avoids iOS/Android's auto-zoom-on-focus
          // for any input under 16px; sm: text-sm restores the original 14px on
          // larger viewports where zoom-on-focus doesn't happen.
          "flex h-11 w-full rounded-button border border-border bg-surface px-3.5 text-base sm:text-sm text-primary placeholder:text-muted transition-colors duration-150 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
