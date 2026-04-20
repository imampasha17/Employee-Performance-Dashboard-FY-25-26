
import fs from 'fs';
import { parseCSVFiles } from './src/services/dataService';

const files = [
  { name: 'Staff wise Enrollment report.csv', path: './Staff wise Enrollment report.csv' },
  { name: 'Staff wise Re-Enrollment report.csv', path: './Staff wise Re-Enrollment report.csv' },
  { name: 'Staff wise Due Consolidate report.csv', path: './Staff wise Due Consolidate report.csv' }
];

const fileContents = files.map(f => ({
  name: f.name,
  content: fs.readFileSync(f.path, 'utf-8')
}));

console.log("Parsing files...");
const processed = parseCSVFiles(fileContents);

console.log("Total Processed Rows:", processed.length);

const enrollmentCount = processed.reduce((acc, d) => acc + (d.enrolmentCount || 0), 0);
const reEnrolmentCount = processed.reduce((acc, d) => acc + (d.reEnrolmentCount || 0), 0);
const totalCollected = processed.reduce((acc, d) => acc + (d.currentReceivedAmount || 0), 0);

console.log("Enrollment Count:", enrollmentCount);
console.log("Re-Enrollment Count:", reEnrolmentCount);
console.log("Total Collected:", totalCollected);

// Check new metrics
const overdueAmt = processed.reduce((acc, d) => acc + (d.overdueValue || 0), 0);
const currentDueAmt = processed.reduce((acc, d) => acc + (d.currentDueValue || 0), 0);
const foreclosedAmt = processed.reduce((acc, d) => acc + (d.forclosedValue || 0), 0);

console.log("Overdue Pending Amt:", overdueAmt);
console.log("Current Due Amt:", currentDueAmt);
console.log("Foreclosed Amount:", foreclosedAmt);
