import { NextResponse } from 'next/server';
import axios from 'axios';

const STM_HOST = 'https://clientauth.one.digicert.com';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    console.log('Fetching keypairs from STM...');
    const response = await axios.get(`${STM_HOST}/signingmanager/api/v1/keypairs`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('Keypairs response:', {
      status: response.status,
      data: response.data
    });

    // Check if the response has the expected paginated format
    if (response.data && Array.isArray(response.data.items)) {
      return NextResponse.json({ 
        success: true, 
        data: response.data.items 
      });
    } else {
      console.error('Unexpected response format:', response.data);
      return NextResponse.json({ 
        success: false, 
        error: 'Unexpected response format from STM API' 
      });
    }
  } catch (error: any) {
    console.error('Error fetching keypairs:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to fetch keypairs'
      },
      { status: error.response?.status || 500 }
    );
  }
} 