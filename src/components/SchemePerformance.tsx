import React from 'react';
import { Layers, PieChart, TrendingUp, IndianRupee } from 'lucide-react';
import { formatCurrency, formatNumber } from '../lib/utils';
import { motion } from 'motion/react';

interface SchemeStat {
  name: string;
  count: number;
  value: number;
}

interface SchemePerformanceProps {
  data: SchemeStat[];
  title?: string;
}

export function SchemePerformance({ data, title = 'Scheme Performance' }: SchemePerformanceProps) {
  const totalCount = data.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 border border-slate-100 shadow-xl shadow-slate-200/40">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Breakdown by scheme type and enrollment value
          </p>
        </div>
        <div className="bg-blue-50 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl">
          <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {data.map((scheme, idx) => (
          <motion.div
            key={scheme.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.15em]">
                {scheme.name || 'Unknown'}
              </span>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:text-blue-600 transition-colors">
                <PieChart className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {formatNumber(scheme.count)}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Units
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-blue-600">
                  <IndianRupee className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="text-xs sm:text-sm font-black tracking-tight">
                    {formatCurrency(scheme.value)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Market Share</span>
                  <span>{((scheme.count / totalCount) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(scheme.count / totalCount) * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                    className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
