import Papa from "papaparse";
import fs from "fs";

function cleanNum(val) {
  if (val === undefined || val === null) return 0;
  const str = String(val).trim();
  if (!str || str === "-") return 0;
  return Number(str.replace(/[^0-9.-]+/g, "")) || 0;
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getValue(normalized, names) {
  const normalizedNames = names.map(normalizeKey);
  for (const name of names) {
    const value = normalized.get(normalizeKey(name));
    if (value !== undefined && String(value).trim() !== "") return value;
  }
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

function parseCSV(csvString, fileName) {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim() !== "");
  let headerRowIndex = 0;
  const headerIdentifiers = ["reportdate", "empid", "empname", "noofenrol", "profile", "account", "grandtotal"];
  
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

  const effectiveCSV = lines.slice(headerRowIndex).join("\n");
  const headerResults = Papa.parse(effectiveCSV, {
    header: true,
    skipEmptyLines: true,
  });

  const fields = headerResults.meta.fields || [];
  const normalizedFields = fields.map(normalizeKey);

  let source = "enrollment";
  if (normalizedFields.some(f => f.includes("overdue") || f.includes("pending") || f.includes("due"))) {
    source = "dueCollection";
  }

  const enrolmentColCount = normalizedFields.filter(f => f.startsWith("noofenrollment") || f.startsWith("noofenrolment")).length;
  const hasGrandTotal = normalizedFields.some(f => f.includes("grandtotal"));
  const fullNameStr = (fileName + " " + csvString).toLowerCase();
  const isReEnrolFile = fullNameStr.includes("re-enrollment") || fullNameStr.includes("re-enrolment") || (enrolmentColCount > 1 && hasGrandTotal);

  console.log(`File: ${fileName}, Detected Source: ${source}, IsReEnrolFile: ${isReEnrolFile}, Rows: ${headerResults.data.length}`);

  let totalEnrolCount = 0;
  let totalReEnrolCount = 0;

  headerResults.data.forEach(row => {
    const normalized = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]));
    
    if (source === "dueCollection") {
        // ...
    } else {
        const rawEnrolCount = cleanNum(getValue(normalized, ["No Of Enrollment", "No.of Enrolment", "Total", "Count", "INST_RECEIVED"]));
        const typeStr = (getValue(normalized, ["Is Re-Enrolment", "Type", "Scheme Nature", "SCHEME_NATURE"]) || "").toLowerCase();
        const isReEnrolRow = typeStr.includes("re") || typeStr.includes("renew") || isReEnrolFile;
        
        if (isReEnrolRow) {
            totalReEnrolCount += 1; // USER REQUEST: Row count = 53
        } else {
            totalEnrolCount += 1; // USER REQUEST: Row count = 372
        }
    }
  });

  console.log(`  EnrolCount: ${totalEnrolCount}, ReEnrolCount: ${totalReEnrolCount}`);
}

const files = [
  "Staff wise Enrollment report.csv",
  "Staff wise Re-Enrollment report.csv",
  "Staff wise Due Consolidate report.csv"
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    parseCSV(fs.readFileSync(f, 'utf8'), f);
  } else {
    console.log(`File not found: ${f}`);
  }
});
