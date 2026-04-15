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
  const normalizedNames = names.map(normalizeKey);
  
  // First, try exact matches and favor non-empty ones
  for (const name of names) {
    const value = normalized.get(normalizeKey(name));
    if (value !== undefined && String(value).trim() !== "") return value;
  }

  // Then, handle modified keys (e.g., PapaParse duplicates like "Source_1")
  // We want the LAST non-empty value for a given name if possible, as it's often the "Grand Total" or "Real Data"
  let lastFoundValue = "";
  for (const [key, value] of normalized.entries()) {
    for (const normalName of normalizedNames) {
      if (key.startsWith(normalName)) {
        if (String(value).trim() !== "") {
          lastFoundValue = String(value).trim();
        }
      }
    }
  }

  return lastFoundValue;
}

function baseRow(normalized: Map<string, string>, source: ProcessedData["source"]): ProcessedData {
  const orderNo = getValue(normalized, ["Order No", "Order Number"]);
  const profileNo = getValue(normalized, ["Profile No", "Profile Number", "Account No"]);
  const employeeCode = getValue(normalized, ["Emp Code", "EMP ID", "Employee Code", "Staff ID", "EMP_CODE"]);
  const customerName = getValue(normalized, ["Customer Name", "Name of Customer", "CUSTOMER_NAME"]);
  const reportMonth = getValue(normalized, ["Report Month", "Month"]);
  const reportDateRaw = getValue(normalized, ["Report Date As on", "Date"]);

  return {
    id: [source, orderNo, profileNo, employeeCode, customerName, Math.random().toString(36).substr(2, 5)].filter(Boolean).join("-"),
    source,
    locationCode: getValue(normalized, ["Location Code", "Store Code", "LOCATION_CODE"]).trim(),
    location: (getValue(normalized, ["Location", "Store Name", "Branch"]).trim()) || "Staff Report",
    employeeCode: String(employeeCode || "").trim(),
    employeeName: getValue(normalized, ["Emp Name", "Employee Name", "Sales Person", "EMP_NAME"]).trim(),
    joiningDate: getValue(normalized, ["Joining Date", "DOJ", "JOINING_DATE"]).trim(),
    orderNo: orderNo.trim(),
    profileNo: profileNo.trim(),
    customerName: customerName.trim(),
    schemeType: getValue(normalized, ["Scheme Type", "Scheme type", "Plan Name", "Scheme_Type"]).trim(),
    schemeStatus: getValue(normalized, ["Scheme Status", "Status", "SCHEME_STATUS"]),
    installmentAmount: cleanNum(getValue(normalized, ["Installment Amount", "Installement Amount", "Inst Amt", "Inst Amount", "Enrollement Amount", "INSTALLMENT_AMOUNT"])),
    expectedInstAmount: cleanNum(getValue(normalized, ["Expected Inst Amount", "Expected Amt", "Expected Inst"])),
    currentReceivedAmount: cleanNum(getValue(normalized, ["Current Received Amount", "Current Received Amt", "Received Amt", "CURRENT_RECEIVED_AMT"])),
    totalDue: cleanNum(getValue(normalized, ["Total Due", "Outstanding"])),
    paidCustomerCount: cleanNum(getValue(normalized, ["Paid Cust count", "Paid Customers", "Paid Cust"])),
    collectionReceivedValue: cleanNum(getValue(normalized, ["Collection Received", "Collection Received Apr-26", "Total Collection"])),
    collectionPercent: cleanNum(getValue(normalized, ["Collect %", "Collection %"])),
    paymentAgainstOverdueValue: cleanNum(getValue(normalized, ["Payment Received Against Over Due", "OD Payment"])),
    currentDueCollectionValue: cleanNum(getValue(normalized, ["Current Due Against Collection", "CD Payment"])),
    schemeDiscount: cleanNum(getValue(normalized, ["Scheme Discount", "Discount", "Scheme Discount"])),
    reportMonth: reportMonth.trim(),
    reportDate: reportDateRaw.trim() || undefined,
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
  // Pre-process: Find the true header row (it might not be the first row if there's merged categories or metadata)
  const lines = csvString.split(/\r?\n/).filter(line => line.trim() !== "");
  let headerRowIndex = 0;
  const headerIdentifiers = ["reportdate", "empid", "empname", "noofenrol", "profile", "account"];
  
  // Look at first 5 lines for a row with multiple header-like values
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const normalizedLine = lines[i].toLowerCase().replace(/[^a-z0-9,]+/g, "");
    let matchCount = 0;
    for (const id of headerIdentifiers) {
      if (normalizedLine.includes(id)) matchCount++;
    }
    if (matchCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  // Join back from the true header row
  const effectiveCSV = lines.slice(headerRowIndex).join("\n");

  const headerResults = Papa.parse<Record<string, string>>(effectiveCSV, {
    header: true,
    skipEmptyLines: true,
  });

  const fields = headerResults.meta.fields || [];
  const normalizedFields = fields.map(normalizeKey);

  // Detect source type more robustly
  let source: ProcessedData["source"] = "enrollment";
  
  if (normalizedFields.some(f => f.includes("overdue") || f.includes("pending") || f.includes("due"))) {
    // If it has "due" or "pending", it's likely a due/collection report
    source = "dueCollection";
  } else if (normalizedFields.some(f => f === "collectionreceived" || f === "totalcollection" || f === "odpayment" || f === "cdpayment")) {
    source = "dueCollection";
  } else if (normalizedFields.some(f => f.includes("enrol") || f.includes("enrolment") || f.includes("enrollment"))) {
    // If it has enrolment keywords, it's definitely enrollment
    source = "enrollment";
  }

  // Handle re-enrollment specific structure if needed
  // Check content string AND for a signature pattern (multiple enrollment columns)
  const enrolmentColCount = normalizedFields.filter(f => f.startsWith("noofenrollment") || f.startsWith("noofenrolment")).length;
  const isReEnrollmentFile = 
    csvString.toLowerCase().includes("re-enrollment") || 
    csvString.toLowerCase().includes("re-enrolment") ||
    enrolmentColCount > 1;

  return headerResults.data
    .filter(row => {
      // Make location optional for staff-wise reports (re-enrollment)
      const emp = row["Emp Code"] || row["EMP ID"] || row["Employee Code"] || row["EMP_CODE"] || row["Emp Name"] || row["Employee Name"];
      return !!emp;
    })
    .map(row => {
      const normalized = new Map(
        Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
      );
      const item = baseRow(normalized, source);

      if (source === "dueCollection") {
        const paidCount = cleanNum(getValue(normalized, ["Paid Cust count", "Paid Customers", "Paid Cust"]));
        const odCollectionValue = cleanNum(getValue(normalized, ["Payment Received Against Over Due", "OD Payment"]));
        const cdCollectionValue = cleanNum(getValue(normalized, ["Current Due Against Collection", "CD Payment", "Current Due Against Collection"]));
        
        item.overdueCount = cleanNum(getValue(normalized, ["Overdue Pending Inst Count", "Overdue Count"]));
        item.overdueValue = cleanNum(getValue(normalized, ["Overdue Pending Amount", "Overdue Amt"]));
        item.currentDueCount = cleanNum(getValue(normalized, ["Current Due Inst count", "Dues Count"]));
        item.currentDueValue = cleanNum(getValue(normalized, ["Current Due", "Current month due"]));
        item.odCollectionCount = odCollectionValue > 0 ? (paidCount || 1) : 0;
        item.odCollectionValue = odCollectionValue;
        item.cdCollectionCount = cdCollectionValue > 0 ? (paidCount || 1) : 0;
        item.cdCollectionValue = cdCollectionValue;
        
        item.forclosedCount = cleanNum(getValue(normalized, ["Foreclosed Count", "Closed Count"])) > 0 ? 1 : (getValue(normalized, ["Foreclosed"]) === 'Yes' ? 1 : 0);
        item.forclosedValue = cleanNum(getValue(normalized, ["Foreclosed Value", "Closed Value", "Foreclosed Amount"]));
        item.redemptionActual = cleanNum(getValue(normalized, ["Redemption Actual", "Redeemed Amt"]));
        item.redemptionPending = cleanNum(getValue(normalized, ["Redemption Pending", "Expected Redemption"]));
        
        item.reEnrolmentCount = cleanNum(getValue(normalized, ["Re-Enrolment Count"])) > 0 ? 1 : 0;
        item.reEnrolmentValue = cleanNum(getValue(normalized, ["Re-Enrolment Value"]));
        item.upSaleCount = cleanNum(getValue(normalized, ["UpSale Count"])) > 0 ? 1 : 0;
        item.upSaleValue = cleanNum(getValue(normalized, ["UpSale Value"]));

        if (item.reEnrolmentCount > 0 && item.enrolmentCount === 0) {
          item.enrolmentCount = item.reEnrolmentCount;
          item.enrolmentValue = item.reEnrolmentValue;
        }
      } else {
        // Enrolment / Re-Enrolment report logic
        const rawEnrolCount = cleanNum(getValue(normalized, ["No Of Enrollment", "No.of Enrolment"]));
        const rawInstAmount = cleanNum(getValue(normalized, ["Inst Amount", "Installement Amount", "Inst Amount", "Enrollement Amount", "Installment Amount", "Enrolment Value"]));
        
        // Detect if this specific row is a re-enrollment
        const typeStr = (getValue(normalized, ["Is Re-Enrolment", "Type", "Scheme Nature", "SCHEME_NATURE"]) || "").toLowerCase();
        const isReEnrol = typeStr.includes("re") || typeStr.includes("renew") || isReEnrollmentFile;
        const isUpSale = typeStr.includes("up") || typeStr.includes("sale");

        if (isReEnrol) {
          item.reEnrolmentCount = rawEnrolCount || 1;
          item.reEnrolmentValue = rawInstAmount || item.installmentAmount || 0;
          // Re-enrollments are also counted as general enrollments for total volume
          item.enrolmentCount = item.reEnrolmentCount;
          item.enrolmentValue = item.reEnrolmentValue;
        } else if (isUpSale) {
          item.upSaleCount = rawEnrolCount || 1;
          item.upSaleValue = rawInstAmount || item.installmentAmount || 0;
          // Up-sales are also counted as general enrollments for total volume
          item.enrolmentCount = item.upSaleCount;
          item.enrolmentValue = item.upSaleValue;
        } else {
          // Standard enrolment
          item.enrolmentCount = rawEnrolCount || 1;
          item.enrolmentValue = rawInstAmount || item.installmentAmount || 0;
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