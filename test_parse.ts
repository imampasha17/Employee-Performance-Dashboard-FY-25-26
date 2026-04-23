import fs from 'fs';
import { parseCSV } from './src/services/dataService';

const content = fs.readFileSync('Staff wise Re-Enrollment report.csv', 'utf8');
const data = parseCSV(content, 'Staff wise Re-Enrollment report.csv');

let totalReEnrolCount = 0;
let totalReEnrolValue = 0;

for (const item of data) {
  totalReEnrolCount += item.reEnrolmentCount || 0;
  totalReEnrolValue += item.reEnrolmentValue || 0;
}

console.log('Re-Enrollment Count:', totalReEnrolCount);
console.log('Re-Enrollment Value:', totalReEnrolValue);
console.log('Sample Row 1:', data[0]);
