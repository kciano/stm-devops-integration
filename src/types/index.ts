export interface SigningTask {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Keypair {
  id: string;
  alias: string;
  key_type: string;
  key_alg: string;
  key_size: number;
}

export interface PipelineVariables {
  clientCertPassword: string;
  selectedKeypairAlias: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AzureDevOpsCredentials {
  pat: string;
  organization: string;
  project: string;
}

export interface FileUploadState {
  file: File | null;
  isUploading: boolean;
  error: string | null;
  success: boolean;
  fileName: string;
}

export interface PipelineConfig {
  id: number;
  name: string;
  repositoryId?: string;
  filePath: string;
  branch: string;
}

export interface PipelineUpdateState {
  selectedPipeline: PipelineConfig | null;
  isLoading: boolean;
  error: string | null;
  success: boolean;
  yamlContent: string;
} 