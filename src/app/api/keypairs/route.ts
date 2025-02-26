import { NextResponse } from 'next/server';
import axios from 'axios';
import { Keypair } from '@/types';

const STM_HOST = 'https://one.digicert.com';

export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get('X-API-KEY');
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const response = await axios.get(`${STM_HOST}/signingmanager/api/v1/keypairs`, {
      headers: {
        'X-API-KEY': apiKey,
      },
    });

    // Handle paginated response
    if (response.data && Array.isArray(response.data.items)) {
      const keypairs: Keypair[] = response.data.items.map((keypair: any) => ({
        id: keypair.id,
        alias: keypair.alias,
        key_type: keypair.key_type,
        key_alg: keypair.key_alg,
        key_size: keypair.key_size,
      }));

      return NextResponse.json({ success: true, data: keypairs });
    } else {
      console.error('Unexpected response format:', response.data);
      return NextResponse.json(
        { success: false, error: 'Unexpected response format from STM API' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Failed to fetch keypairs:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch keypairs' },
      { status: 500 }
    );
  }
} 