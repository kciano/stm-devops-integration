import axios, { AxiosInstance } from 'axios';
import { ApiResponse, Keypair } from '@/types';

interface STMApiConfig {
  apiKey: string;
  baseUrl: string;
}

export class STMApiService {
  private static instance: STMApiService;
  private client: AxiosInstance;

  private constructor(config: STMApiConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'X-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  public static getInstance(config: STMApiConfig): STMApiService {
    if (!STMApiService.instance) {
      STMApiService.instance = new STMApiService(config);
    }
    return STMApiService.instance;
  }

  public async validateApiKey(): Promise<ApiResponse<boolean>> {
    try {
      const response = await this.client.get('/api/validate');
      return response.data;
    } catch (error) {
      return { success: false, error: 'Invalid API key' };
    }
  }

  public async getKeypairs(): Promise<ApiResponse<Keypair[]>> {
    try {
      const response = await this.client.get('/api/keypairs');
      return response.data;
    } catch (error) {
      return { success: false, error: 'Failed to fetch keypairs' };
    }
  }
} 