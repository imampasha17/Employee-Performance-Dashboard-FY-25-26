import React, { useState, useEffect, useMemo } from "react";
import { Users, MapPin, IndianRupee, TrendingUp, Calendar, FileSpreadsheet, LogOut, Shield, Upload, LayoutDashboard, AlertCircle, X, Check, Trophy, ArrowUpRight, User as UserIcon, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ProcessedData, User } from "../types";
import { getStatsByLocation, getStatsByEmployee } from "../services/dataService";
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
  onFileUpload: (csvStrings: string[]) => void;
  onClearData: () => void;
  user: User;
  onLogout: () => void;
  onRefresh: () => void;
  error?: string | null;
  setError?: (err: string | null) => void;
}

export function Dashboard({ data, onFileUpload, onClearData, user, onLogout, onRefresh, error, setError }: DashboardProps) {
  const { token } = useAuth();
  const [detailData, setDetailData] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

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

  const accessibleLocations = useMemo(() => {
    if (user.role === 'admin') {
      if (selectedUser) {
        return selectedUser.role === 'admin' 
          ? Array.from(new Set(data.map(d => d.location))).sort()
          : selectedUser.accessibleLocations.sort();
      }
      return Array.from(new Set(data.map(d => d.location))).sort();
    }
    return user.accessibleLocations.sort();
  }, [user, data, selectedUser]);

  const filteredData = useMemo(() => {
    let filtered = data;
    
    // If not admin, restrict to user's locations
    if (user.role !== 'admin') {
      filtered = data.filter(d => user.accessibleLocations.includes(d.location));
    } else if (selectedUser && selectedUser.role !== 'admin') {
      // If admin has selected a non-admin user, restrict to that user's locations
      filtered = data.filter(d => selectedUser.accessibleLocations.includes(d.location));
    }

    if (selectedLocation) {
      filtered = filtered.filter(d => d.location === selectedLocation);
    }
    
    return filtered;
  }, [data, user, selectedUser, selectedLocation]);

  const locationStats = getStatsByLocation(filteredData);
  const employeeStats = getStatsByEmployee(filteredData);

  const totalRevenue = filteredData.reduce((sum, item) => sum + item.enrolmentValue, 0);
  const totalCount = filteredData.reduce((sum, item) => sum + item.enrolmentCount, 0);
  const uniqueEmployees = new Set(filteredData.map((item) => item.employeeCode)).size;
  const uniqueLocations = new Set(filteredData.map((item) => item.location)).size;

  // Aggregated metrics for cards
  const metrics = {
    enrolment: { count: filteredData.reduce((sum, d) => sum + d.enrolmentCount, 0), value: filteredData.reduce((sum, d) => sum + d.enrolmentValue, 0) },
    overdue: { count: filteredData.reduce((sum, d) => sum + d.overdueCount, 0), value: filteredData.reduce((sum, d) => sum + d.overdueValue, 0) },
    odCollection: { count: filteredData.reduce((sum, d) => sum + d.odCollectionCount, 0), value: filteredData.reduce((sum, d) => sum + d.odCollectionValue, 0) },
    currentDue: { count: filteredData.reduce((sum, d) => sum + d.currentDueCount, 0), value: filteredData.reduce((sum, d) => sum + d.currentDueValue, 0) },
    totalDue: { count: filteredData.filter(d => (d.totalDue || 0) > 0).length, value: filteredData.reduce((sum, d) => sum + (d.totalDue || 0), 0) },
    dueCustomers: new Set(filteredData.filter(d => (d.totalDue || 0) > 0).map(d => d.profileNo || d.customerName || d.id).filter(Boolean)).size,
    cdCollection: { count: filteredData.reduce((sum, d) => sum + d.cdCollectionCount, 0), value: filteredData.reduce((sum, d) => sum + d.cdCollectionValue, 0) },
    forclosed: { count: filteredData.reduce((sum, d) => sum + d.forclosedCount, 0), value: filteredData.reduce((sum, d) => sum + d.forclosedValue, 0) },
    redemption: { actual: filteredData.reduce((sum, d) => sum + d.redemptionActual, 0), pending: filteredData.reduce((sum, d) => sum + d.redemptionPending, 0) },
    reEnrolment: { count: filteredData.reduce((sum, d) => sum + d.reEnrolmentCount, 0), value: filteredData.reduce((sum, d) => sum + d.reEnrolmentValue, 0) },
    upSale: { count: filteredData.reduce((sum, d) => sum + d.upSaleCount, 0), value: filteredData.reduce((sum, d) => sum + d.upSaleValue, 0) },
  };

  const schemeData = [
    { 
      name: "11+1", 
      count: filteredData.filter(d => d.schemeType === "11+1").reduce((sum, item) => sum + item.enrolmentCount, 0),
      value: filteredData.filter(d => d.schemeType === "11+1").reduce((sum, item) => sum + item.enrolmentValue, 0)
    },
    { 
      name: "One Pay", 
      count: filteredData.filter(d => d.schemeType === "One_Pay").reduce((sum, item) => sum + item.enrolmentCount, 0),
      value: filteredData.filter(d => d.schemeType === "One_Pay").reduce((sum, item) => sum + item.enrolmentValue, 0)
    },
    { 
      name: "11+2", 
      count: filteredData.filter(d => d.schemeType === "11+2").reduce((sum, item) => sum + item.enrolmentCount, 0),
      value: filteredData.filter(d => d.schemeType === "11+2").reduce((sum, item) => sum + item.enrolmentValue, 0)
    },
    { 
      name: "GP - Rate Shield", 
      count: filteredData.filter(d => d.schemeType === "Rate_Shield").reduce((sum, item) => sum + item.enrolmentCount, 0),
      value: filteredData.filter(d => d.schemeType === "Rate_Shield").reduce((sum, item) => sum + item.enrolmentValue, 0)
    },
  ].filter(s => s.count > 0);

  const handleLocationClick = (locationName: string) => {
    const loc = locationStats.find(l => l.location === locationName);
    if (!loc) return;

    const locData = data.filter(d => d.location === locationName);
    
    setDetailData({
      type: "location",
      id: locationName,
      name: locationName,
      totalCount: loc.totalCount,
      totalAmount: loc.totalAmount,
      totalOverdue: loc.totalOverdue,
      totalCollection: loc.totalCollection,
      totalRedemption: locData.reduce((sum, d) => sum + d.redemptionActual, 0),
      employeeCount: loc.employeeCount,
      customers: locData,
      totalDueCount: new Set(locData.filter(d => (d.totalDue || 0) > 0).map(d => d.profileNo || d.customerName || d.id).filter(Boolean)).size,
      collectionCustomerCount: new Set(locData.filter(d => d.source !== 'enrollment').map(d => d.profileNo || d.customerName || d.id).filter(Boolean)).size,
      schemes: {
        count11Plus1: locData.filter(d => d.schemeType === "11+1").reduce((sum, d) => sum + d.enrolmentCount, 0),
        count11Plus2: locData.filter(d => d.schemeType === "11+2").reduce((sum, d) => sum + d.enrolmentCount, 0),
        countGpRateShield: locData.filter(d => d.schemeType === "Rate_Shield").reduce((sum, d) => sum + d.enrolmentCount, 0),
        countOnePay: locData.filter(d => d.schemeType === "One_Pay").reduce((sum, d) => sum + d.enrolmentCount, 0),
      }
    });
    setIsDetailOpen(true);
  };

  const handleEmployeeClick = (employee: any) => {
    setDetailData({
      type: "employee",
      id: employee.employeeCode,
      name: employee.employeeName,
      location: employee.location,
      totalCount: employee.totalCount,
      totalAmount: employee.totalAmount,
      totalOverdue: employee.totalOverdue,
      totalCollection: employee.totalCollection,
      totalRedemption: employee.totalRedemption,
      customerCount: employee.customers?.length ?? 0,
      enrolmentCustomerCount: employee.enrolmentCustomerCount,
      collectionCustomerCount: employee.collectionCustomerCount,
      dueCustomerCount: employee.dueCustomerCount,
      installmentAmount: employee.installmentAmount,
      expectedInstAmount: employee.expectedInstAmount,
      currentReceivedAmount: employee.currentReceivedAmount,
      currentDueCount: employee.currentDueCount,
      currentDueValue: employee.currentDueValue,
      totalDueCount: employee.dueCustomerCount,
      totalDue: employee.totalDue,
      paidCustomerCount: employee.paidCustomerCount ?? 0,
      collectionReceivedValue: employee.collectionReceivedValue,
      paymentAgainstOverdueValue: employee.paymentAgainstOverdueValue ?? 0,
      currentDueCollectionValue: employee.currentDueCollectionValue ?? 0,
      foreclosedCount: employee.totalForclosed ?? 0,
      collectionPercent: employee.collectionPercent ?? 0,
      // New performance fields
      totalForclosedValue: employee.totalForclosed ?? 0,
      totalReEnrolmentCount: employee.reEnrolmentCount ?? 0,
      totalReEnrolmentValue: employee.reEnrolmentValue ?? 0,
      totalUpSaleCount: employee.upSaleCount ?? 0,
      totalUpSaleValue: employee.upSaleValue ?? 0,
      totalRedemptionPending: employee.redemptionPending ?? 0,
      customers: employee.customers,
      schemes: {
        count11Plus1: employee.count11Plus1,
        count11Plus2: employee.count11Plus2,
        countGpRateShield: employee.countGpRateShield,
        countOnePay: employee.countOnePay,
      }
    });
    setIsDetailOpen(true);
  };

  const processFiles = async (files: FileList | File[]) => {
    const csvFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) {
      setError?.("Please select CSV files only.");
      return;
    }

    const csvStrings = await Promise.all(csvFiles.map(file => file.text()));
    onFileUpload(csvStrings);
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
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
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
                      FY 2026-27 <span className="text-blue-600">Analytics</span>
                    </h1>
                    <p className="text-sm sm:text-base text-slate-500 max-w-2xl font-medium leading-relaxed">
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
                    {(selectedLocation || selectedUserId) && (
                      <button 
                        onClick={() => {
                          setSelectedLocation("");
                          setSelectedUserId("");
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

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                <StatsCard
                  title="Enrolments"
                  value={formatNumber(metrics.enrolment.count)}
                  subValue={formatCurrency(metrics.enrolment.value)}
                  icon={FileSpreadsheet}
                  className="border-b-4 border-b-blue-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-blue-50 text-blue-600"
                  description="Total scheme volume"
                />
                <StatsCard
                  title="Overdue"
                  value={formatNumber(metrics.overdue.count)}
                  subValue={formatCurrency(metrics.overdue.value)}
                  icon={AlertCircle}
                  className="border-b-4 border-b-rose-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-rose-50 text-rose-600"
                  description="Outstanding installments"
                />
                <StatsCard
                  title="OD Collection"
                  value={formatNumber(metrics.odCollection.count)}
                  subValue={formatCurrency(metrics.odCollection.value)}
                  icon={TrendingUp}
                  className="border-b-4 border-b-emerald-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-emerald-50 text-emerald-600"
                  description="Overdue collection value"
                />
                <StatsCard
                  title="Current Due"
                  value={formatNumber(metrics.currentDue.count)}
                  subValue={formatCurrency(metrics.currentDue.value)}
                  icon={Calendar}
                  className="border-b-4 border-b-amber-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-amber-50 text-amber-600"
                  description="Current month dues"
                />
                <StatsCard
                  title="Total Due"
                  value={formatNumber(metrics.totalDue.count)}
                  subValue={formatCurrency(metrics.totalDue.value)}
                  icon={IndianRupee}
                  className="border-b-4 border-b-red-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-red-50 text-red-600"
                  description="Due count and value"
                />
                <StatsCard
                  title="Due Customers"
                  value={formatNumber(metrics.dueCustomers)}
                  icon={Users}
                  className="border-b-4 border-b-fuchsia-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-fuchsia-50 text-fuchsia-600"
                  description="Unique customer names/profiles"
                />
                <StatsCard
                  title="CD Collection"
                  value={formatNumber(metrics.cdCollection.count)}
                  subValue={formatCurrency(metrics.cdCollection.value)}
                  icon={Check}
                  className="border-b-4 border-b-indigo-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-indigo-50 text-indigo-600"
                  description="Current due collection"
                />
                <StatsCard
                  title="Forclosed"
                  value={formatNumber(metrics.forclosed.count)}
                  subValue={formatCurrency(metrics.forclosed.value)}
                  icon={X}
                  className="border-b-4 border-b-slate-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-slate-50 text-slate-600"
                  description="Closed before maturity"
                />
                <StatsCard
                  title="Redemption"
                  value={formatCurrency(metrics.redemption.actual)}
                  subValue={`Pending: ${formatCurrency(metrics.redemption.pending)}`}
                  icon={Trophy}
                  className="border-b-4 border-b-violet-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-violet-50 text-violet-600"
                  description="Actual vs Pending"
                />
                <StatsCard
                  title="Re-enrolment"
                  value={formatNumber(metrics.reEnrolment.count)}
                  subValue={formatCurrency(metrics.reEnrolment.value)}
                  icon={Users}
                  className="border-b-4 border-b-cyan-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-cyan-50 text-cyan-600"
                  description="Renewed memberships"
                />
                <StatsCard
                  title="UP Sale"
                  value={formatNumber(metrics.upSale.count)}
                  subValue={formatCurrency(metrics.upSale.value)}
                  icon={ArrowUpRight}
                  className="border-b-4 border-b-orange-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-orange-50 text-orange-600"
                  description="Additional sales value"
                />
                <StatsCard
                  title="Store Workforce"
                  value={uniqueEmployees}
                  icon={Users}
                  className="border-b-4 border-b-teal-500 hover:scale-[1.02] transition-transform duration-300"
                  iconClassName="bg-teal-50 text-teal-600"
                  description={selectedLocation ? `Active in ${selectedLocation}` : "Total active contributors"}
                />
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
                  max-w-3xl mx-auto p-8 sm:p-20 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${
                    isDragging 
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