import { LucideIcon } from "lucide-react";
import { cn, formatNumber } from "../lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  iconClassName?: string;
}

export function StatsCard({
  title,
  value,
  subValue,
  icon: Icon,
  description,
  className,
  iconClassName,
}: StatsCardProps) {
  return (
    <div className={cn(
      "bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/30 relative overflow-hidden group",
      className
    )}>
      <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full -mr-10 -mt-10 sm:-mr-12 sm:-mt-12 group-hover:scale-110 transition-transform duration-500 opacity-50" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-sm", iconClassName)}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">{title}</p>
          <div className="flex flex-col">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
            {subValue && (
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">{subValue}</p>
            )}
          </div>
          {description && (
            <div className="flex items-center gap-1 mt-1.5 sm:mt-2">
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">{description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
