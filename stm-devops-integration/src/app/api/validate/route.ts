import { NextResponse } from 'next/server';
import axios from 'axios';

const STM_HOST = 'https://clientauth.one.digicert.com';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    console.log('Validating API key...');
    const response = await axios.get(`${STM_HOST}/signingmanager/api/v1/keys`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('Validation response:', {
      status: response.status,
      data: response.data
    });

    return NextResponse.json({ success: true, data: response.status === 200 });
  } catch (error: any) {
    console.error('Validation error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to validate API key'
      },
      { status: error.response?.status || 500 }
    );
  }
} 