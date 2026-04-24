import Papa from 'papaparse';
import { ProcessedData, EmployeeStat, LocationStats } from '../types';

function cleanNum(val: unknown) {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim();
  if (!str || str === '-') return 0;
  return Number(str.replace(/[^0-9.-]+/g, '')) || 0;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Normalizes scheme names for consistent grouping and counting across the app.
 */
export function normalizeSchemeName(name: string): string {
  const n = (name || '').toLowerCase().replace(/[^a-z0-9+]/g, '');
  if (n.includes('11+1') || n.includes('11plus1')) return '11+1';
  if (n.includes('11+2') || n.includes('11plus2')) return '11+2';
  if (n.includes('rate_shield') || n.includes('rateshield')) return 'Rate_Shield';
  if (n.includes('one_pay') || n.includes('onepay')) return 'One_Pay';
  return name; // Keep original if no match
}

function getValue(normalized: Map<string, string>, names: string[]) {
  const normalizedNames = names.map(normalizeKey);

  // First, try exact matches and favor non-empty ones
  for (const name of names) {
    const value = normalized.get(normalizeKey(name));
    if (value !== undefined && String(value).trim() !== '') return value;
  }

  // Then, handle modified keys (e.g., PapaParse duplicates like "Source_1")
  // We want the LAST non-empty value for a given name if possible, as it's often the "Grand Total" or "Real Data"
  let lastFoundValue = '';
  for (const [key, value] of normalized.entries()) {
    for (const normalName of normalizedNames) {
      if (key.startsWith(normalName)) {
        if (String(value).trim() !== '') {
          lastFoundValue = String(value).trim();
        }
      }
    }
  }

  return lastFoundValue;
}

function baseRow(normalized: Map<string, string>, source: ProcessedData['source']): ProcessedData {
  const orderNo = getValue(normalized, ['Order No', 'Order Number']);
  const profileNo = getValue(normalized, ['Profile No', 'Profile Number', 'Account No']);
  const employeeCode = getValue(normalized, [
    'Emp Code',
    'EMP ID',
    'Employee Code',
    'Staff ID',
    'EMP_CODE',
  ]);
  const customerName = getValue(normalized, ['Customer Name', 'Name of Customer', 'CUSTOMER_NAME']);
  const reportMonth = getValue(normalized, ['Report Month', 'Month']);
  const reportDateRaw = getValue(normalized, ['Report Date As on', 'Date']);

  return {
    id: [
      source,
      orderNo,
      profileNo,
      employeeCode,
      customerName,
      Math.random().toString(36).substr(2, 5),
    ]
      .filter(Boolean)
      .join('-'),
    source,
    locationCode: getValue(normalized, ['Location Code', 'Store Code', 'LOCATION_CODE']).trim(),
    location: getValue(normalized, ['Location', 'Store Name', 'Branch']).trim() || 'Staff Report',
    employeeCode: String(employeeCode || '').trim(),
    employeeName: getValue(normalized, [
      'Emp Name',
      'Employee Name',
      'Sales Person',
      'EMP_NAME',
    ]).trim(),
    joiningDate: getValue(normalized, ['Joining Date', 'DOJ', 'JOINING_DATE']).trim(),
    orderNo: orderNo.trim(),
    profileNo: profileNo.trim(),
    customerName: customerName.trim(),
    schemeType: getValue(normalized, [
      'Scheme Type',
      'Scheme type',
      'Plan Name',
      'Scheme_Type',
    ]).trim(),
    schemeStatus: getValue(normalized, ['Scheme Status', 'Status', 'SCHEME_STATUS']),
    installmentAmount: cleanNum(
      getValue(normalized, [
        'INSTALLMENT_AMOUNT',
        'Installment Amount',
        'Installement Amount',
        'Inst Amt',
        'Inst Amount',
        'Enrollement Amount',
      ]),
    ),
    expectedInstAmount: cleanNum(
      getValue(normalized, ['Expected Inst Amount', 'Expected Amt', 'Expected Inst']),
    ),
    currentReceivedAmount: cleanNum(
      getValue(normalized, [
        'Current Received Amount',
        'Current Received Amt',
        'Received Amt',
        'CURRENT_RECEIVED_AMT',
      ]),
    ),
    totalDue: cleanNum(getValue(normalized, ['Total Due', 'Outstanding'])),
    paidCustomerCount: cleanNum(
      getValue(normalized, ['Paid Cust count', 'Paid Customers', 'Paid Cust']),
    ),
    collectionReceivedValue: cleanNum(
      getValue(normalized, [
        'Collection Received',
        'Collection Received Apr-26',
        'Total Collection',
        'Current Received Amount',
        'Current Received Amt',
        'CURRENT_RECEIVED_AMT',
      ]),
    ),
    collectionPercent: cleanNum(getValue(normalized, ['Collect %', 'Collection %'])),
    paymentAgainstOverdueValue: cleanNum(
      getValue(normalized, [
        'Payment Received Against Over Due',
        'OD Payment',
        'Payment Received Against Over Due',
      ]),
    ),
    currentDueCollectionValue: cleanNum(
      getValue(normalized, [
        'Current Due Against Collection',
        'CD Payment',
        'Current Due Against Collection',
      ]),
    ),
    schemeDiscount: cleanNum(getValue(normalized, ['Scheme Discount', 'Discount'])),
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

export function parseCSV(csvContent: string, fileName?: string): ProcessedData[] {
  // Pre-process: Find the true header row (it might not be the first row if there's merged categories or metadata)
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim() !== '');
  let headerRowIndex = 0;
  const headerIdentifiers = [
    'reportdate',
    'empid',
    'empname',
    'noofenrol',
    'profile',
    'account',
    'grandtotal',
    're-enrollment',
    're-enrollement',
  ];

  // Look at first 5 lines for a row with multiple header-like values
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const normalizedLine = lines[i].toLowerCase().replace(/[^a-z0-9,]+/g, '');
    let matchCount = 0;
    for (const id of headerIdentifiers) {
      if (normalizedLine.includes(id)) matchCount++;
    }
    if (matchCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  // Joint back from the true header row if needed
  const actualCsvContent = lines.slice(headerRowIndex).join('\n');
  const { data } = Papa.parse(actualCsvContent, { header: true, skipEmptyLines: true });

  // Use filename for reliable identification, fallback to header detection
  const f = (fileName || '').toLowerCase();
  const isEnrollmentFile =
    f.includes('enrollment') && !f.includes('re-enrollment') && !f.includes('re-enrolment');
  const isReEnrollmentFile = f.includes('re-enrollment') || f.includes('re-enrolment');
  const isDueFile = f.includes('due') || f.includes('consolidate');

  return data
    .filter((row: any) => {
      // Make location optional for staff-wise reports (re-enrollment)
      const emp =
        row['Emp Code'] ||
        row['EMP ID'] ||
        row['Employee Code'] ||
        row['EMP_CODE'] ||
        row['Emp Name'] ||
        row['Employee Name'];
      return !!emp;
    })
    .map((row) => {
      const normalized = new Map<string, string>(
        Object.entries(row as object).map(([key, value]) => [normalizeKey(key), value as string]),
      );

      const normalizedFields = Array.from(normalized.keys());
      let source: ProcessedData['source'] = 'enrollment';

      if (isDueFile) {
        source = 'dueCollection';
      } else if (isReEnrollmentFile) {
        source = 'enrollment'; // Will be flagged as re-enrollment logic later
      } else if (
        !isEnrollmentFile &&
        normalizedFields.some(
          (f) => f.includes('overdue') || f.includes('pending') || f.includes('due'),
        )
      ) {
        source = 'dueCollection';
      }

      const item = baseRow(normalized, source);

      if (source === 'dueCollection') {
        const paidCount = cleanNum(
          getValue(normalized, ['Paid Cust count', 'Paid Customers', 'Paid Cust']),
        );
        const odCollectionValue = cleanNum(
          getValue(normalized, ['Payment Received Against Over Due', 'OD Payment']),
        );
        const cdCollectionValue = cleanNum(
          getValue(normalized, [
            'Current Due Against Collection',
            'CD Payment',
            'Current Due Against Collection',
          ]),
        );

        const odCount = cleanNum(
          getValue(normalized, [
            'Overdue Pending Inst',
            'Overdue Pending Inst Count',
            'Overdue Count',
          ]),
        );
        const odVal = cleanNum(getValue(normalized, ['Overdue Pending Amount', 'Overdue Amt']));
        item.overdueCount = odCount > 0 ? odCount : odVal > 0 ? 1 : 0;
        item.overdueValue = odVal;

        const cdCount = cleanNum(
          getValue(normalized, ['Current Due Apr-26 Inst', 'Current Due Inst count', 'Dues Count']),
        );
        const cdVal = cleanNum(
          getValue(normalized, ['Current Due Apr-26.', 'Current Due', 'Current month due']),
        );
        item.currentDueCount = cdCount > 0 ? cdCount : cdVal > 0 ? 1 : 0;
        item.currentDueValue = cdVal;
        item.odCollectionCount = odCollectionValue > 0 ? paidCount || 1 : 0;
        item.odCollectionValue = odCollectionValue;
        item.cdCollectionCount = cdCollectionValue > 0 ? paidCount || 1 : 0;
        item.cdCollectionValue = cdCollectionValue;

        const rawForeclosed = getValue(normalized, [
          'Foreclosed',
          'Foreclosed Count',
          'Closed Count',
        ]);
        item.forclosedCount =
          cleanNum(rawForeclosed) > 0 || String(rawForeclosed).toLowerCase() === 'yes' ? 1 : 0;
        item.forclosedValue = cleanNum(
          getValue(normalized, [
            'Foreclosed Amount.',
            'Foreclosed Value',
            'Closed Value',
            'Foreclosed Amount',
          ]),
        );
        item.redemptionActual = cleanNum(
          getValue(normalized, ['Redemption Actual', 'Redeemed Amt']),
        );
        item.redemptionPending = cleanNum(
          getValue(normalized, ['Redemption Pending', 'Expected Redemption']),
        );

        item.reEnrolmentCount = cleanNum(getValue(normalized, ['Re-Enrolment Count'])) > 0 ? 1 : 0;
        item.reEnrolmentValue = cleanNum(getValue(normalized, ['Re-Enrolment Value']));
        item.upSaleCount = cleanNum(getValue(normalized, ['UpSale Count'])) > 0 ? 1 : 0;
        item.upSaleValue = cleanNum(getValue(normalized, ['UpSale Value']));
      } else {
        const rawEnrolCount = cleanNum(
          getValue(normalized, [
            'Total No Of Re-Enrollment',
            'No Of Enrollment',
            'No.of Enrolment',
            'Total',
            'Count',
            'INST_RECEIVED',
            'NUMBER_OF_INSTALLMENTS',
          ]),
        );
        const rawInstAmount = cleanNum(
          getValue(normalized, [
            'Total Re-Enrollement Installment Amount',
            'INSTALLMENT_AMOUNT',
            'Inst Amount',
            'Installement Amount',
            'Inst Amount',
            'Enrollement Amount',
            'Installment Amount',
            'Enrolment Value',
            'TOTAL_INSTALLMENT_AMOUNT',
          ]),
        );

        const typeStr = (
          getValue(normalized, ['Is Re-Enrolment', 'Type', 'Scheme Nature', 'SCHEME_NATURE']) || ''
        ).toLowerCase();
        const hasReEnrolHeader =
          normalized.has('totalnoofreenrollment') || normalized.has('totalnoofreenrollement');
        const isReEnrol =
          typeStr.includes('re') ||
          typeStr.includes('renew') ||
          isReEnrollmentFile ||
          hasReEnrolHeader;
        const isUpSale = typeStr.includes('up') || typeStr.includes('sale');

        if (isReEnrollmentFile || isReEnrol) {
          const rawEnrolCountStr = getValue(normalized, [
            'Total No Of Re-Enrollment',
            'No Of Enrollment',
            'No.of Enrolment',
            'Total',
            'Count',
            'INST_RECEIVED',
            'NUMBER_OF_INSTALLMENTS',
          ]);
          const rawInstAmountStr = getValue(normalized, [
            'Total Re-Enrollement Installment Amount',
            'INSTALLMENT_AMOUNT',
            'Inst Amount',
            'Installement Amount',
            'Inst Amount',
            'Enrollement Amount',
            'Installment Amount',
            'Enrolment Value',
            'TOTAL_INSTALLMENT_AMOUNT',
          ]);

          item.reEnrolmentCount = cleanNum(rawEnrolCountStr) || 1;
          item.reEnrolmentValue = cleanNum(rawInstAmountStr) || item.installmentAmount || 0;

          if (!item.customerName || item.customerName === '-') {
            item.customerName = 'Total Re-Enrolment (Staff Batch)';
          }
        } else if (isUpSale) {
          item.upSaleCount = rawEnrolCount;
          item.upSaleValue = rawInstAmount || item.installmentAmount || 0;
        } else {
          item.enrolmentCount = 1;
          item.enrolmentValue = rawInstAmount || item.installmentAmount || 0;
        }
      }

      return item;
    });
}

export function parseCSVFiles(files: { content: string; name: string }[]): ProcessedData[] {
  const allData = files.reduce(
    (acc, file) => acc.concat(parseCSV(file.content, file.name)),
    [] as ProcessedData[],
  );

  // Create a lookup map for Employee -> Location Data
  const empLocationMap = new Map<string, { location: string; locationCode: string }>();
  allData.forEach((row) => {
    if (
      row.location &&
      row.location !== 'Staff Report' &&
      row.location.toLowerCase() !== 'unknown'
    ) {
      const locData = { location: row.location, locationCode: row.locationCode || '' };
      if (row.employeeCode) empLocationMap.set(row.employeeCode, locData);
      if (row.employeeName) empLocationMap.set(row.employeeName.toLowerCase(), locData);
    }
  });

  // Second pass to update missing locations (e.g., from Staff Reports)
  allData.forEach((row) => {
    if (
      row.location === 'Staff Report' ||
      !row.location ||
      row.location.toLowerCase() === 'unknown'
    ) {
      let match = null;
      if (row.employeeCode && empLocationMap.has(row.employeeCode)) {
        match = empLocationMap.get(row.employeeCode);
      } else if (row.employeeName && empLocationMap.has(row.employeeName.toLowerCase())) {
        match = empLocationMap.get(row.employeeName.toLowerCase());
      }

      if (match) {
        row.location = match.location;
        if (!row.locationCode) row.locationCode = match.locationCode;
      }
    }
  });

  return allData;
}

export function getStatsByLocation(data: ProcessedData[]): LocationStats[] {
  const locMap = new Map<string, any>();

  data.forEach((item) => {
    const locName = item.location || 'Unknown';
    if (!locMap.has(locName)) {
      locMap.set(locName, {
        location: locName,
        totalCount: 0,
        totalAmount: 0,
        enrolmentValue: 0,
        totalOverdue: 0,
        totalDue: 0,
        totalDueValue: 0,
        totalCollection: 0,
        totalForclosed: 0,
        forclosedValue: 0,
        reEnrolmentCount: 0,
        reEnrolmentValue: 0,
        upSaleCount: 0,
        upSaleValue: 0,
        overdueValue: 0,
        currentDueValue: 0,
        paymentAgainstOverdueValue: 0,
        currentDueCollectionValue: 0,
        collectionReceivedValue: 0,
        employeeCount: 0,
        _employees: new Set<string>(),
      });
    }
    const stats = locMap.get(locName);
    stats.totalCount += (item.enrolmentCount || 0) + (item.reEnrolmentCount || 0) + (item.upSaleCount || 0);
    stats.totalAmount += (item.enrolmentValue || 0) + (item.reEnrolmentValue || 0) + (item.upSaleValue || 0);
    stats.enrolmentValue += item.enrolmentValue || 0;
    stats.totalOverdue += (item.overdueValue || 0) + (item.currentDueValue || 0);
    stats.totalDue += item.totalDue || 0;
    stats.totalDueValue += item.totalDue || 0;
    stats.totalCollection += item.collectionReceivedValue || 0;
    stats.totalForclosed += item.forclosedCount || 0;
    stats.forclosedValue += item.forclosedValue || 0;
    stats.reEnrolmentCount += item.reEnrolmentCount || 0;
    stats.reEnrolmentValue += item.reEnrolmentValue || 0;
    stats.upSaleCount += item.upSaleCount || 0;
    stats.upSaleValue += item.upSaleValue || 0;
    stats.overdueValue += item.overdueValue || 0;
    stats.currentDueValue += item.currentDueValue || 0;
    stats.paymentAgainstOverdueValue += item.paymentAgainstOverdueValue || 0;
    stats.currentDueCollectionValue += item.currentDueCollectionValue || 0;
    stats.collectionReceivedValue += item.collectionReceivedValue || 0;

    if (item.employeeCode) stats._employees.add(item.employeeCode);
    stats.employeeCount = stats._employees.size;
  });

  return Array.from(locMap.values());
}

export function getStatsByEmployee(data: ProcessedData[]): EmployeeStat[] {
  const empMap = new Map<string, any>();

  data.forEach((item) => {
    const key = item.employeeCode || item.employeeName || 'Unknown';
    if (!empMap.has(key)) {
      empMap.set(key, {
        employeeCode: item.employeeCode || 'unknown',
        employeeName: item.employeeName || 'Unknown',
        location: item.location || 'Unknown',
        schemes: {
          count11Plus1: 0,
          count11Plus2: 0,
          countGpRateShield: 0,
          countOnePay: 0,
        },
        totalCount: 0,
        totalAmount: 0,
        totalOverdue: 0,
        totalCollection: 0,
        totalForclosed: 0,
        totalDue: 0,
        reEnrolmentCount: 0,
        reEnrolmentValue: 0,
        enrolmentCustomerCount: 0,
        collectionCustomerCount: 0,
        dueCustomerCount: 0,
        installmentAmount: 0,
        expectedInstAmount: 0,
        currentReceivedAmount: 0,
        overdueValue: 0,
        currentDueValue: 0,
        paymentAgainstOverdueValue: 0,
        currentDueCollectionValue: 0,
        collectionReceivedValue: 0,
        forclosedValue: 0,
        redemptionActual: 0,
        redemptionPending: 0,
        upSaleCount: 0,
        upSaleValue: 0,
        paidCustomerCount: 0,
        collectionPercent: 0,
      });
    }

    const stats = empMap.get(key)!;

    // Increment total counts ONLY for enrollment-related rows
    const isEnrolRow =
      (item.enrolmentCount || 0) > 0 ||
      (item.reEnrolmentCount || 0) > 0 ||
      (item.upSaleCount || 0) > 0;
    if (isEnrolRow) {
      stats.totalCount =
        (stats.totalCount || 0) +
        (item.enrolmentCount || item.reEnrolmentCount || item.upSaleCount || 1);
      stats.totalAmount =
        (stats.totalAmount || 0) +
        (item.enrolmentValue || item.reEnrolmentValue || item.upSaleValue || 0);
    }

    // Scheme Counting Logic - use unified normalization
    const normalizedScheme = normalizeSchemeName(item.schemeType || '');
    if (normalizedScheme === '11+1')
      stats.schemes.count11Plus1 = (stats.schemes.count11Plus1 || 0) + (item.enrolmentCount || 0);
    else if (normalizedScheme === '11+2')
      stats.schemes.count11Plus2 = (stats.schemes.count11Plus2 || 0) + (item.enrolmentCount || 0);
    else if (normalizedScheme === 'Rate_Shield')
      stats.schemes.countGpRateShield =
        (stats.schemes.countGpRateShield || 0) + (item.enrolmentCount || 0);
    else if (normalizedScheme === 'One_Pay')
      stats.schemes.countOnePay = (stats.schemes.countOnePay || 0) + (item.enrolmentCount || 0);

    stats.totalOverdue = (stats.totalOverdue || 0) + (item.overdueCount || 0);
    stats.totalCollection =
      (stats.totalCollection || 0) + (item.odCollectionCount || item.cdCollectionCount || 0);
    stats.totalForclosed = (stats.totalForclosed || 0) + (item.forclosedCount || 0);
    stats.forclosedValue = (stats.forclosedValue || 0) + (item.forclosedValue || 0);
    stats.totalDue = (stats.totalDue || 0) + (item.totalDue || 0);
    stats.reEnrolmentCount = (stats.reEnrolmentCount || 0) + (item.reEnrolmentCount || 0);
    stats.reEnrolmentValue = (stats.reEnrolmentValue || 0) + (item.reEnrolmentValue || 0);

    if (item.enrolmentCount > 0)
      stats.enrolmentCustomerCount = (stats.enrolmentCustomerCount || 0) + 1;
    if ((item.cdCollectionCount || 0) > 0 || (item.odCollectionCount || 0) > 0)
      stats.collectionCustomerCount = (stats.collectionCustomerCount || 0) + 1;
    if ((item.totalDue || 0) > 0) stats.dueCustomerCount = (stats.dueCustomerCount || 0) + 1;

    stats.installmentAmount = (stats.installmentAmount || 0) + (item.installmentAmount || 0);
    stats.expectedInstAmount = (stats.expectedInstAmount || 0) + (item.expectedInstAmount || 0);
    stats.currentReceivedAmount =
      (stats.currentReceivedAmount || 0) + (item.currentReceivedAmount || 0);
    stats.overdueValue = (stats.overdueValue || 0) + (item.overdueValue || 0);
    stats.currentDueValue = (stats.currentDueValue || 0) + (item.currentDueValue || 0);
    stats.paymentAgainstOverdueValue =
      (stats.paymentAgainstOverdueValue || 0) + (item.paymentAgainstOverdueValue || 0);
    stats.currentDueCollectionValue =
      (stats.currentDueCollectionValue || 0) + (item.currentDueCollectionValue || 0);
    stats.collectionReceivedValue =
      (stats.collectionReceivedValue || 0) + (item.collectionReceivedValue || 0);
    stats.forclosedValue = (stats.forclosedValue || 0) + (item.forclosedValue || 0);
    stats.redemptionActual = (stats.redemptionActual || 0) + (item.redemptionActual || 0);
    stats.redemptionPending = (stats.redemptionPending || 0) + (item.redemptionPending || 0);
    stats.upSaleCount = (stats.upSaleCount || 0) + (item.upSaleCount || 0);
    stats.upSaleValue = (stats.upSaleValue || 0) + (item.upSaleValue || 0);
    stats.paidCustomerCount = (stats.paidCustomerCount || 0) + (item.paidCustomerCount || 0);
  });

  const results = Array.from(empMap.values());
  results.forEach((stats) => {
    if (stats.totalDue > 0) {
      stats.collectionPercent = (stats.collectionReceivedValue / stats.totalDue) * 100;
    }
  });

  return results;
}
