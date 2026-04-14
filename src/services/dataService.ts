import Papa from "papaparse";
import { ProcessedData, EmployeeStat, LocationStats } from "../types";

function cleanNum(val: unknown) {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim();
  if (!str || str === "-") return 0;
  return Number(str.replace(/[^0-9.-]+/g, "")) || 0;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getValue(row: Record<string, string>, names: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const name of names) {
    const value = normalized.get(normalizeKey(name));
    if (value !== undefined) return value;
  }

  return "";
}

function baseRow(row: Record<string, string>, source: ProcessedData["source"]): ProcessedData {
  const orderNo = getValue(row, ["Order No"]);
  const profileNo = getValue(row, ["Profile No"]);
  const employeeCode = getValue(row, ["Emp Code", "EMP ID"]);
  const customerName = getValue(row, ["Customer Name"]);

  return {
    id: [source, orderNo, profileNo, employeeCode, customerName].filter(Boolean).join("-"),
    source,
    locationCode: getValue(row, ["Location Code"]).trim(),
    location: getValue(row, ["Location"]).trim(),
    employeeCode: String(employeeCode || "").trim(),
    employeeName: getValue(row, ["Emp Name", "Employee Name"]).trim(),
    joiningDate: getValue(row, ["Joining Date"]).trim(),
    orderNo: orderNo.trim(),
    profileNo: profileNo.trim(),
    customerName: customerName.trim(),
    schemeType: getValue(row, ["Scheme Type", "Scheme type"]).trim(),
    schemeStatus: getValue(row, ["Scheme Status"]).trim(),
    installmentAmount: cleanNum(getValue(row, ["Installment Amount"])),
    expectedInstAmount: cleanNum(getValue(row, ["Expected Inst Amount"])),
    currentReceivedAmount: cleanNum(getValue(row, ["Current Received Amount", "Current Received Amt"])),
    totalDue: cleanNum(getValue(row, ["Total Due"])),
    paidCustomerCount: cleanNum(getValue(row, ["Paid Cust count"])),
    collectionReceivedValue: cleanNum(getValue(row, ["Collection Received Apr-26"])),
    collectionPercent: cleanNum(getValue(row, ["Collect %"])),
    paymentAgainstOverdueValue: cleanNum(getValue(row, ["Payment Received Against Over Due"])),
    currentDueCollectionValue: cleanNum(getValue(row, ["Current Due Against Collection"])),
    schemeDiscount: cleanNum(getValue(row, ["Scheme Discount"])),
    enrolmentCount: 0,
    enrolmentValue: 0,
    overdueCount: 0,
    overdueValue: 0,
    odCollectionCount: 0,
    odCollectionValue: 0,
    currentDueCount: 0,
    currentDueValue: 0,
    cdCollectionCount: 0,
    cdCollectionValue: 0,
    forclosedCount: 0,
    forclosedValue: 0,
    redemptionActual: 0,
    redemptionPending: 0,
    reEnrolmentCount: 0,
    reEnrolmentValue: 0,
    upSaleCount: 0,
    upSaleValue: 0,
  };
}

export function parseCSV(csvString: string): ProcessedData[] {
  const headerResults = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  if (headerResults.meta.fields?.some(field => normalizeKey(field) === "profileno")) {
    return headerResults.data
      .filter(row => getValue(row, ["Location"]) && getValue(row, ["Emp Code"]) && getValue(row, ["Emp Name"]))
      .map(row => {
        const hasDueColumns = headerResults.meta.fields?.some(field => normalizeKey(field).includes("overduepending"));
        const item = baseRow(row, hasDueColumns ? "dueCollection" : "enrollment");

        if (hasDueColumns) {
          const paidCount = cleanNum(getValue(row, ["Paid Cust count"]));
          const odCollectionValue = cleanNum(getValue(row, ["Payment Received Against Over Due"]));
          const cdCollectionValue = cleanNum(getValue(row, ["Current Due Against Collection"]));
          const collectionReceivedValue = cleanNum(getValue(row, ["Collection Received Apr-26"]));
          item.overdueCount = cleanNum(getValue(row, ["Overdue Pending Inst Count"]));
          item.overdueValue = cleanNum(getValue(row, ["Overdue Pending Amount"]));
          item.currentDueCount = cleanNum(getValue(row, ["Current Due Apr-26 Inst count"]));
          item.currentDueValue = cleanNum(getValue(row, ["Current Due Apr-26."]));
          item.odCollectionCount = odCollectionValue > 0 ? paidCount || 1 : 0;
          item.odCollectionValue = odCollectionValue;
          item.cdCollectionCount = cdCollectionValue > 0 ? paidCount || 1 : 0;
          item.cdCollectionValue = cdCollectionValue;
        } else {
          item.enrolmentCount = 1;
          item.enrolmentValue = item.installmentAmount || 0;
        }

        return item;
      });
  }
  
  return [];
}

