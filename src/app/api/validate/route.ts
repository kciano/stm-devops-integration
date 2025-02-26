import { NextResponse } from 'next/server';
import axios from 'axios';

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

    // Validate the API key by making a request to STM API
    const response = await axios.get(`${STM_HOST}/signingmanager/api/v1/keypairs`, {
      headers: {
        'X-API-KEY': apiKey,
      },
    });

    if (response.status === 200) {
      return NextResponse.json({ success: true, data: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('API validation error:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Invalid API key' },
      { status: 401 }
    );
  }
} 