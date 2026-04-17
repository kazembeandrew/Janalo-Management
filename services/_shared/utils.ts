import { ServiceError, ServiceResult } from './types';

/**
 * Utility function to map various error types to a consistent ServiceError format
 */
export function mapError(error: unknown, fallbackMessage: string): ServiceError {
  if (error instanceof Error && error.message) {
    return { message: error.message };
  }
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = 'message' in error ? error.message : undefined;
    const maybeCode = 'code' in error ? error.code : undefined;
    const maybeDetails = 'details' in error ? error.details : undefined;

    return {
      message: typeof maybeMessage === 'string' && maybeMessage.length > 0 ? maybeMessage : fallbackMessage,
      code: typeof maybeCode === 'string' ? maybeCode : undefined,
      details: typeof maybeDetails === 'string' ? maybeDetails : undefined,
    };
  }

  if (typeof error === 'string' && error.length > 0) {
    return { message: error };
  }

  return { message: fallbackMessage };
}

/**
 * Utility function to create a consistent success result
 */
export function createSuccessResult<T>(data: T): ServiceResult<T> {
  return { data, error: null, success: true };
}

/**
 * Utility function to create a consistent error result
 */
export function createErrorResult<T>(message: string, code?: string, details?: string): ServiceResult<T> {
  return {
    data: null,
    error: { message, code, details },
    success: false
  };
}

/**
 * Utility function to handle async operations with consistent error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  fallbackMessage: string
): Promise<ServiceResult<T>> {
  try {
    const data = await operation();
    return createSuccessResult(data);
  } catch (error) {
    const serviceError = mapError(error, fallbackMessage);
    return createErrorResult<T>(serviceError.message, serviceError.code, serviceError.details);
  }
}

/**
 * Utility function to validate required fields
 */
export function validateRequiredFields(fields: Record<string, any>, fieldNames: string[]): string[] {
  const missing: string[] = [];
  
  for (const fieldName of fieldNames) {
    if (!fields[fieldName] || (typeof fields[fieldName] === 'string' && fields[fieldName].trim() === '')) {
      missing.push(fieldName);
    }
  }
  
  return missing;
}

/**
 * Utility function to debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Utility function to format currency consistently
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Utility function to generate unique IDs
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Utility function to check if a value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Utility function to deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Utility function to compare two objects deeply
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Utility function to get nested object property safely
 */
export function getNestedProperty(obj: any, path: string, defaultValue?: any): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
}

/**
 * Utility function to format dates consistently
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Utility function to format datetime consistently
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Utility function to capitalize first letter of a string
 */
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Utility function to generate auto reference numbers
 */
export function generateAutoReference(prefix: string = 'REF'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Utility function to validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Utility function to validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Utility function to validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility function to sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
}

/**
 * Utility function to truncate text
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Utility function to get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Utility function to format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Utility function to check if a date is within a range
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Utility function to get the difference between two dates in days
 */
