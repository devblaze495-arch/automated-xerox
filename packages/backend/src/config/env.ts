import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables from .env
config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('postgresql://postgres:blaze@localhost:5432/campus_print_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AGENT_SECRET: z.string().default('campus_secret_key_123'),
  UPLOAD_STORAGE_DIR: z.string().default('./uploads'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET_NAME: z.string().default('campus-print-documents'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_campus123'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_mock_xyz'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_mock'),
  UPI_GATEWAY_URL: z.string().default('http://localhost:8000'),
  UPI_GATEWAY_API_KEY: z.string().default('upi_key_campus_test'),
  UPI_GATEWAY_API_SECRET: z.string().default('upi_secret_campus_test'),
  UPI_GATEWAY_WEBHOOK_SECRET: z.string().default('upi_webhook_secret_test'),
  NOTIFY_PROVIDER: z.enum(['fast2sms', 'whatsapp_cloud', 'console']).default('console'),
  FAST2SMS_API_KEY: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  ADMIN_SECRET: z.string().default('super_campus_admin_2026'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  UPLOAD_STORAGE_ABSOLUTE: path.resolve(process.cwd(), parsed.data.UPLOAD_STORAGE_DIR),
};

