import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  // Em produção, valide a assinatura do webhook e atualize o pedido no Supabase.
  // Não deixe pedidos como pagos sem consultar a API do Mercado Pago pelo payment_id.
  console.log('Webhook Mercado Pago TRIDRA:', payload);
  return NextResponse.json({ received: true });
}