export function getDateDifferenceInDays(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Utility function to add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Utility function to get the start of the day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Utility function to get the end of the day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Utility function to check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Utility function to check if a date is yesterday
 */
export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

/**
 * Utility function to check if a date is within the last 7 days
 */
export function isWithinLast7Days(date: Date): boolean {
  const today = new Date();
  const last7Days = new Date();
  last7Days.setDate(today.getDate() - 7);
  return date >= last7Days && date <= today;
}

/**
 * Utility function to check if a date is within the last 30 days
 */
export function isWithinLast30Days(date: Date): boolean {
  const today = new Date();
  const last30Days = new Date();
  last30Days.setDate(today.getDate() - 30);
  return date >= last30Days && date <= today;
}

/**
 * Utility function to get the month name from a date
 */
export function getMonthName(date: Date): string {
  return date.toLocaleString('default', { month: 'long' });
}

/**
 * Utility function to get the day name from a date
 */
export function getDayName(date: Date): string {
  return date.toLocaleString('default', { weekday: 'long' });
}

/**
 * Utility function to get the current month and year
 */
export function getCurrentMonthYear(): string {
  const date = new Date();
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Utility function to get the previous month and year
 */
export function getPreviousMonthYear(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Utility function to get the next month and year
 */
export function getNextMonthYear(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Utility function to get the financial year from a date
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Assuming financial year starts in July (month 6)
  if (month >= 6) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Utility function to get the quarter from a date
 */
export function getQuarter(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

/**
 * Utility function to get the week number from a date
 */
export function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Utility function to get the age from a date of birth
 */
export function getAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Utility function to check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Utility function to get the number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Utility function to get the number of days in a year
 */
export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Utility function to get the start of the month
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Utility function to get the end of the month
 */
export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Utility function to get the start of the year
 */
export function startOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0, 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Utility function to get the end of the year
 */
export function endOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(11, 31);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Utility function to get the start of the week
 */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Utility function to get the end of the week
 */
export function endOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? 0 : 7);
  result.setDate(diff);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Utility function to format a number with commas
 */
export function formatNumberWithCommas(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Utility function to round a number to a specific number of decimal places
 */
export function roundNumber(num: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(num * factor) / factor;
}

/**
 * Utility function to calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return roundNumber((value / total) * 100, 2);
}

/**
 * Utility function to calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return roundNumber(((newValue - oldValue) / oldValue) * 100, 2);
}

/**
 * Utility function to calculate compound interest
 */
export function calculateCompoundInterest(principal: number, rate: number, time: number, compoundsPerYear: number = 1): number {
  return principal * Math.pow(1 + (rate / compoundsPerYear), compoundsPerYear * time);
}

/**
 * Utility function to calculate simple interest
 */
export function calculateSimpleInterest(principal: number, rate: number, time: number): number {
  return principal * rate * time;
}

/**
 * Utility function to calculate EMI (Equated Monthly Installment)
 * @param monthlyRatePct - The monthly interest rate in percentage (e.g. 3 for 3%)
 */
export function calculateEMI(principal: number, monthlyRatePct: number, tenureMonths: number): number {
  if (monthlyRatePct === 0) return principal / tenureMonths;
  const monthlyRate = monthlyRatePct / 100;
  return principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
}

/**
 * Utility function to calculate loan amortization schedule
 * @param monthlyRatePct - The monthly interest rate in percentage (e.g. 3 for 3%)
 */
export function calculateAmortizationSchedule(principal: number, monthlyRatePct: number, tenureMonths: number): Array<{
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}> {
  const monthlyRate = monthlyRatePct / 100;
  const monthlyPayment = calculateEMI(principal, monthlyRatePct, tenureMonths);
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths; month++) {
    const interest = balance * monthlyRate;
    const principalPayment = monthlyPayment - interest;
    balance -= principalPayment;

    schedule.push({
      month,
      payment: roundNumber(monthlyPayment, 2),
      principal: roundNumber(principalPayment, 2),
      interest: roundNumber(interest, 2),
      balance: roundNumber(Math.max(0, balance), 2)
    });
  }

  return schedule;
}

/**
 * Utility function to generate a random color
 */
export function generateRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

/**
 * Utility function to generate a random string
 */
export function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Utility function to generate a random number within a range
 */
export function generateRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Utility function to shuffle an array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Utility function to get unique values from an array
 */
export function getUniqueValues<T>(array: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  
  for (const item of array) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Utility function to group array items by a key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Utility function to sort array by a key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Utility function to filter array by a predicate
 */
export function filterBy<T>(array: T[], predicate: (item: T) => boolean): T[] {
  return array.filter(predicate);
}

/**
 * Utility function to find an item in an array by a key
 */
export function findBy<T>(array: T[], key: keyof T, value: any): T | undefined {
  return array.find(item => item[key] === value);
}

/**
 * Utility function to remove an item from an array by a key
 */
export function removeBy<T>(array: T[], key: keyof T, value: any): T[] {
  return array.filter(item => item[key] !== value);
}

/**
 * Utility function to update an item in an array by a key
 */
export function updateBy<T extends Record<string, any>>(
  array: T[], 
  key: keyof T, 
  value: any, 
  updates: Partial<T>
): T[] {
  return array.map(item => 
    item[key] === value ? { ...item, ...updates } : item
  );
}

/**
 * Utility function to add an item to an array if it doesn't exist
 */
export function addIfNotExists<T>(array: T[], item: T, key: keyof T): T[] {
  if (!array.find(existing => existing[key] === item[key])) {
    return [...array, item];
  }
  return array;
}

/**
 * Utility function to toggle an item in an array
 */
export function toggleItem<T>(array: T[], item: T): T[] {
  const index = array.indexOf(item);
  if (index === -1) {
    return [...array, item];
  } else {
    const result = [...array];
    result.splice(index, 1);
    return result;
  }
}

/**
 * Utility function to chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Utility function to flatten a nested array
 */
export function flattenArray<T>(array: (T | T[])[]): T[] {
  return array.reduce<T[]>((acc, item) => {
    return acc.concat(Array.isArray(item) ? item : [item]);
  }, []);
}

/**
 * Utility function to debounce with immediate execution
 */
export function debounceImmediate<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const callNow = immediate && !timeout;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func(...args);
    }, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Utility function to throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Utility function to create a memoized function
 */
export function memoize<T extends (...args: any[]) => any>(func: T): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Utility function to create a retry wrapper for async functions
 */
export function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= retries) {
            reject(error);
          } else {
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a timeout wrapper for async functions
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms`));
    }, ms);
    
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

/**
 * Utility function to create a race between multiple promises
 */
export function racePromises<T>(promises: Promise<T>[]): Promise<T> {
  return Promise.race(promises);
}

/**
 * Utility function to create a sequence of promises
 */
export function sequencePromises<T>(promises: Promise<T>[]): Promise<T[]> {
  return promises.reduce(
    (chain, promise) => chain.then((results) => 
      promise.then((result) => [...results, result])
    ),
    Promise.resolve([] as T[])
  );
}

/**
 * Utility function to create a parallel execution of promises with concurrency limit
 */
export function parallelPromises<T>(
  promises: Promise<T>[],
  concurrency: number = Infinity
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    let completed = 0;
    let currentIndex = 0;
    
    const executeNext = () => {
      if (currentIndex >= promises.length) {
        if (completed === promises.length) {
          resolve(results);
        }
        return;
      }
      
      const index = currentIndex++;
      const promise = promises[index];
      
      promise
        .then((result) => {
          results[index] = result;
          completed++;
          executeNext();
        })
        .catch(reject);
    };
    
    const initialConcurrency = Math.min(concurrency, promises.length);
    for (let i = 0; i < initialConcurrency; i++) {
      executeNext();
    }
  });
}

/**
 * Utility function to create a lazy loader
 */
export function createLazyLoader<T>(
  loader: () => Promise<T>
): () => Promise<T> {
  let cached: Promise<T> | null = null;
  
  return () => {
    if (!cached) {
      cached = loader();
    }
    return cached;
  };
}

/**
 * Utility function to create a singleton instance
 */
export function createSingleton<T>(constructor: new (...args: any[]) => T): () => T {
  let instance: T | null = null;
  
  return (...args: any[]) => {
    if (!instance) {
      instance = new constructor(...args);
    }
    return instance;
  };
}

/**
 * Utility function to create a factory function
 */
export function createFactory<T>(
  constructor: new (...args: any[]) => T
): (...args: any[]) => T {
  return (...args: any[]) => new constructor(...args);
}

/**
 * Utility function to create a proxy for debugging
 */
export function createDebugProxy<T extends object>(
  target: T,
  name: string = 'DebugProxy'
): T {
  return new Proxy(target, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver);
    },
    deleteProperty(target, prop) {
      return Reflect.deleteProperty(target, prop);
    }
  });
}

/**
 * Utility function to create a validator for objects
 */
export function createValidator<T>(
  schema: Record<keyof T, (value: any) => boolean>
): (obj: Partial<T>) => { valid: boolean; errors: string[] } {
  return (obj) => {
    const errors: string[] = [];
    
    for (const [key, validator] of Object.entries(schema)) {
      if (typeof validator === 'function' && !validator(obj[key as keyof T])) {
        errors.push(`Invalid value for ${key}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  };
}

/**
 * Utility function to create a type guard
 */
export function createTypeGuard<T>(
  validator: (obj: any) => obj is T
): (obj: any) => obj is T {
  return validator;
}

/**
 * Utility function to create a deep freeze for objects
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (obj && obj[prop] && typeof obj[prop] === 'object') {
        deepFreeze(obj[prop]);
      }
    });
    Object.freeze(obj);
  }
  return obj as Readonly<T>;
}

/**
 * Utility function to create a deep seal for objects
 */
export function deepSeal<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isSealed(obj)) {
    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (obj && obj[prop] && typeof obj[prop] === 'object') {
        deepSeal(obj[prop]);
      }
    });
    Object.seal(obj);
  }
  return obj;
}

