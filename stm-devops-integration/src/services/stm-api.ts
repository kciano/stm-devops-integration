import axios from 'axios';
import { STMConfig, SigningTask, APIResponse, Keypair } from '@/types';

export class STMApiService {
  private static instance: STMApiService;
  private apiKey: string;

  private constructor(config: STMConfig) {
    this.apiKey = config.apiKey;
  }

  public static getInstance(config: STMConfig): STMApiService {
    if (!STMApiService.instance) {
      STMApiService.instance = new STMApiService(config);
    }
    STMApiService.instance.apiKey = config.apiKey;
    return STMApiService.instance;
  }

  public async validateApiKey(): Promise<APIResponse<boolean>> {
    try {
      const response = await axios.post('/api/validate', {
        apiKey: this.apiKey
      });
      return response.data;
    } catch (error: any) {
      console.error('API key validation error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to validate API key'
      };
    }
  }

  public async getKeypairs(): Promise<APIResponse<Keypair[]>> {
    try {
      console.log('Requesting keypairs...');
      const response = await axios.post('/api/keypairs', {
        apiKey: this.apiKey
      });
      console.log('Keypairs response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error getting keypairs:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to fetch keypairs'
      };
    }
  }

  public async signFiles(task: SigningTask): Promise<APIResponse> {
    try {
      const response = await axios.post('/api/sign', {
        apiKey: this.apiKey,
        task
      });
      return response.data;
    } catch (error: any) {
      console.error('Signing error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to sign files'
      };
    }
  }
} 