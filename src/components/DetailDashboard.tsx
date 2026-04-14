import React, { useState } from "react";
import {
  X, User, MapPin, Trophy, TrendingUp, PieChart, BarChart3,
  IndianRupee, Users, ArrowUpRight, AlertCircle, Download,
  ChevronUp, ChevronDown, Search, FileText, BookOpen, Wallet,
  XCircle, RefreshCw, Gift, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, formatNumber, cn } from "../lib/utils";
import { ProcessedData } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RePieChart,
  Pie,
  Cell as ReCell
} from "recharts";

interface DetailData {
  type: "employee" | "location";
  id: string;
  name: string;
  location?: string;
  totalCount: number;
  totalAmount: number;
  totalOverdue: number;
  totalCollection: number;
  totalRedemption: number;
  customerCount?: number;
  enrolmentCustomerCount?: number;
  collectionCustomerCount?: number;
  dueCustomerCount?: number;
  installmentAmount?: number;
  expectedInstAmount?: number;
  currentReceivedAmount?: number;
  currentDueCount?: number;
  currentDueValue?: number;
  totalDueCount?: number;
  totalDue?: number;
  paidCustomerCount?: number;
  collectionReceivedValue?: number;
  paymentAgainstOverdueValue?: number;
  currentDueCollectionValue?: number;
  foreclosedCount?: number;
  collectionPercent?: number;
  // New performance fields
  totalForclosedValue?: number;
  totalReEnrolmentCount?: number;
  totalReEnrolmentValue?: number;
  totalUpSaleCount?: number;
  totalUpSaleValue?: number;
  totalRedemptionPending?: number;
  schemes: {
    count11Plus1: number;
    count11Plus2: number;
    countGpRateShield: number;
    countOnePay: number;
  };
  employeeCount?: number;
  customers?: ProcessedData[];
}

interface DetailDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  data: DetailData | null;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

type Tab = "overview" | "enrollment" | "collection" | "re-enrollment";
type SortKey = "customerName" | "installmentAmount" | "totalDue" | "collectionReceivedValue" | "schemeType";
type SortDir = "asc" | "desc";