/**
 * Utility function to create a deep prevent extensions for objects
 */
export function deepPreventExtensions<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isExtensible(obj)) {
    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (obj && obj[prop] && typeof obj[prop] === 'object') {
        deepPreventExtensions(obj[prop]);
      }
    });
    Object.preventExtensions(obj);
  }
  return obj;
}

/**
 * Utility function to create a curry function
 */
export function curry<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  return function curried(...args: Parameters<T>) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    } else {
      return (...nextArgs: any[]) => curried.apply(this, args.concat(nextArgs));
    }
  } as any;
}

/**
 * Utility function to create a compose function
 */
export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
}

/**
 * Utility function to create a pipe function
 */
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

/**
 * Utility function to create a partial application
 */
export function partial<T extends (...args: any[]) => any>(
  fn: T,
  ...presetArgs: Parameters<T>
): (...args: any[]) => ReturnType<T> {
  return (...args: any[]) => fn(...presetArgs, ...args);
}

/**
 * Utility function to create a once function
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;
  
  return ((...args: Parameters<T>) => {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  }) as T;
}

/**
 * Utility function to create a after function
 */
export function after<T extends (...args: any[]) => any>(
  count: number,
  fn: T
): T {
  let counter = count;
  
  return ((...args: Parameters<T>) => {
    if (--counter <= 0) {
      return fn.apply(this, args);
    }
  }) as T;
}

