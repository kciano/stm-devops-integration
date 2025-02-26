import { NextResponse } from 'next/server';
import axios from 'axios';
import { SigningTask } from '@/types';

export async function POST(request: Request) {
  try {
    const { apiKey, task }: { apiKey: string; task: SigningTask } = await request.json();

    const response = await axios.post(
      'https://one.digicert.com/signingmanager/api/v1/sign',
      task,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    return NextResponse.json({ success: true, data: response.data });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.response?.data?.message || 'Failed to sign files'
      },
      { status: error.response?.status || 500 }
    );
  }
} 