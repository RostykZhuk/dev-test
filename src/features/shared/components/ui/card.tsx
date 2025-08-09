import React from "react";

export function Card({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border-b p-4 ${className ?? ""}`}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={`text-lg font-semibold text-black ${className ?? ""}`}>
      {children}
    </h2>
  );
}

export function CardContent({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className ?? ""}`}>{children}</div>;
}
