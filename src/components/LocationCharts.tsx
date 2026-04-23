import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { IndianRupee, TrendingUp } from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/utils";

interface LocationStats {
  location: string;
  totalCount: number;
  totalAmount: number;
  employeeCount: number;
}

interface LocationChartsProps {
  data: LocationStats[];
  schemeData: { name: string; value: number }[];
  onLocationClick?: (location: string) => void;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export function LocationCharts({ data, schemeData, onLocationClick }: LocationChartsProps) {
  const topStores = [...data].sort((a, b) => b.totalCount - a.totalCount).slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Top Stores by Installments Chart */}
      <div className="lg:col-span-3 bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Store Rankings</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Top 10 locations by installment volume (Click to view details)</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Installments</span>
          </div>
        </div>

        <div className="h-[300px] sm:h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <BarChart
              data={topStores}
              layout="vertical"
              margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
              onClick={(data) => {
                if (data && data.activeLabel && onLocationClick) {
                  onLocationClick(String(data.activeLabel));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis
                dataKey="location"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 10, fontWeight: 700 }}
                width={100}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc", cursor: "pointer" }}
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                  padding: "16px",
                }}
                formatter={(value: number) => [formatNumber(value), "Installments"]}
              />
              <Bar
                dataKey="totalCount"
                fill="#10b981"
                radius={[0, 8, 8, 0]}
                barSize={20}
                className="cursor-pointer"
              >
                {topStores.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? "#059669" : "#10b981"} 
                    fillOpacity={1 - (index * 0.05)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scheme Distribution */}
      <div className="lg:col-span-2 bg-white p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="mb-8 sm:mb-10">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Scheme Mix</h3>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Portfolio distribution by scheme</p>
        </div>
        <div className="h-[250px] sm:h-[350px] w-full relative">
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <PieChart>
              <Pie
                data={schemeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={8}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {schemeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                  padding: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">100%</span>
          </div>
        </div>
        
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {schemeData.map((scheme, idx) => (
            <div key={scheme.name} className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 truncate">{scheme.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



