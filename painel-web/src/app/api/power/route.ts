import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Controle de energia desativado temporariamente por segurança. Use apenas manutenção manual auditada.'
    },
    { status: 423 }
  );
}
