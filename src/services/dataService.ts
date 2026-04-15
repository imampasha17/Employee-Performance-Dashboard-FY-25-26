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

function getValue(normalized: Map<string, string>, names: string[]) {
  for (const name of names) {
    const value = normalized.get(normalizeKey(name));
    if (value !== undefined) return value;
  }

  // Handle case where keys might have been modified by PapaParse (e.g. duplicate names)
  for (const [key, value] of normalized.entries()) {
    for (const name of names) {
      if (key.startsWith(normalizeKey(name))) return value;
    }
  }

  return "";
}

function baseRow(normalized: Map<string, string>, source: ProcessedData["source"]): ProcessedData {
  const orderNo = getValue(normalized, ["Order No", "Order Number"]);
  const profileNo = getValue(normalized, ["Profile No", "Profile Number", "Account No"]);
  const employeeCode = getValue(normalized, ["Emp Code", "EMP ID", "Employee Code", "Staff ID"]);
  const customerName = getValue(normalized, ["Customer Name", "Name of Customer"]);

  return {
    id: [source, orderNo, profileNo, employeeCode, customerName, Math.random().toString(36).substr(2, 5)].filter(Boolean).join("-"),
    source,
    locationCode: getValue(normalized, ["Location Code", "Store Code"]).trim(),
    location: getValue(normalized, ["Location", "Store Name", "Branch"]).trim(),
    employeeCode: String(employeeCode || "").trim(),
    employeeName: getValue(normalized, ["Emp Name", "Employee Name", "Sales Person"]).trim(),
    joiningDate: getValue(normalized, ["Joining Date", "DOJ"]).trim(),
    orderNo: orderNo.trim(),
    profileNo: profileNo.trim(),
    customerName: customerName.trim(),
    schemeType: getValue(normalized, ["Scheme Type", "Scheme type", "Plan Name"]).trim(),
    schemeStatus: getValue(normalized, ["Scheme Status", "Status"]),
    installmentAmount: cleanNum(getValue(normalized, ["Installment Amount", "Inst Amt", "Inst Amount"])),
    expectedInstAmount: cleanNum(getValue(normalized, ["Expected Inst Amount", "Expected Amt"])),
    currentReceivedAmount: cleanNum(getValue(normalized, ["Current Received Amount", "Current Received Amt", "Received Amt"])),
    totalDue: cleanNum(getValue(normalized, ["Total Due", "Outstanding"])),
    paidCustomerCount: cleanNum(getValue(normalized, ["Paid Cust count", "Paid Customers"])),
    collectionReceivedValue: cleanNum(getValue(normalized, ["Collection Received", "Collection Received Apr-26", "Total Collection"])),
    collectionPercent: cleanNum(getValue(normalized, ["Collect %", "Collection %"])),
    paymentAgainstOverdueValue: cleanNum(getValue(normalized, ["Payment Received Against Over Due", "OD Payment"])),
    currentDueCollectionValue: cleanNum(getValue(normalized, ["Current Due Against Collection", "CD Payment"])),
    schemeDiscount: cleanNum(getValue(normalized, ["Scheme Discount", "Discount"])),
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

  const fields = headerResults.meta.fields || [];
  const normalizedFields = fields.map(normalizeKey);

  // Detect source type more robustly
  let source: ProcessedData["source"] = "enrollment";
  if (normalizedFields.some(f => f.includes("overdue") || f.includes("pending") || f.includes("due"))) {
    source = "dueCollection";
  } else if (normalizedFields.some(f => f.includes("collection") || f.includes("received"))) {
    source = "dueCollection";
  } else if (normalizedFields.some(f => f.includes("reenrollment"))) {
    source = "enrollment";
  }

  return headerResults.data
    .filter(row => {
      const loc = row["Location"] || row["Store Name"] || row["Branch"];
      const emp = row["Emp Code"] || row["EMP ID"] || row["Employee Code"];
      return loc && emp;
    })
    .map(row => {
      const normalized = new Map(
        Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
      );
      const item = baseRow(normalized, source);

      if (source === "dueCollection") {
        const paidCount = cleanNum(getValue(normalized, ["Paid Cust count", "Paid Customers"]));
        const odCollectionValue = cleanNum(getValue(normalized, ["Payment Received Against Over Due", "OD Payment"]));
        const cdCollectionValue = cleanNum(getValue(normalized, ["Current Due Against Collection", "CD Payment"]));
        
        item.overdueCount = cleanNum(getValue(normalized, ["Overdue Pending Inst Count", "Overdue Count"]));
        item.overdueValue = cleanNum(getValue(normalized, ["Overdue Pending Amount", "Overdue Amt"]));
        item.currentDueCount = cleanNum(getValue(normalized, ["Current Due Inst count", "Dues Count"]));
        item.currentDueValue = cleanNum(getValue(normalized, ["Current Due", "Current month due"]));
        item.odCollectionCount = odCollectionValue > 0 ? (paidCount || 1) : 0;
        item.odCollectionValue = odCollectionValue;
        item.cdCollectionCount = cdCollectionValue > 0 ? (paidCount || 1) : 0;
        item.cdCollectionValue = cdCollectionValue;
        
        // Foreclosed, Redemption, Re-enrolment from specific column names if they exist
        item.forclosedCount = cleanNum(getValue(normalized, ["Foreclosed Count", "Closed Count"])) > 0 ? 1 : 0;
        item.forclosedValue = cleanNum(getValue(normalized, ["Foreclosed Value", "Closed Value"]));
        item.redemptionActual = cleanNum(getValue(normalized, ["Redemption Actual", "Redeemed Amt"]));
        item.redemptionPending = cleanNum(getValue(normalized, ["Redemption Pending", "Expected Redemption"]));
        // Re-enrolment from specific column names if they exist
        item.reEnrolmentCount = cleanNum(getValue(normalized, ["Re-Enrolment Count", "No of Enrollment"])) > 0 ? 1 : 0;
        item.reEnrolmentValue = cleanNum(getValue(normalized, ["Re-Enrolment Value", "Inst Amount"]));
        item.upSaleCount = cleanNum(getValue(normalized, ["UpSale Count"])) > 0 ? 1 : 0;
        item.upSaleValue = cleanNum(getValue(normalized, ["UpSale Value"]));

        // If it's from the specific re-enrollment summary file, set enactment count too
        if (item.reEnrolmentCount > 0 && item.enrolmentCount === 0) {
          item.enrolmentCount = item.reEnrolmentCount;
          item.enrolmentValue = item.reEnrolmentValue;
        }
      } else {
        // Enrolment
        item.enrolmentCount = 1;
        item.enrolmentValue = item.installmentAmount || 0;
        
        // Also look for specific enrolment flags
        const typeStr = getValue(normalized, ["Is Re-Enrolment", "Type", "Scheme Nature"]).toLowerCase();
        const isReEnrolment = typeStr.includes("re") || typeStr.includes("renew");
        if (isReEnrolment) {
          item.reEnrolmentCount = 1;
          item.reEnrolmentValue = item.installmentAmount || 0;
        }

        // Handle the specific "No of Enrollment" column if it exists in enrollment sources
        const extraCount = cleanNum(getValue(normalized, ["No Of Enrollment"]));
        if (extraCount > 0) {
          item.enrolmentCount = extraCount;
          item.enrolmentValue = cleanNum(getValue(normalized, ["Inst Amount"])) || item.enrolmentValue;
          // If we are in enrollment and see "No of Enrollment", it might be the re-enrollment summary file
          // which doesn't have "re-enrollment" in the name/nature, so we check if filename logic can be added later
          // For now, if source is detected as enrollment but it has "Inst Amount" from re-enrollment summary:
          if (csvString.includes("Re-Enrollment") || csvString.includes("re-enrolment")) {
             item.reEnrolmentCount = extraCount;
             item.reEnrolmentValue = item.enrolmentValue;
          }
        }
      }

      return item;
    });
}


export function parseCSVFiles(csvStrings: string[]): ProcessedData[] {
  return csvStrings.reduce((acc, csv) => acc.concat(parseCSV(csv)), [] as ProcessedData[]);
}

export function getStatsByLocation(data: ProcessedData[]): LocationStats[] {
  const locMap = new Map<string, any>();
  
  for (const item of data) {
    const locName = item.location || "Unknown Location";
    if (!locMap.has(locName)) {
      locMap.set(locName, {
        location: locName,
        totalCount: 0,
        totalAmount: 0,
        totalOverdue: 0,
        totalCollection: 0,
        employeeCount: 0,
        enrolmentValue: 0,
        totalDue: 0,
        totalForclosed: 0,
        reEnrolmentCount: 0,
        upSaleCount: 0,
        _employees: new Set<string>()
      });
    }
    const stats = locMap.get(locName);
    stats.totalCount += item.enrolmentCount || 0;
    stats.totalAmount += item.enrolmentValue || 0;
    stats.enrolmentValue += item.enrolmentValue || 0;
    stats.totalOverdue += (item.overdueValue || 0) + (item.currentDueValue || 0);
    stats.totalDue += item.totalDue || 0;
    stats.totalCollection += item.collectionReceivedValue || 0;
    stats.totalForclosed += item.forclosedCount || 0;
    stats.reEnrolmentCount += item.reEnrolmentCount || 0;
    stats.upSaleCount += item.upSaleCount || 0;
    
    if (item.employeeCode) stats._employees.add(item.employeeCode);
    stats.employeeCount = stats._employees.size;
  }
  
  return Array.from(locMap.values());
}

export function getStatsByEmployee(data: ProcessedData[]): EmployeeStat[] {
  const empMap = new Map<string, any>();

  for (const item of data) {
    const key = item.employeeCode || "unassigned";
    if (!empMap.has(key)) {
      empMap.set(key, {
        employeeCode: key,
        employeeName: item.employeeName || "Unknown Employee",
        location: item.location || "Unknown Location",
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
    stats.totalForclosed += item.forclosedCount || 0;
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
    stats.schemeDiscount = (stats.schemeDiscount || 0) + (item.schemeDiscount || 0);

    // Scheme counts
    if (item.enrolmentCount > 0) {
      const type = item.schemeType?.toLowerCase() || "";
      if (type.includes("11+1")) stats.count11Plus1 += item.enrolmentCount;
      else if (type.includes("11+2")) stats.count11Plus2 += item.enrolmentCount;
      else if (type.includes("rate") || type.includes("shield")) stats.countGpRateShield += item.enrolmentCount;
      else if (type.includes("one") || type.includes("pay")) stats.countOnePay += item.enrolmentCount;
    }

    const profileId = item.profileNo || item.customerName || item.id;
    if ((item.totalDue || 0) > 0) stats._dueProfiles.add(profileId);
    if (item.source === "enrollment" || item.enrolmentCount > 0) stats._enrolmentProfiles.add(profileId);
    if (item.source === "dueCollection" || item.collectionReceivedValue > 0) stats._collectionProfiles.add(profileId);
    
    stats.dueCustomerCount = stats._dueProfiles.size;
    stats.enrolmentCustomerCount = stats._enrolmentProfiles.size;
    stats.collectionCustomerCount = stats._collectionProfiles.size;
  }
  
  return Array.from(empMap.values());
}