import React from "react";
import { useAuth } from "../../hooks/useAuth";

export default function Header() {
  const { user } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <header className="w-full sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-100/80 shadow-sm">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-tertiary flex items-center justify-center shadow-md shadow-primary/10">
          <span className="text-white font-bold text-sm">ii</span>
        </div>
        <div className="text-base font-semibold tracking-tight">
          <span className="text-primary font-bold">Ipon</span>
          <span className="text-tertiary font-bold">-</span>
          <span className="text-slate-750 font-bold">Ipon</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-2 bg-slate-50 py-1 px-2.5 rounded-full border border-slate-100">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-200 to-slate-350 flex items-center justify-center text-[10px] font-bold text-slate-700">
            {getInitials(user?.name)}
          </div>
          <span className="text-xs font-medium text-slate-655 max-w-[80px] truncate">
            {user?.name || "User"}
          </span>
        </div>
      </div>
    </header>
  );
}
