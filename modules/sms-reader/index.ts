import { requireNativeModule } from 'expo-modules-core';

export interface RawSMS {
  _id: string;
  address: string;
  body: string;
  date: string;
}

export interface SmsDiagnostics {
  permissionGranted?: boolean;
  defaultSmsApp?: string | null;
  totalRows?: number | string;
  error?: string;
}

// No silent catches: if the native module isn't linked, this throws
// "Cannot find native module 'SmsReader'" and the UI shows it.
export async function listSms(minDate: number, maxCount: number): Promise<RawSMS[]> {
  const native = requireNativeModule('SmsReader');
  return await native.listSms(minDate, maxCount);
}

export async function diagnoseSms(): Promise<SmsDiagnostics> {
  const native = requireNativeModule('SmsReader');
  return await native.diagnose();
}