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
  RAZORPAY_KEY_ID: z.string().default('rzp_test_campus123'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_mock_xyz'),
  RAZORPAY_WEBHOOK_SECRET: z.string().default('rzp_webhook_secret_mock'),
  UPI_GATEWAY_URL: z.string().default('http://localhost:8000'),
  UPI_GATEWAY_API_KEY: z.string().default('upi_key_campus_test'),
  UPI_GATEWAY_API_SECRET: z.string().default('upi_secret_campus_test'),
  UPI_GATEWAY_WEBHOOK_SECRET: z.string().default('upi_webhook_secret_test'),
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

