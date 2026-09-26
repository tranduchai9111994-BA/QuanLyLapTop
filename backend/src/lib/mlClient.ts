import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8001';
const ML_INTERNAL_KEY = process.env.ML_INTERNAL_KEY ?? '';

export const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 3000,
  headers: { 'X-Internal-Key': ML_INTERNAL_KEY },
});

export class MlServiceError extends Error {}