/**
 * Utility function to create a before function
 */
export function before<T extends (...args: any[]) => any>(
  count: number,
  fn: T
): T {
  let counter = count;
  
  return ((...args: Parameters<T>) => {
    if (--counter >= 0) {
      return fn.apply(this, args);
    }
  }) as T;
}

/**
 * Utility function to create a wrap function
 */
export function wrap<T extends (...args: any[]) => any>(
  fn: T,
  wrapper: (fn: T, ...args: Parameters<T>) => ReturnType<T>
): T {
  return ((...args: Parameters<T>) => wrapper(fn, ...args)) as T;
}

/**
 * Utility function to create a memoize with TTL
 */
export function memoizeWithTTL<T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 60000
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const now = Date.now();
    
    if (cache.has(key)) {
      const entry = cache.get(key)!;
      if (now - entry.timestamp < ttl) {
        return entry.value;
      } else {
        cache.delete(key);
      }
    }
    
    const result = fn(...args);
    cache.set(key, { value: result, timestamp: now });
    return result;
  }) as T;
}

/**
 * Utility function to create a rate limiter
 */
export function createRateLimiter<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  maxCalls: number,
  windowMs: number
): T {
  const calls: number[] = [];
  
  return (async (...args: Parameters<T>) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Remove old calls outside the window
    while (calls.length > 0 && calls[0] < windowStart) {
      calls.shift();
    }
    
    // Check if we've exceeded the limit
    if (calls.length >= maxCalls) {
      throw new Error(`Rate limit exceeded. Maximum ${maxCalls} calls per ${windowMs}ms.`);
    }
    
    // Record this call
    calls.push(now);
    
    // Execute the function
    return fn(...args);
  }) as T;
}

/**
 * Utility function to create a circuit breaker
 */
export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  failureThreshold: number = 5,
  recoveryTimeout: number = 60000
): T {
  let failures = 0;
  let lastFailureTime = 0;
  let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  return (async (...args: Parameters<T>) => {
    const now = Date.now();
    
    // Check if we should try to recover
    if (state === 'OPEN' && now - lastFailureTime > recoveryTimeout) {
      state = 'HALF_OPEN';
    }
    
    // If circuit is open, fail fast
    if (state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }
    
    try {
      const result = await fn(...args);
      
      // Reset failures on success
      if (state === 'HALF_OPEN') {
        failures = 0;
        state = 'CLOSED';
      }
      
      return result;
    } catch (error) {
      failures++;
      lastFailureTime = now;
      
      // Open the circuit if threshold is reached
      if (failures >= failureThreshold) {
        state = 'OPEN';
      }
      
      throw error;
    }
  }) as T;
}

/**
 * Utility function to create a retry with exponential backoff
 */
export function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries) {
            reject(error);
          } else {
            const delay = Math.min(baseDelay * Math.pow(2, count), maxDelay);
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a timeout with exponential backoff
 */
export function withTimeoutExponentialBackoff<T>(
  promise: Promise<T>,
  initialTimeout: number = 1000,
  maxTimeout: number = 30000,
  backoffFactor: number = 2
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeout = initialTimeout;
    let attempts = 0;
    
    const attempt = () => {
      const timeoutId = setTimeout(() => {
        attempts++;
        timeout = Math.min(timeout * backoffFactor, maxTimeout);
        
        if (attempts >= 5) {
          reject(new Error(`Timeout after ${attempts} attempts`));
        } else {
          attempt();
        }
      }, timeout);
      
      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    };
    
    attempt();
  });
}

/**
 * Utility function to create a retry with jitter
 */
