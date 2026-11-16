import { z } from 'zod';

export function normalizeUsPhoneNumber(value) {
  const input = String(value || '').trim();
  if (/[a-z]/i.test(input) || /(?:ext\.?|x)\s*\d+/i.test(input)) {
    throw new Error('Enter a valid US phone number.');
  }

  const digits = input.replace(/\D/g, '');
  const nationalNumber =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nationalNumber)) {
    throw new Error('Enter a valid US phone number.');
  }

  return `+1${nationalNumber}`;
}

export const fullNameSchema = z
  .string()
  .trim()
  .max(160)
  .refine(
    (value) => value.split(/\s+/).filter(Boolean).length >= 2,
    'Enter your first and last name.',
  );

export const receiptEmailSchema = z
  .string()
  .trim()
  .email('Enter a valid receipt email.')
  .max(320)
  .transform((value) => value.toLowerCase());

export const bookingContactSchema = z
  .object({
    fullName: fullNameSchema,
    receiptEmail: receiptEmailSchema,
    mobileNumber: z.string().transform(normalizeUsPhoneNumber),
    version: z.number().int().nonnegative(),
  })
  .strict();
