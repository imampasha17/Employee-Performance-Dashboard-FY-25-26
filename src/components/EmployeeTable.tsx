import React, { useMemo, useState } from "react";
import { Search, User, Trophy, ArrowUpRight, FileSpreadsheet } from "lucide-react";
import { formatCurrency, formatNumber, cn } from "../lib/utils";
import { EmployeeStat } from "../types";

interface EmployeeTableProps {
  data: EmployeeStat[];
  onEmployeeClick?: (employee: EmployeeStat) => void;
  compact?: boolean;
}

export function EmployeeTable({ data, onEmployeeClick }: EmployeeTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = query
      ? data.filter(
          item =>
            item.employeeName.toLowerCase().includes(query) ||
            item.employeeCode.toLowerCase().includes(query) ||
            item.location.toLowerCase().includes(query)
        )
      : data;

    return [...filtered].sort((a, b) => b.totalAmount - a.totalAmount || a.employeeName.localeCompare(b.employeeName));
  }, [data, searchQuery]);

  const top5Ids = useMemo(() => {
    return [...data]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)
      .map(e => e.employeeCode);
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden transition-all duration-300">
      <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100 bg-slate-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Employee Data</h3>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500">
              Select an employee to view enrolment, collection, and customer-wise data.
            </p>
          </div>

          <div className="relative group max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search name, ID, or location..."
              className="block w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden divide-y divide-slate-100">
        {filteredData.length > 0 ? (
          filteredData.map(employee => {
            const isTop5 = top5Ids.includes(employee.employeeCode);
            return (
              <button
                key={`${employee.location}-${employee.employeeCode}-mobile`}
                onClick={() => onEmployeeClick?.(employee)}
                className="w-full text-left p-4 bg-white active:bg-blue-50 transition-colors space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      isTop5 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {isTop5 ? <Trophy className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900 leading-tight">{employee.employeeName}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">ID: {employee.employeeCode} • {employee.location}</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-slate-300" />
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <MobileStat label="Enrolments" value={formatNumber(employee.totalCount)} />
                  <MobileStat label="Enrol Value" value={formatCurrency(employee.totalAmount)} />
                  <MobileStat label="Collection" value={formatCurrency(employee.totalCollection)} tone="emerald" />
                  <MobileStat label="Total Due" value={formatCurrency(employee.totalDue)} tone="rose" />
                  <MobileStat label="Re-Enrol" value={formatNumber(employee.reEnrolmentCount)} tone="emerald" />
                  <MobileStat label="Re-Enrol Val" value={formatCurrency(employee.reEnrolmentValue)} tone="emerald" />
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-8 py-12 text-center">
            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-bold text-sm">No matches found</p>
          </div>
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[1280px]">
          <div className="grid grid-cols-[minmax(200px,1fr)_100px_80px_100px_100px_80px_80px_80px_100px_100px_80px_100px_36px] gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <div>Employee</div>
            <div>Location</div>
            <div className="text-right">Enrols</div>
            <div className="text-right">Enrol Val</div>
            <div className="text-right">Inst. Amount</div>
            <div className="text-right">En Cust</div>
            <div className="text-right">Col Cust</div>
            <div className="text-right">Due Cust</div>
            <div className="text-right">Collection</div>
            <div className="text-right">Total Due</div>
            <div className="text-right">Re-Enrol</div>
            <div className="text-right">Re-Enrol Val</div>
            <div />
          </div>

          <div className="divide-y divide-slate-100">
            {filteredData.length > 0 && filteredData.map(employee => {
              const isTop5 = top5Ids.includes(employee.employeeCode);
              return (
                <button
                  key={`${employee.location}-${employee.employeeCode}`}
                  onClick={() => onEmployeeClick?.(employee)}
                  className="w-full text-left px-4 py-3 bg-white hover:bg-blue-50/40 transition-colors group grid grid-cols-[minmax(200px,1fr)_100px_80px_100px_100px_80px_80px_80px_100px_100px_80px_100px_36px] gap-3 items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      isTop5 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                    )}>
                      {isTop5 ? <Trophy className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-sm text-slate-900 truncate group-hover:text-blue-700">
                        {employee.employeeName}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">ID: {employee.employeeCode}</div>
                    </div>
                  </div>
                  <RowValue value={employee.location} />
                  <RowValue value={formatNumber(employee.totalCount)} align="right" />
                  <RowValue value={formatCurrency(employee.totalAmount)} align="right" />
                  <RowValue value={formatCurrency(employee.installmentAmount)} align="right" />
                  <RowValue value={formatNumber(employee.enrolmentCustomerCount)} align="right" />
                  <RowValue value={formatNumber(employee.collectionCustomerCount)} align="right" />
                  <RowValue value={formatNumber(employee.dueCustomerCount)} tone="rose" align="right" />
                  <RowValue value={formatCurrency(employee.totalCollection)} tone="emerald" align="right" />
                  <RowValue value={formatCurrency(employee.totalDue)} tone="rose" align="right" />
                  <RowValue value={formatNumber(employee.reEnrolmentCount)} tone="emerald" align="right" />
                  <RowValue value={formatCurrency(employee.reEnrolmentValue)} tone="emerald" align="right" />
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Showing {filteredData.length} of {data.length} total employees
        </p>
      </div>
    </div>
  );
}

function MobileStat({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  return (
    <div>
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</div>
      <div className={cn(
        "text-xs font-black",
        tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-800"
      )}>
        {value}
      </div>
    </div>
  );
}

function RowValue({ value, tone, align }: { value: string; tone?: "rose" | "emerald"; align?: "right" }) {
  return (
    <div className={cn(
      "text-xs font-black truncate", 
      tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-800",
      align === "right" ? "text-right" : "text-left"
    )}>
      {value}
    </div>
  );
}
