import React, { useState, useEffect, useMemo } from "react";
import { Users, MapPin, IndianRupee, TrendingUp, Calendar, FileSpreadsheet, LogOut, Shield, Upload, LayoutDashboard, AlertCircle, X, Check, Trophy, ArrowUpRight, User as UserIcon, Trash2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ProcessedData, User, EmployeeStat } from "../types";
import { getStatsByLocation, getStatsByEmployee, normalizeSchemeName } from "../services/dataService";
import { StatsCard } from "./StatsCard";
import { LocationCharts } from "./LocationCharts";
import { EmployeeTable } from "./EmployeeTable";
import { TopPerformers } from "./TopPerformers";
import { DetailDashboard } from "./DetailDashboard";
import { AdminPanel } from "./admin/AdminPanel";
import { formatCurrency, formatNumber } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";

import { SchemePerformance } from "./SchemePerformance";

interface DashboardProps {
  data: ProcessedData[];
  onFileUpload: (files: { content: string, name: string }[]) => void;
  onClearData: () => void;
  user: User;
  onLogout: () => void;
  onRefresh: () => void;
  error?: string | null;
  setError?: (err: string | null) => void;
  uploadStatus?: string | null;
  isUploading?: boolean;
}

export function Dashboard({
  data, onFileUpload, onClearData, user, onLogout, onRefresh, error, setError, uploadStatus, isUploading
}: DashboardProps) {
  const { token } = useAuth();
  const [detailData, setDetailData] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<'all' | 'mtd' | 'qtd' | 'ytd' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (user.role === 'admin' && activeTab === 'dashboard') {
      fetchUsers();
    }
  }, [user.role, activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  const monthMap: Record<string, number> = {
    'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11, 'Jan': 0, 'Feb': 1, 'Mar': 2
  };

  const getDocDate = (d: ProcessedData) => {
    if (d.reportDate) {
      const parsed = new Date(d.reportDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const monthIdx = monthMap[d.reportMonth || ''] ?? -1;
    if (monthIdx !== -1) {
      const year = monthIdx >= 3 ? 2026 : 2027;
      return new Date(year, monthIdx, 1);
    }
    return null;
  };

  const accessibleLocations = useMemo(() => {
    if (user.role === 'admin') {
      if (selectedUser) {
        return selectedUser.role === 'admin'
          ? Array.from(new Set(data.map(d => d.location))).sort()
          : (selectedUser.accessibleLocations || []).sort();
      }
      return Array.from(new Set(data.map(d => d.location))).sort();
    }
    return (user.accessibleLocations || []).sort();
  }, [user, data, selectedUser]);

  const filteredData = useMemo(() => {
    let filtered = data;

    // 1. User/Location Filter (Ensure consistency between Admin view and User view)
    if (user.role !== 'admin') {
      const allowed = (user.accessibleLocations || []).map(l => l.toLowerCase().trim());
      filtered = data.filter(d => allowed.includes((d.location || "").toLowerCase().trim()));
    } else if (selectedUser && selectedUser.role !== 'admin') {
      const allowed = (selectedUser.accessibleLocations || []).map(l => l.toLowerCase().trim());
      filtered = data.filter(d => allowed.includes((d.location || "").toLowerCase().trim()));
    }

    if (selectedLocation) {
      filtered = filtered.filter(d => d.location === selectedLocation);
    }

    // 2. Date Filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      filtered = filtered.filter(d => {
        const docDate = getDocDate(d);
        if (!docDate) return false;

        const docMonth = docDate.getMonth();
        const docYear = docDate.getFullYear();

        if (dateFilter === 'mtd') {
          return docMonth === currentMonth && docYear === currentYear;
        }
        if (dateFilter === 'qtd') {
          const currentQuarter = Math.floor(currentMonth / 3);
          const docQuarter = Math.floor(docMonth / 3);
          return currentQuarter === docQuarter && docYear === currentYear;
        }
        if (dateFilter === 'ytd') {
          const fiscalYearStart = currentMonth >= 3 ? currentYear : currentYear - 1;
          const docFiscalYear = docMonth >= 3 ? docYear : docYear - 1;
          return docFiscalYear === fiscalYearStart;
        }
        if (dateFilter === 'custom') {
          if (!customDateRange.start || !customDateRange.end) return true;
          const start = new Date(customDateRange.start);
          const end = new Date(customDateRange.end);
          return docDate >= start && docDate <= end;
        }
        return true;
      });
    }

    return filtered;
  }, [data, user, selectedUser, selectedLocation, dateFilter, customDateRange]);

  const locationStats = useMemo(() => getStatsByLocation(filteredData), [filteredData]);
  const employeeStats = useMemo(() => getStatsByEmployee(filteredData), [filteredData]);

  const { metrics, totalRevenue, totalCount, uniqueEmployees, uniqueLocations, schemeData } = useMemo(() => {
    const m = {
      enrolment: { count: 0, value: 0 },
      overdue: { count: 0, value: 0 },
      odCollection: { count: 0, value: 0 },
      currentDue: { count: 0, value: 0 },
      totalDue: { count: 0, value: 0 },
      cdCollection: { count: 0, value: 0 },
      forclosed: { count: 0, value: 0 },
      redemption: { actual: 0, pending: 0 },
      reEnrolment: { count: 0, value: 0 },
      upSale: { count: 0, value: 0 },
      installment: { value: 0 },
      expected: { value: 0 },
      received: { value: 0 },
      discount: { value: 0 },
      odPayment: { value: 0 },
      cdPayment: { value: 0 },
      collectionRcvd: { value: 0 },
      paidCustomers: { count: 0 },
      overdueAmt: { value: 0 },
      currentDueAmt: { value: 0 },
      forclosedAmt: { value: 0 },
      paymentOverdue: { value: 0 },
      currentDueColl: { value: 0 },
    };

    const dueProfiles = new Set<string>();
    const employees = new Set<string>();
    const locations = new Set<string>();

    const schemeTotals: Record<string, { count: number, value: number }> = {
      "11+1": { count: 0, value: 0 },
      "One_Pay": { count: 0, value: 0 },
      "11+2": { count: 0, value: 0 },
      "Rate_Shield": { count: 0, value: 0 },
    };

    filteredData.forEach(d => {
      m.enrolment.count += d.enrolmentCount || 0;
      m.enrolment.value += d.enrolmentValue || 0;
      m.overdue.count += d.overdueCount || 0;
      m.overdue.value += d.overdueValue || 0;
      m.odCollection.count += d.odCollectionCount || 0;
      m.odCollection.value += d.odCollectionValue || 0;
      m.currentDue.count += d.currentDueCount || 0;
      m.currentDue.value += d.currentDueValue || 0;

      const totalDueVal = d.totalDue || 0;
      if (totalDueVal > 0) {
        m.totalDue.count += 1;
        m.totalDue.value += totalDueVal;
        const profileId = d.profileNo || d.customerName || d.id;
        if (profileId) dueProfiles.add(profileId);
      }

      m.cdCollection.count += d.cdCollectionCount || 0;
      m.cdCollection.value += d.cdCollectionValue || 0;
      m.forclosed.count += d.forclosedCount || 0;
      m.forclosed.value += d.forclosedValue || 0;
      m.redemption.actual += d.redemptionActual || 0;
      m.redemption.pending += d.redemptionPending || 0;
      m.reEnrolment.count += d.reEnrolmentCount || 0;
      m.reEnrolment.value += d.reEnrolmentValue || 0;
      m.upSale.count += d.upSaleCount || 0;
      m.upSale.value += d.upSaleValue || 0;

      m.installment.value += d.installmentAmount || 0;
      m.expected.value += d.expectedInstAmount || 0;
      m.received.value += d.currentReceivedAmount || 0;
      m.discount.value += d.schemeDiscount || 0;
      m.odPayment.value += d.paymentAgainstOverdueValue || 0;
      m.cdPayment.value += d.currentDueCollectionValue || 0;
      m.collectionRcvd.value += (d.odCollectionValue || 0) + (d.cdCollectionValue || 0);
      m.paidCustomers.count += d.paidCustomerCount || 0;

      m.overdueAmt.value += d.overdueValue || 0;
      m.currentDueAmt.value += d.currentDueValue || 0;
      m.forclosedAmt.value += d.forclosedValue || 0;
      m.paymentOverdue.value += d.paymentAgainstOverdueValue || 0;
      m.currentDueColl.value += d.currentDueCollectionValue || 0;

      if (d.employeeCode) employees.add(d.employeeCode);
      if (d.location) locations.add(d.location);

      const normalizedScheme = normalizeSchemeName(d.schemeType || "");
      if (schemeTotals[normalizedScheme]) {
        schemeTotals[normalizedScheme].count += d.enrolmentCount || 0;
        schemeTotals[normalizedScheme].value += d.enrolmentValue || 0;
      }
    });

    return {
      metrics: {
        ...m,
        dueCustomers: dueProfiles.size
      },
      totalRevenue: m.enrolment.value,
      totalCount: m.enrolment.count,
      uniqueEmployees: employees.size,
      uniqueLocations: locations.size,
      schemeData: [
        { name: "11+1", ...schemeTotals["11+1"] },
        { name: "One Pay", ...schemeTotals["One_Pay"] },
        { name: "11+2", ...schemeTotals["11+2"] },
        { name: "GP - Rate Shield", ...schemeTotals["Rate_Shield"] },
      ].filter(s => s.count > 0 || s.value > 0)
    };
  }, [filteredData]);



  const handleLocationClick = (locationName: string) => {
    const loc = locationStats.find(l => l.location === locationName);
    if (!loc) return;

    const locData = filteredData.filter(d => (d.location || "").toLowerCase() === locationName.toLowerCase());

    setDetailData({
      type: "location",
      id: locationName,
      name: locationName,
      totalCount: loc.totalCount,
      totalAmount: loc.totalAmount,
      totalOverdue: loc.totalOverdue,
      totalCollection: loc.totalCollection,
      totalRedemption: locData.reduce((sum, d) => sum + (d.redemptionActual || 0), 0),
      employeeCount: loc.employeeCount,
      customers: locData,
      totalDueCount: new Set(locData.filter(d => (d.totalDue || 0) > 0).map(d => d.profileNo || d.customerName || d.id).filter(Boolean)).size,
      collectionCustomerCount: new Set(locData.filter(d => (d.collectionReceivedValue || 0) > 0).map(d => d.profileNo || d.customerName || d.id).filter(Boolean)).size,
      schemes: {
        count11Plus1: locData.filter(d => normalizeSchemeName(d.schemeType || "") === "11+1").reduce((sum, d) => sum + (d.enrolmentCount || 0), 0),
        count11Plus2: locData.filter(d => normalizeSchemeName(d.schemeType || "") === "11+2").reduce((sum, d) => sum + (d.enrolmentCount || 0), 0),
        countGpRateShield: locData.filter(d => normalizeSchemeName(d.schemeType || "") === "Rate_Shield").reduce((sum, d) => sum + (d.enrolmentCount || 0), 0),
        countOnePay: locData.filter(d => normalizeSchemeName(d.schemeType || "") === "One_Pay").reduce((sum, d) => sum + (d.enrolmentCount || 0), 0),
      }
    });
    setIsDetailOpen(true);
  };

  const handleEmployeeClick = (employee: EmployeeStat) => {
    // Filter raw records for this employee
    const employeeData = filteredData.filter(d =>
      (d.employeeCode === employee.employeeCode && employee.employeeCode !== "unknown") ||
      (d.employeeName.toLowerCase() === employee.employeeName.toLowerCase())
    );

    setDetailData({
      type: "employee",
      id: employee.employeeCode,
      name: employee.employeeName,
      location: employee.location,
      totalCount: employee.totalCount,
      totalAmount: employee.totalAmount,
      totalOverdue: employee.totalOverdue,
      totalCollection: employee.totalCollection,
      totalRedemption: employee.redemptionActual || 0,
      customerCount: employeeData.length,
      enrolmentCustomerCount: employee.enrolmentCustomerCount,
      collectionCustomerCount: employee.collectionCustomerCount,
      dueCustomerCount: employee.dueCustomerCount,
      installmentAmount: employee.installmentAmount,
      expectedInstAmount: employee.expectedInstAmount,
      currentReceivedAmount: employee.currentReceivedAmount,
      currentDueValue: employee.currentDueValue,
      totalDueCount: employee.dueCustomerCount,
      totalDue: employee.totalDue,
      paidCustomerCount: employee.paidCustomerCount ?? 0,
      collectionReceivedValue: employee.collectionReceivedValue,
      paymentAgainstOverdueValue: employee.paymentAgainstOverdueValue ?? 0,
      currentDueCollectionValue: employee.currentDueCollectionValue ?? 0,
      foreclosedCount: employee.totalForclosed ?? 0,
      collectionPercent: employee.collectionPercent ?? 0,
      totalForclosedValue: employee.forclosedValue ?? 0,
      totalReEnrolmentCount: employee.reEnrolmentCount ?? 0,
      totalReEnrolmentValue: employee.reEnrolmentValue ?? 0,
      totalUpSaleCount: employee.upSaleCount ?? 0,
      totalUpSaleValue: employee.upSaleValue ?? 0,
      totalRedemptionPending: employee.redemptionPending ?? 0,
      customers: employeeData,
      schemes: employee.schemes
    });
    setIsDetailOpen(true);
  };

  const processFiles = async (files: FileList | File[]) => {
    const csvFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) {
      setError?.("Please select CSV files only.");
      return;
    }

    const csvData = await Promise.all(csvFiles.map(async file => ({
      content: await file.text(),
      name: file.name
    })));
    onFileUpload(csvData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform duration-300">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter block leading-none">PerformanceHub</span>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] leading-none mt-1 block">Enterprise Analytics</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-6">
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'admin' ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
              </div>

              <div className="hidden md:block h-8 w-px bg-slate-200" />

              <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-black text-slate-900">{user.name}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="hidden sm:block p-2.5 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all active:scale-95"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>

                {/* Mobile Menu Toggle */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2.5 bg-slate-100 text-slate-500 rounded-xl transition-all active:scale-95"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-4 py-6 space-y-4">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Dashboard
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${activeTab === 'admin' ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Shield className="w-5 h-5" />
                    Admin Panel
                  </button>
                )}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{user.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</span>
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold flex items-center gap-3 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-700 shadow-sm"
            >
              <div className="bg-red-100 p-2 rounded-xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              </div>
              <p className="text-sm font-bold tracking-tight">{error}</p>
              <button onClick={() => setError?.(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {isUploading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4 text-blue-700 shadow-sm"
            >
              <div className="bg-blue-100 p-2 rounded-xl">
                <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              </div>
              <div>
                <p className="text-sm font-black tracking-tight">{uploadStatus || 'Uploading data...'}</p>
                <div className="mt-1 h-1.5 w-48 bg-blue-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-600"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 10, repeat: Infinity }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && user.role === 'admin' ? (
            <motion.div
              key="admin-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminPanel onDataUpdate={onRefresh} />
            </motion.div>
          ) : data.length > 0 ? (
            <motion.div
              key="dashboard-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Header Section */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                      <TrendingUp className="w-3 h-3" />
                      Live Performance Tracking
                    </div>
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.1] sm:leading-none">
                      FY 2026-27 <span className="text-blue-600">Analytics</span>
                    </h1>
                    <p className="text-xs sm:text-base text-slate-500 max-w-2xl font-medium leading-relaxed">
                      {user.role === 'admin'
                        ? "Complete enterprise visibility across all locations."
                        : `Performance data for: ${user.accessibleLocations.join(', ')}`}
                    </p>
                  </div>

                  {/* Filter Section */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* User Selector (Admin Only) */}
                    {user.role === 'admin' && (
                      <div className="relative w-full sm:max-w-xs group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <UserIcon className="h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        </div>
                        <select
                          value={selectedUserId}
                          onChange={(e) => {
                            setSelectedUserId(e.target.value);
                            setSelectedLocation(""); // Reset location when user changes
                          }}
                          className="block w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all appearance-none shadow-lg shadow-slate-200/30 cursor-pointer"
                        >
                          <option value="">All Users (Global)</option>
                          {users.filter(u => u.role === 'user').map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <TrendingUp className="h-4 w-4 text-slate-400 rotate-90" />
                        </div>
                      </div>
                    )}

                    {/* Location Selector */}
                    <div className="relative w-full sm:max-w-xs group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      </div>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="block w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all appearance-none shadow-lg shadow-slate-200/30 cursor-pointer"
                      >
                        <option value="">{selectedUserId ? "User's Locations" : "All Locations"}</option>
                        {accessibleLocations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <TrendingUp className="h-4 w-4 text-slate-400 rotate-90" />
                      </div>
                    </div>

                    {/* Date Filter Selector */}
                    <div className="relative w-full sm:max-w-xs group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      </div>
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as any)}
                        className="block w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all appearance-none shadow-lg shadow-slate-200/30 cursor-pointer"
                      >
                        <option value="all">All Time</option>
                        <option value="mtd">MTD (Month to Date)</option>
                        <option value="qtd">QTD (Quarter to Date)</option>
                        <option value="ytd">YTD (Year to Date)</option>
                        <option value="custom">Custom Range</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <TrendingUp className="h-4 w-4 text-slate-400 rotate-90" />
                      </div>
                    </div>

                    {dateFilter === 'custom' && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="date"
                          value={customDateRange.start}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all shadow-lg shadow-slate-200/30"
                        />
                        <span className="text-slate-400 font-bold text-center">to</span>
                        <input
                          type="date"
                          value={customDateRange.end}
                          onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="px-3 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all shadow-lg shadow-slate-200/30"
                        />
                      </div>
                    )}

                    {(selectedLocation || selectedUserId || dateFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSelectedLocation("");
                          setSelectedUserId("");
                          setDateFilter("all");
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition-colors text-center"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {user.role === 'admin' && (
                    <>
                      <button
                        onClick={onClearData}
                        className="cursor-pointer bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Clear Data</span>
                      </button>
                      <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 active:scale-95">
                        <Upload className="w-4 h-4" />
                        <span>Update Data</span>
                        <input type="file" className="hidden" accept=".csv" multiple onChange={handleFileChange} />
                      </label>
                    </>
                  )}
                  <div className="px-5 py-3 flex items-center justify-center gap-2.5 text-xs font-bold text-slate-700 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/30">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>APR 2026 — MAR 2027</span>
                  </div>
                </div>
              </div>

              {/* Categorized Stats Scorecard */}
              <div className="space-y-12 pb-10">
                {/* 1. Volume & Growth */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Sales & Volume Metrics</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                    <StatsCard title="Enrolment Count" value={formatNumber(metrics.enrolment.count)} icon={FileSpreadsheet} iconClassName="bg-blue-50 text-blue-600" description="Total accounts enrolled" />
                    <StatsCard title="Enrolment Value" value={formatCurrency(metrics.enrolment.value)} icon={IndianRupee} iconClassName="bg-blue-50 text-blue-600" description="Gross scheme enrolment" />
                    <StatsCard title="Re-Enrollment Count" value={formatNumber(metrics.reEnrolment.count)} icon={RefreshCw} iconClassName="bg-cyan-50 text-cyan-600" description="Renewed accounts count" />
                    <StatsCard title="Re-Enrollment Value" value={formatCurrency(metrics.reEnrolment.value)} icon={IndianRupee} iconClassName="bg-cyan-50 text-cyan-600" description="Sum of renewal amounts" />
                    <StatsCard title="UP Sale" value={formatCurrency(metrics.upSale.value)} subValue={`${formatNumber(metrics.upSale.count)} Up Sales`} icon={ArrowUpRight} iconClassName="bg-orange-50 text-orange-600" description="Additional sales value" />
                    <StatsCard title="Expected Inst." value={formatCurrency(metrics.expected.value)} icon={Calendar} iconClassName="bg-indigo-50 text-indigo-600" description="Expected monthly total" />
                  </div>
                </div>

                {/* 2. Collection Efficiency */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Collection Efficiency</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                    <StatsCard title="Total Collected" value={formatCurrency(metrics.collectionRcvd.value)} icon={TrendingUp} iconClassName="bg-emerald-50 text-emerald-600" description="Sum of Current Received Amount" />
                    <StatsCard
                      title="Collection Efficiency"
                      value={`${((metrics.collectionRcvd.value / (metrics.totalDue.value || 1)) * 100).toFixed(1)}%`}
                      subValue={`${formatNumber(metrics.odCollection.count + metrics.cdCollection.count)} Collections`}
                      icon={Check}
                      iconClassName="bg-emerald-50 text-emerald-600"
                      description="Collection vs Total Due"
                    />
                    <StatsCard title="Payment vs Overdue" value={formatCurrency(metrics.paymentOverdue.value)} icon={IndianRupee} iconClassName="bg-emerald-50 text-emerald-600" description="Payment Received Against Over Due" />
                    <StatsCard title="Current Due Collection" value={formatCurrency(metrics.currentDueColl.value)} icon={IndianRupee} iconClassName="bg-emerald-50 text-emerald-600" description="Current Due Against Collection" />
                  </div>
                </div>

                {/* 3. Outstanding & Dues */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-rose-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Outstanding & Dues</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                    <StatsCard title="Total Due Value" value={formatCurrency(metrics.totalDue.value)} icon={AlertCircle} iconClassName="bg-rose-50 text-rose-600" description="Grand Total Due" />
                    <StatsCard title="Total Customers Due" value={formatNumber(metrics.dueCustomers)} icon={Users} iconClassName="bg-rose-50 text-rose-600" description="Unique customers O/S" />
                    <StatsCard title="Overdue Pending Amt" value={formatCurrency(metrics.overdueAmt.value)} subValue={`${formatNumber(metrics.overdue.count)} Pending`} icon={AlertCircle} iconClassName="bg-rose-50 text-rose-600" description="Total Overdue Pending Amount" />
                    <StatsCard title="Current Due Apr-26" value={formatCurrency(metrics.currentDueAmt.value)} subValue={`${formatNumber(metrics.currentDue.count)} Dues`} icon={Calendar} iconClassName="bg-rose-50 text-rose-600" description="Current month dues" />
                    <StatsCard title="Paid Cust Count" value={formatNumber(metrics.paidCustomers.count)} icon={Users} iconClassName="bg-rose-50 text-rose-600" description="Total paying customers" />
                    <StatsCard title="Expected Inst Amount" value={formatCurrency(metrics.expected.value)} icon={TrendingUp} iconClassName="bg-rose-50 text-rose-600" description="Total expected installments" />
                    <StatsCard title="Foreclosed Count" value={formatNumber(metrics.forclosed.count)} icon={Trash2} iconClassName="bg-slate-100 text-slate-600" description="Total Foreclosed Accounts" />
                    <StatsCard title="Foreclosed Amount" value={formatCurrency(metrics.forclosedAmt.value)} icon={IndianRupee} iconClassName="bg-slate-100 text-slate-600" description="Total Foreclosed Amount" />
                  </div>
                </div>                 {/* 4. Strategic Metrics */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Strategic & Closure</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <StatsCard title="Actual Redemption" value={formatCurrency(metrics.redemption.actual)} icon={Trophy} iconClassName="bg-violet-50 text-violet-600" description="Realized redemptions" />
                    <StatsCard title="Pending Redemption" value={formatCurrency(metrics.redemption.pending)} icon={TrendingUp} iconClassName="bg-violet-50 text-violet-600" description="Expected redemptions" />
                    <StatsCard title="Store Workforce" value={uniqueEmployees} icon={Users} iconClassName="bg-teal-50 text-teal-600" description="Active contributors" />
                  </div>
                </div>
              </div>

              {/* Scheme Performance Section - Moved up */}
              <SchemePerformance
                data={schemeData}
                title={selectedLocation ? `Scheme Performance: ${selectedLocation}` : "Global Scheme Performance"}
              />

              {/* Charts Section */}
              <div className="grid grid-cols-1 gap-6 sm:gap-8">
                <LocationCharts
                  data={locationStats}
                  schemeData={schemeData.map(s => ({ name: s.name, value: s.count }))}
                  onLocationClick={handleLocationClick}
                />
                <TopPerformers data={employeeStats} />
                <EmployeeTable
                  data={employeeStats}
                  onEmployeeClick={handleEmployeeClick}
                  compact={!!selectedLocation}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-12"
            >
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`
                  max-w-3xl mx-auto p-8 sm:p-20 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${isDragging
                    ? 'border-blue-400 bg-blue-50/50 shadow-2xl shadow-blue-200/50 scale-105'
                    : 'border-slate-200 bg-slate-50/50 shadow-xl shadow-slate-200/30'
                  } cursor-pointer hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-200/50 active:scale-[0.98]
                `}
              >
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 mx-auto bg-slate-100 rounded-3xl flex items-center justify-center mb-8">
                    <FileSpreadsheet className="w-12 h-12 text-slate-400" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Upload Your CSV Data</h2>
                    <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">Drag & drop your employee performance CSV files here or click to browse. Get instant analytics and insights.</p>
                  </div>
                  <label className="block w-full max-w-md mx-auto cursor-pointer bg-white hover:bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center transition-all hover:shadow-lg hover:border-slate-300">
                    <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4 block" />
                    <div className="text-sm font-bold text-slate-600">Click to browse files or drag & drop</div>
                    <div className="text-xs text-slate-400 mt-1">CSV files only (.csv)</div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv"
                      multiple
                      onChange={handleFileChange}
                    />
                  </label>
                  {user.role === 'admin' && (
                    <p className="text-xs text-slate-400 text-center">
                      Admin: Data uploads sync across all users
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Employee / Location Detail Modal */}
      <DetailDashboard
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        data={detailData}
      />
    </div>
  );
}