export interface STMConfig {
  apiKey: string;
  baseUrl: string;
}

export interface SigningOptions {
  timestamp: boolean;
  hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

export interface SigningTask {
  files: string[];
  options: SigningOptions;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Keypair {
  id: string;
  alias: string;
  key_size: number;
  key_alg: string;
  key_type: string;
  key_storage: string;
  public_key: string;
  certificates?: {
    id: string;
    alias: string;
    cert: string;
    certificate_fingerprint: string;
    certificate_status: string;
  }[];
}

export interface PipelineVariables {
  clientCertPassword: string;
  selectedKeypairAlias: string;
} 