export function withJitterRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries) {
            reject(error);
          } else {
            const delay = Math.min(baseDelay * Math.pow(2, count), maxDelay);
            const jitter = Math.random() * 0.1 * delay; // 10% jitter
            setTimeout(() => attempt(count + 1), delay + jitter);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with fixed delay
 */
export function withFixedDelayRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries) {
            reject(error);
          } else {
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with linear backoff
 */
export function withLinearBackoffRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries) {
            reject(error);
          } else {
            const delay = Math.min(baseDelay + (count * 1000), maxDelay);
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with fibonacci backoff
 */
export function withFibonacciBackoffRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number, prevDelay: number = 0) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries) {
            reject(error);
          } else {
            const delay = Math.min(baseDelay + prevDelay, maxDelay);
            setTimeout(() => attempt(count + 1, baseDelay), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with custom backoff strategy
 */
export function withCustomBackoffRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  backoffStrategy: (attempt: number) => number = (attempt) => Math.pow(2, attempt) * 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries) {
            reject(error);
          } else {
            const delay = backoffStrategy(count);
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with custom retry condition
 */
export function withConditionalRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any, attempt: number) => boolean,
  maxRetries: number = 5,
  delay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries || !shouldRetry(error, count)) {
            reject(error);
          } else {
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with custom retry condition and backoff
 */
export function withConditionalBackoffRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any, attempt: number) => boolean,
  backoffStrategy: (attempt: number) => number,
  maxRetries: number = 5
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries || !shouldRetry(error, count)) {
            reject(error);
          } else {
            const delay = backoffStrategy(count);
            setTimeout(() => attempt(count + 1), delay);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with custom retry condition, backoff, and jitter
 */
export function withConditionalJitterRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any, attempt: number) => boolean,
  backoffStrategy: (attempt: number) => number,
  jitterFactor: number = 0.1,
  maxRetries: number = 5
): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (count: number) => {
      fn()
        .then(resolve)
        .catch((error) => {
          if (count >= maxRetries || !shouldRetry(error, count)) {
            reject(error);
          } else {
            const delay = backoffStrategy(count);
            const jitter = Math.random() * jitterFactor * delay;
            setTimeout(() => attempt(count + 1), delay + jitter);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with custom retry condition, backoff, jitter, and timeout
 */
export function withConditionalJitterTimeoutRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any, attempt: number) => boolean,
  backoffStrategy: (attempt: number) => number,
  jitterFactor: number = 0.1,
  timeout: number = 30000,
  maxRetries: number = 5
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);
    
    const attempt = (count: number) => {
      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          if (count >= maxRetries || !shouldRetry(error, count)) {
            clearTimeout(timeoutId);
            reject(error);
          } else {
            const delay = backoffStrategy(count);
            const jitter = Math.random() * jitterFactor * delay;
            setTimeout(() => attempt(count + 1), delay + jitter);
          }
        });
    };
    
    attempt(0);
  });
}

/**
 * Utility function to create a retry with custom retry condition, backoff, jitter, timeout, and circuit breaker
 */
export function withConditionalJitterTimeoutCircuitBreakerRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any, attempt: number) => boolean,
  backoffStrategy: (attempt: number) => number,
  jitterFactor: number = 0.1,
  timeout: number = 30000,
  failureThreshold: number = 5,
  recoveryTimeout: number = 60000,
  maxRetries: number = 5
): Promise<T> {
  let failures = 0;
  let lastFailureTime = 0;
  let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);
    
    const attempt = (count: number) => {
      const now = Date.now();
      
      // Check if we should try to recover
      if (state === 'OPEN' && now - lastFailureTime > recoveryTimeout) {
        state = 'HALF_OPEN';
      }
      
      // If circuit is open, fail fast
      if (state === 'OPEN') {
        clearTimeout(timeoutId);
        reject(new Error('Circuit breaker is OPEN'));
      }
      
      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          
          // Reset failures on success
          if (state === 'HALF_OPEN') {
            failures = 0;
            state = 'CLOSED';
          }
          
          resolve(result);
        })
        .catch((error) => {
          if (count >= maxRetries || !shouldRetry(error, count)) {
            clearTimeout(timeoutId);
            reject(error);
          } else {
            failures++;
            lastFailureTime = now;
            
            // Open the circuit if threshold is reached
            if (failures >= failureThreshold) {
              state = 'OPEN';
            }
            
            const delay = backoffStrategy(count);
            const jitter = Math.random() * jitterFactor * delay;
            setTimeout(() => attempt(count + 1), delay + jitter);
          }
        });
    };
    
    attempt(0);
  });
}