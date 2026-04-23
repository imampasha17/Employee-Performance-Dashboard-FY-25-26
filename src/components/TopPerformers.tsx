import React from "react";
import { Trophy, User, ArrowRight } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { motion } from "motion/react";

interface EmployeeStat {
  employeeCode: string;
  employeeName: string;
  location: string;
  totalCount: number;
  totalAmount: number;
}

interface TopPerformersProps {
  data: EmployeeStat[];
}

export function TopPerformers({ data }: TopPerformersProps) {
  const top10 = [...data]
    .sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0))
    .slice(0, 10);

  return (
    <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white shadow-2xl shadow-blue-900/30 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-[80px]" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full -ml-32 -mb-32 blur-[80px]" />
      
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <Trophy className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">Volume Titans</h3>
            </div>
            <p className="text-slate-400 text-sm sm:text-base font-medium max-w-xl">
              The top 10 employees by total installment count.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <User className="w-3.5 h-3.5" />
            <span>Top 10 Ranked</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
          {top10.map((employee, index) => (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              key={employee.employeeCode}
              className="bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-2xl p-4 sm:p-5 transition-all duration-500 group cursor-default backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-xs border border-blue-500/20">
                  {index + 1}
                </div>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                  {employee.location}
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="font-bold text-sm truncate group-hover:text-blue-400 transition-colors duration-300">
                  {employee.employeeName}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-2xl font-black tracking-tighter text-white">
                    {formatNumber(employee.totalCount)}
                  </div>
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Units
                  </div>
                </div>
              </div>
              
              <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(employee.totalCount / top10[0].totalCount) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