export function DetailDashboard({ isOpen, onClose, data }: DetailDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("customerName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  if (!data) return null;

  const customers = data.customers || [];
  const enrolmentCustomers = customers.filter(c => c.source === "enrollment" || c.enrolmentCount > 0);
  const collectionCustomers = customers.filter(c => c.source !== "enrollment");
  const reEnrolmentCustomers = customers.filter(c => c.reEnrolmentCount > 0);

  // Unique customers by profile/name
  const uniqueCustomerIds = new Set(customers.map(c => c.profileNo || c.customerName || c.id).filter(Boolean));
  const totalUniqueCustomers = uniqueCustomerIds.size;

  const schemeChartData = [
    { name: "11+1", value: data.schemes.count11Plus1, color: COLORS[0] },
    { name: "One Pay", value: data.schemes.countOnePay, color: COLORS[1] },
    { name: "11+2", value: data.schemes.count11Plus2, color: COLORS[2] },
    { name: "GP Rate", value: data.schemes.countGpRateShield, color: COLORS[3] },
  ].filter(s => s.value > 0);

  const stats = [
    {
      label: "Enrolment Value",
      value: formatCurrency(data.totalAmount),
      subValue: `${formatNumber(data.totalCount)} Enrolments`,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Customers",
      value: formatNumber(totalUniqueCustomers),
      subValue: `${formatNumber(data.enrolmentCustomerCount || 0)} Enrolled • ${formatNumber(data.collectionCustomerCount || 0)} Collection`,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Due / Overdue",
      value: formatCurrency(data.totalOverdue),
      subValue: `${formatNumber(data.totalDueCount || 0)} Due Customers`,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Collection",
      value: formatCurrency(data.totalCollection),
      subValue: `${formatNumber(data.collectionCustomerCount || 0)} Collections`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Forclosed",
      value: formatCurrency(data.totalForclosedValue || 0),
      subValue: `${formatNumber(data.foreclosedCount || 0)} Schemes`,
      icon: XCircle,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
    {
      label: "Re-Enrolled",
      value: formatCurrency(data.totalReEnrolmentValue || 0),
      subValue: `${formatNumber(data.totalReEnrolmentCount || 0)} Re-Enrolments`,
      icon: RefreshCw,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
    {
      label: "Redemption",
      value: formatCurrency(data.totalRedemption || 0),
      subValue: `Pending: ${formatCurrency(data.totalRedemptionPending || 0)}`,
      icon: Gift,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Up Sale",
      value: formatCurrency(data.totalUpSaleValue || 0),
      subValue: `${formatNumber(data.totalUpSaleCount || 0)} Up Sales`,
      icon: Zap,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  const downloadCSV = (exportData: any[], filename: string) => {
    if (!exportData.length) return;
    const headers = Array.from(new Set(exportData.reduce((acc, row) => acc.concat(Object.keys(row || {})), [] as string[])));
    const csvRows = [headers.join(",")];
    for (const row of exportData) {
      const values = headers.map(header => {
        const val = (row as any)[header];
        return `"${String(val ?? "").replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortCustomers = (list: ProcessedData[]) => {
    return [...list].sort((a, b) => {
      let av: any = a[sortKey as keyof ProcessedData] ?? "";
      let bv: any = b[sortKey as keyof ProcessedData] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const filterCustomers = (list: ProcessedData[]) =>
    list.filter(c => {
      const q = search.toLowerCase();
      return !q ||
        (c.customerName || "").toLowerCase().includes(q) ||
        (c.profileNo || "").toLowerCase().includes(q) ||
        (c.orderNo || "").toLowerCase().includes(q) ||
        (c.schemeType || "").toLowerCase().includes(q);
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
      : null;

  const tabs: { id: Tab; label: string; count: number; icon: any; color: string }[] = [
    { id: "overview", label: "Overview", count: 0, icon: BarChart3, color: "blue" },
    { id: "enrollment", label: "Enrollment", count: enrolmentCustomers.length, icon: BookOpen, color: "emerald" },
    { id: "collection", label: "Collection / Due", count: collectionCustomers.length, icon: Wallet, color: "amber" },
    { id: "re-enrollment", label: "Re-Enrollment", count: reEnrolmentCustomers.length, icon: RefreshCw, color: "cyan" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="detail-page"
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-hidden"
        >
            {/* Full-page sticky top navbar */}
            <div className="bg-white border-b border-slate-200 flex-shrink-0 z-20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-4">

                  {/* Back button + identity */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all active:scale-95 flex-shrink-0"
                    >
                      <ArrowUpRight className="w-4 h-4 rotate-[225deg]" />
                      <span className="hidden sm:inline">Back</span>
                    </button>

                    <div className="h-6 w-px bg-slate-200 flex-shrink-0" />

                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0",
                      data.type === "employee" ? "bg-blue-600 shadow-blue-200" : "bg-emerald-600 shadow-emerald-200"
                    )}>
                      {data.type === "employee" ? <User className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">{data.name}</h1>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex-shrink-0",
                          data.type === "employee" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        )}>{data.type}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px]">
                        {data.location && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{data.location}</span>}
                        <span className="flex items-center gap-1"><Trophy className="w-2.5 h-2.5 text-amber-500" />ID: {data.id}</span>
                        <span className="flex items-center gap-1 text-violet-600 font-black"><Users className="w-2.5 h-2.5" />{totalUniqueCustomers} Customers</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => downloadCSV(enrolmentCustomers, `${data.name}-enrolments.csv`)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Enrols
                    </button>
                    <button
                      onClick={() => downloadCSV(collectionCustomers, `${data.name}-collections.csv`)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Collections
                    </button>
                    <button
                      onClick={() => downloadCSV(reEnrolmentCustomers, `${data.name}-re-enrolments.csv`)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-cyan-50 text-cyan-600 rounded-xl hover:bg-cyan-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Re-Enrols
                    </button>
                  </div>
                </div>
              </div>
            </div>


            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 flex-shrink-0 z-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-1 overflow-x-auto">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSearch(""); }}
                      className={cn(
                        "flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-wide border-b-2 transition-all whitespace-nowrap",
                        activeTab === tab.id
                          ? tab.color === "blue" ? "border-blue-500 text-blue-600" : tab.color === "emerald" ? "border-emerald-500 text-emerald-600" : "border-amber-500 text-amber-600"
                          : "border-transparent text-slate-400 hover:text-slate-700"
                      )}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full text-[9px] font-black",
                          tab.color === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>{tab.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable full-page content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <AnimatePresence mode="wait">
                {activeTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Stats Grid — 4 primary + 4 performance */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      {stats.map((stat, idx) => (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.06 }}
                          key={stat.label}
                          className="bg-white p-4 rounded-xl border border-slate-100 shadow-md shadow-slate-200/20 group hover:scale-[1.02] transition-transform duration-300"
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <div className={cn("p-2 rounded-lg", stat.bg)}>
                              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                            </div>
                            <ArrowUpRight className="w-3 h-3 text-slate-200 group-hover:text-slate-400 transition-colors" />
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</div>
                          <div className={cn("text-base sm:text-xl font-black tracking-tighter", stat.color)}>{stat.value}</div>
                          {stat.subValue && (
                            <div className="text-[9px] font-bold text-slate-500 mt-1 leading-relaxed">{stat.subValue}</div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/20">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Scheme Breakdown</h3>
                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Contribution by scheme type</p>
                          </div>
                          <BarChart3 className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={schemeChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }} />
                              <YAxis hide />
                              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={24}>
                                {schemeChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/20">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Portfolio Mix</h3>
                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">Percentage distribution</p>
                          </div>
                          <PieChart className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="h-[200px] w-full relative">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <RePieChart>
                              <Pie data={schemeChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={6} dataKey="value" stroke="none">
                                {schemeChartData.map((entry, index) => (
                                  <ReCell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                            </RePieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                            <span className="text-lg font-black text-slate-900 tracking-tighter">{data.totalCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Scheme performance metrics */}
                    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/20">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight mb-4">Scheme Metrics</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "11+1 Scheme", value: data.schemes.count11Plus1, color: "bg-blue-500" },
                          { label: "One Pay", value: data.schemes.countOnePay, color: "bg-emerald-500" },
                          { label: "11+2 Scheme", value: data.schemes.count11Plus2, color: "bg-amber-500" },
                          { label: "GP Rate Shield", value: data.schemes.countGpRateShield, color: "bg-rose-500" },
                        ].map(item => (
                          <div key={item.label} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={cn("w-2.5 h-2.5 rounded-full", item.color)} />
                              <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-slate-900">{formatNumber(item.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "enrollment" && (
                  <motion.div
                    key="enrollment"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Summary banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                        <div className="text-xl font-black text-blue-700">{enrolmentCustomers.length}</div>
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Records</div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                        <div className="text-xl font-black text-emerald-700">{formatCurrency(enrolmentCustomers.reduce((s, c) => s + (c.installmentAmount || 0), 0))}</div>
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Installment</div>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                        <div className="text-xl font-black text-amber-700">{formatCurrency(enrolmentCustomers.reduce((s, c) => s + (c.expectedInstAmount || 0), 0))}</div>
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Expected Inst.</div>
                      </div>
                      <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100">
                        <div className="text-xl font-black text-violet-700">{new Set(enrolmentCustomers.map(c => c.profileNo || c.customerName).filter(Boolean)).size}</div>
                        <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Unique Customers</div>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by customer name, profile, order no, scheme..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>

                    {/* Full CSV Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full" style={{ minWidth: '1400px' }}>
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="sticky left-0 bg-slate-50 text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">#</th>
                              <th className="sticky left-8 bg-slate-50 text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10 min-w-[160px]">Customer Name</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Profile No</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Order No</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Joining Date</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Type</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Status</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Inst. Amount</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Expected Inst.</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Curr. Received</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Discount</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Location</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Loc. Code</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(() => {
                              const rows = sortCustomers(filterCustomers(enrolmentCustomers));
                              if (!rows.length) return (
                                <tr><td colSpan={13} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                                  {search ? `No enrollment records matching "${search}"` : "No enrollment data available"}
                                </td></tr>
                              );
                              return rows.map((c, i) => (
                                <tr key={c.id || i} className="hover:bg-blue-50/20 transition-colors group">
                                  <td className="sticky left-0 bg-white group-hover:bg-blue-50/20 px-3 py-2.5 text-[10px] font-bold text-slate-400 z-10">{i + 1}</td>
                                  <td className="sticky left-8 bg-white group-hover:bg-blue-50/20 px-3 py-2.5 z-10 min-w-[160px]">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] font-black flex-shrink-0">
                                        {(c.customerName || "?").charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-[11px] font-black text-slate-800 group-hover:text-blue-700">{c.customerName || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 whitespace-nowrap">{c.profileNo || "—"}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-slate-500 whitespace-nowrap">{c.orderNo || "—"}</td>
                                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{c.joiningDate || "—"}</td>
                                  <td className="px-3 py-2.5">
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wide whitespace-nowrap">{c.schemeType || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap",
                                      c.schemeStatus?.toLowerCase().includes("active") ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                    )}>{c.schemeStatus || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] font-black text-slate-800 text-right whitespace-nowrap">{formatCurrency(c.installmentAmount || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{formatCurrency(c.expectedInstAmount || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-emerald-700 text-right whitespace-nowrap">{formatCurrency(c.currentReceivedAmount || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-amber-700 text-right whitespace-nowrap">{formatCurrency(c.schemeDiscount || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{c.location || "—"}</td>
                                  <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">{c.locationCode || "—"}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {filterCustomers(enrolmentCustomers).length} of {enrolmentCustomers.length} enrollment records • Scroll right to see all columns
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "collection" && (
                  <motion.div
                    key="collection"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Summary banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                        <div className="text-xl font-black text-amber-700">{collectionCustomers.length}</div>
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Total Records</div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                        <div className="text-xl font-black text-emerald-700">{formatCurrency(collectionCustomers.reduce((s, c) => s + (c.collectionReceivedValue || 0), 0))}</div>
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Collected</div>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100">
                        <div className="text-xl font-black text-rose-700">{formatCurrency(collectionCustomers.reduce((s, c) => s + (c.totalDue || 0), 0))}</div>
                        <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Total Due</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                        <div className="text-xl font-black text-blue-700">{new Set(collectionCustomers.map(c => c.profileNo || c.customerName).filter(Boolean)).size}</div>
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Unique Customers</div>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by customer name, profile, order no, scheme..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>

                    {/* Full CSV Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full" style={{ minWidth: '1900px' }}>
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="sticky left-0 bg-slate-50 text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">#</th>
                              <th className="sticky left-8 bg-slate-50 text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10 min-w-[160px]">Customer Name</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Profile No</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Order No</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Type</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Status</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Inst. Amount</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Expected Inst.</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Curr. Received</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Total Due</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">OD Pending Cnt</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">OD Pending Amt</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Curr Due Cnt</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Curr Due Amt</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Paid Cust Cnt</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Collection Rcvd</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Collect %</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Pymt vs OD</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Curr Due Coll.</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(() => {
                              const rows = sortCustomers(filterCustomers(collectionCustomers));
                              if (!rows.length) return (
                                <tr><td colSpan={20} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                                  {search ? `No collection records matching "${search}"` : "No collection data available"}
                                </td></tr>
                              );
                              return rows.map((c, i) => {
                                const hasDue = (c.totalDue || 0) > 0;
                                const hasCollection = (c.collectionReceivedValue || 0) > 0;
                                return (
                                  <tr key={c.id || i} className={cn("transition-colors group", hasDue ? "hover:bg-rose-50/20" : "hover:bg-emerald-50/20")}>
                                    <td className="sticky left-0 bg-white group-hover:bg-rose-50/10 px-3 py-2.5 text-[10px] font-bold text-slate-400 z-10">{i + 1}</td>
                                    <td className="sticky left-8 bg-white group-hover:bg-rose-50/10 px-3 py-2.5 z-10 min-w-[160px]">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0", hasDue ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                                          {(c.customerName || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-[11px] font-black text-slate-800">{c.customerName || "—"}</span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 whitespace-nowrap">{c.profileNo || "—"}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-500 whitespace-nowrap">{c.orderNo || "—"}</td>
                                    <td className="px-3 py-2.5">
                                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wide whitespace-nowrap">{c.schemeType || "—"}</span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap",
                                        c.schemeStatus?.toLowerCase().includes("active") ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                      )}>{c.schemeStatus || "—"}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-700 text-right whitespace-nowrap">{formatCurrency(c.installmentAmount || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{formatCurrency(c.expectedInstAmount || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-emerald-700 text-right whitespace-nowrap">{formatCurrency(c.currentReceivedAmount || 0)}</td>
                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                      <span className={cn("text-[11px] font-black", hasDue ? "text-rose-600" : "text-slate-400")}>{formatCurrency(c.totalDue || 0)}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{formatNumber(c.overdueCount || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-rose-600 text-right whitespace-nowrap">{formatCurrency(c.overdueValue || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{formatNumber(c.currentDueCount || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-amber-700 text-right whitespace-nowrap">{formatCurrency(c.currentDueValue || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{formatNumber(c.paidCustomerCount || 0)}</td>
                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                      <span className={cn("text-[11px] font-black", hasCollection ? "text-emerald-600" : "text-slate-400")}>{formatCurrency(c.collectionReceivedValue || 0)}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{(c.collectionPercent || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-blue-700 text-right whitespace-nowrap">{formatCurrency(c.paymentAgainstOverdueValue || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] font-bold text-indigo-700 text-right whitespace-nowrap">{formatCurrency(c.currentDueCollectionValue || 0)}</td>
                                    <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{c.location || "—"}</td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {filterCustomers(collectionCustomers).length} of {collectionCustomers.length} collection records • Scroll right to see all columns
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "re-enrollment" && (
                  <motion.div
                    key="re-enrollment"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Summary banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-cyan-50 rounded-xl p-3 text-center border border-cyan-100">
                        <div className="text-xl font-black text-cyan-700">{reEnrolmentCustomers.length}</div>
                        <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Total Records</div>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                        <div className="text-xl font-black text-emerald-700">{formatCurrency(reEnrolmentCustomers.reduce((s, c) => s + (c.reEnrolmentValue || 0), 0))}</div>
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Re-Enrol Val</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                        <div className="text-xl font-black text-blue-700">{formatCurrency(reEnrolmentCustomers.reduce((s, c) => s + (c.installmentAmount || 0), 0))}</div>
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Inst. Amount</div>
                      </div>
                      <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100">
                        <div className="text-xl font-black text-violet-700">{new Set(reEnrolmentCustomers.map(c => c.profileNo || c.customerName).filter(Boolean)).size}</div>
                        <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Unique Customers</div>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by customer name, profile, scheme..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>

                    {/* Re-Enrolment Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full" style={{ minWidth: '1300px' }}>
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="sticky left-0 bg-slate-50 text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">#</th>
                              <th className="sticky left-8 bg-slate-50 text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest z-10 min-w-[160px]">Customer Name</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Profile No</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Order No</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Type</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Scheme Status</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Re-Enrol Count</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Re-Enrol Value</th>
                              <th className="text-right px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Inst. Amount</th>
                              <th className="text-left px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(() => {
                              const rows = sortCustomers(filterCustomers(reEnrolmentCustomers));
                              if (!rows.length) return (
                                <tr><td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                                  {search ? `No re-enrollment records matching "${search}"` : "No re-enrollment data available"}
                                </td></tr>
                              );
                              return rows.map((c, i) => (
                                <tr key={c.id || i} className="hover:bg-cyan-50/20 transition-colors group">
                                  <td className="sticky left-0 bg-white group-hover:bg-cyan-50/20 px-3 py-2.5 text-[10px] font-bold text-slate-400 z-10">{i + 1}</td>
                                  <td className="sticky left-8 bg-white group-hover:bg-cyan-50/20 px-3 py-2.5 z-10 min-w-[160px]">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-600 flex items-center justify-center text-[9px] font-black flex-shrink-0">
                                        {(c.customerName || "?").charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-[11px] font-black text-slate-800">{c.customerName || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 whitespace-nowrap">{c.profileNo || "—"}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-slate-500 whitespace-nowrap">{c.orderNo || "—"}</td>
                                  <td className="px-3 py-2.5">
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wide whitespace-nowrap">{c.schemeType || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap",
                                      c.schemeStatus?.toLowerCase().includes("active") ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                    )}>{c.schemeStatus || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] font-black text-slate-800 text-right whitespace-nowrap">{formatNumber(c.reEnrolmentCount || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-black text-emerald-700 text-right whitespace-nowrap">{formatCurrency(c.reEnrolmentValue || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600 text-right whitespace-nowrap">{formatCurrency(c.installmentAmount || 0)}</td>
                                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{c.location || "—"}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Showing {filterCustomers(reEnrolmentCustomers).length} of {reEnrolmentCustomers.length} re-enrollment records
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SortTh({ label, k, sortKey, onClick, dir }: { label: string; k: string; sortKey: string; onClick: () => void; dir: SortDir }) {
  const active = sortKey === k;
  return (
    <th
      className="text-left px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
      onClick={onClick}
    >
      {label}
      {active
        ? (dir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-500" /> : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-500" />)
        : <span className="inline-block w-3 ml-0.5" />}
    </th>
  );
}