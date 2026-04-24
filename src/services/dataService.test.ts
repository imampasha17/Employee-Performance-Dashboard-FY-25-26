import { describe, it, expect } from 'vitest';
import { parseCSVFiles, normalizeSchemeName, getStatsByLocation } from './dataService';

describe('dataService', () => {
  describe('normalizeSchemeName', () => {
    it('normalizes 11+1 variations', () => {
      expect(normalizeSchemeName('11+1')).toBe('11+1');
      expect(normalizeSchemeName('11plus1')).toBe('11+1');
      expect(normalizeSchemeName('11 + 1')).toBe('11+1');
    });

    it('normalizes Rate Shield variations', () => {
      expect(normalizeSchemeName('RATE_SHIELD')).toBe('Rate_Shield');
      expect(normalizeSchemeName('rate shield')).toBe('Rate_Shield');
    });
  });

  describe('parseCSVFiles', () => {
    it('correctly maps missing locations for Re-Enrollment (Staff Report) using Employee Code', () => {
      const mockCsvContent = `
Emp Code,Customer Name,Location,INSTALLMENT_AMOUNT,Type
EMP001,John Doe,Hyderabad,1000,Enrollment
      `.trim();
      
      const mockReEnrolmentContent = `
Emp ID,Emp Name,No Of Enrollment,Inst Amount
EMP001,John Doe,1,500
      `.trim();

      const files = [
        { name: 'Staff wise Enrollment report.csv', content: mockCsvContent },
        { name: 'Staff wise Re-Enrollment report.csv', content: mockReEnrolmentContent }
      ];

      const result = parseCSVFiles(files);
      
      // Should have 2 records
      expect(result.length).toBe(2);

      // Enrollment record
      const enrolRow = result.find(r => r.source === 'enrollment');
      expect(enrolRow?.location).toBe('Hyderabad');
      expect(enrolRow?.enrolmentValue).toBe(1000);

      // Re-enrollment record
      const reEnrolRow = result.find(r => r.source === 're-enrollment' || (r.reEnrolmentCount && r.reEnrolmentCount > 0));
      expect(reEnrolRow?.reEnrolmentValue).toBe(500);
      
      // Crucial part: It should have adopted the location from the first file!
      expect(reEnrolRow?.location).toBe('Hyderabad');
    });
  });
  
  describe('getStatsByLocation', () => {
    it('correctly aggregates location data', () => {
       const mockData = [
         { location: 'Hyderabad', enrolmentValue: 1000, totalDue: 500, reEnrolmentValue: 200 },
         { location: 'Hyderabad', enrolmentValue: 500, totalDue: 100, reEnrolmentValue: 0 },
         { location: 'Bangalore', enrolmentValue: 2000, totalDue: 0, reEnrolmentValue: 500 },
       ] as any[];
       
       const stats = getStatsByLocation(mockData);
       expect(stats.length).toBe(2);
       
       const hyd = stats.find(s => s.location === 'Hyderabad');
       expect(hyd?.enrolmentValue).toBe(1500);
       expect(hyd?.totalDue).toBe(600);
       
       const blr = stats.find(s => s.location === 'Bangalore');
       expect(blr?.enrolmentValue).toBe(2000);
       expect(blr?.reEnrolmentCount).toBeDefined();
    });
  });
});