export function parseCSVFiles(csvStrings: string[]): ProcessedData[] {
  return csvStrings.reduce((acc, csv) => acc.concat(parseCSV(csv)), [] as ProcessedData[]);
}

export function getStatsByLocation(data: ProcessedData[]): LocationStats[] {
  const locMap = new Map<string, any>();
  
  for (const item of data) {
    if (!locMap.has(item.location)) {
      locMap.set(item.location, {
        location: item.location,
        totalCount: 0,
        totalAmount: 0,
        totalOverdue: 0,
        totalCollection: 0,
        employeeCount: 0,
        _employees: new Set<string>()
      });
    }
    const stats = locMap.get(item.location);
    stats.totalCount += item.enrolmentCount || 0;
    stats.totalAmount += item.enrolmentValue || 0;
    stats.totalOverdue += (item.overdueValue || 0) + (item.currentDueValue || 0);
    stats.totalCollection += item.collectionReceivedValue || 0;
    if (item.employeeCode) stats._employees.add(item.employeeCode);
    stats.employeeCount = stats._employees.size;
  }
  
  return Array.from(locMap.values());
}

export function getStatsByEmployee(data: ProcessedData[]): EmployeeStat[] {
  const empMap = new Map<string, any>();

  for (const item of data) {
    const key = item.employeeCode;
    if (!empMap.has(key)) {
      empMap.set(key, {
        employeeCode: key,
        employeeName: item.employeeName,
        location: item.location,
        totalCount: 0,
        totalAmount: 0,
        count11Plus1: 0,
        count11Plus2: 0,
        countGpRateShield: 0,
        countOnePay: 0,
        totalOverdue: 0,
        totalCollection: 0,
        totalRedemption: 0,
        totalForclosed: 0,
        totalDue: 0,
        installmentAmount: 0,
        expectedInstAmount: 0,
        currentReceivedAmount: 0,
        currentDueCount: 0,
        currentDueValue: 0,
        odCollectionValue: 0,
        cdCollectionValue: 0,
        collectionReceivedValue: 0,
        reEnrolmentCount: 0,
        reEnrolmentValue: 0,
        upSaleCount: 0,
        upSaleValue: 0,
        redemptionPending: 0,
        dueCustomerCount: 0,
        enrolmentCustomerCount: 0,
        collectionCustomerCount: 0,
        customers: [],
        _dueProfiles: new Set<string>(),
        _enrolmentProfiles: new Set<string>(),
        _collectionProfiles: new Set<string>()
      });
    }
    
    const stats = empMap.get(key);
    stats.customers.push(item);
    stats.totalCount += item.enrolmentCount || 0;
    stats.totalAmount += item.enrolmentValue || 0;
    stats.totalOverdue += (item.overdueValue || 0) + (item.currentDueValue || 0);
    stats.totalCollection += item.collectionReceivedValue || 0;
    stats.totalRedemption += item.redemptionActual || 0;
    stats.totalForclosed += item.forclosedValue || 0;
    stats.totalDue += item.totalDue || 0;
    stats.installmentAmount += item.installmentAmount || 0;
    stats.expectedInstAmount += item.expectedInstAmount || 0;
    stats.currentReceivedAmount += item.currentReceivedAmount || 0;
    stats.currentDueCount += item.currentDueCount || 0;
    stats.currentDueValue += item.currentDueValue || 0;
    stats.odCollectionValue += item.odCollectionValue || 0;
    stats.cdCollectionValue += item.cdCollectionValue || 0;
    stats.collectionReceivedValue += item.collectionReceivedValue || 0;
    stats.reEnrolmentCount += item.reEnrolmentCount || 0;
    stats.reEnrolmentValue += item.reEnrolmentValue || 0;
    stats.upSaleCount += item.upSaleCount || 0;
    stats.upSaleValue += item.upSaleValue || 0;
    stats.redemptionPending += item.redemptionPending || 0;

    // Scheme counts (from enrollment records)
    if (item.source === "enrollment" || (item.enrolmentCount || 0) > 0) {
      if (item.schemeType === "11+1") stats.count11Plus1 += item.enrolmentCount || 1;
      else if (item.schemeType === "11+2") stats.count11Plus2 += item.enrolmentCount || 1;
      else if (item.schemeType === "Rate_Shield") stats.countGpRateShield += item.enrolmentCount || 1;
      else if (item.schemeType === "One_Pay") stats.countOnePay += item.enrolmentCount || 1;
    }

    const profileId = item.profileNo || item.customerName || item.id;
    if ((item.totalDue || 0) > 0) stats._dueProfiles.add(profileId);
    if (item.source === "enrollment" || (item.enrolmentCount || 0) > 0) stats._enrolmentProfiles.add(profileId);
    if (item.source !== "enrollment") stats._collectionProfiles.add(profileId);
    
    stats.dueCustomerCount = stats._dueProfiles.size;
    stats.enrolmentCustomerCount = stats._enrolmentProfiles.size;
    stats.collectionCustomerCount = stats._collectionProfiles.size;
  }
  
  return Array.from(empMap.values());
}