export interface ProcessedData {
  id?: string;
  source?: 'enrollment' | 'dueCollection' | 'legacy';
  locationCode?: string;
  location: string;
  employeeCode: string;
  employeeName: string;
  joiningDate?: string;
  orderNo?: string;
  profileNo?: string;
  customerName?: string;
  schemeType: string;
  schemeStatus?: string;
  installmentAmount?: number;
  expectedInstAmount?: number;
  currentReceivedAmount?: number;
  totalDue?: number;
  paidCustomerCount?: number;
  collectionReceivedValue?: number;
  collectionPercent?: number;
  paymentAgainstOverdueValue?: number;
  currentDueCollectionValue?: number;
  schemeDiscount?: number;
  enrolmentCount: number;
  enrolmentValue: number;
  overdueCount: number;
  overdueValue: number;
  odCollectionCount: number;
  odCollectionValue: number;
  currentDueCount: number;
  currentDueValue: number;
  cdCollectionCount: number;
  cdCollectionValue: number;
  forclosedCount: number;
  forclosedValue: number;
  redemptionActual: number;
  redemptionPending: number;
  reEnrolmentCount: number;
  reEnrolmentValue: number;
  upSaleCount: number;
  upSaleValue: number;
  reportMonth?: string;
  reportDate?: string; // For sorting and exact filtering
}

export interface EmployeeStat {
  employeeCode: string;
  employeeName: string;
  location: string;
  totalCount: number;
  totalAmount: number;
  // Scheme specific counts
  schemes: {
    count11Plus1: number;
    count11Plus2: number;
    countGpRateShield: number;
    countOnePay: number;
  };
  // New metrics
  totalOverdue: number;
  totalCollection: number;
  totalForclosed: number;
  totalDue: number;
  reEnrolmentCount: number;
  reEnrolmentValue: number;
  enrolmentCustomerCount: number;
  collectionCustomerCount: number;
  dueCustomerCount: number;
  installmentAmount: number;
  expectedInstAmount: number;
  currentReceivedAmount: number;
  overdueValue: number;
  currentDueValue: number;
  paymentAgainstOverdueValue: number;
  currentDueCollectionValue: number;
  collectionReceivedValue: number;
  forclosedValue: number;
  redemptionActual: number;
  redemptionPending: number;
  upSaleCount: number;
  upSaleValue: number;
  paidCustomerCount: number;
  collectionPercent: number;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name: string;
  accessibleLocations: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface LocationStats {
  location: string;
  totalCount: number;
  totalAmount: number;
  totalOverdue: number;
  totalCollection: number;
  employeeCount: number;
  enrolmentValue: number;
  totalDue: number;
  totalForclosed: number;
  reEnrolmentCount: number;
  upSaleCount: number;
  totalDueValue: number;
  overdueValue: number;
  currentDueValue: number;
  paymentAgainstOverdueValue: number;
  currentDueCollectionValue: number;
  collectionReceivedValue: number;
  forclosedValue: number;
}