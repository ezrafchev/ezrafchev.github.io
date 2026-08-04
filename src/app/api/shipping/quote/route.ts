import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const token = process.env.MELHOR_ENVIO_ACCESS_TOKEN;
  const api = process.env.MELHOR_ENVIO_API_URL || 'https://www.melhorenvio.com.br/api/v2';
  if (!token) return NextResponse.json({ error: 'MELHOR_ENVIO_ACCESS_TOKEN não configurado.' }, { status: 500 });

  const body = await request.json();
  const payload = {
    from: { postal_code: process.env.TRIDRA_ORIGIN_POSTAL_CODE },
    to: { postal_code: body.cep },
    products: [{ id: 'tridra', width: 15, height: 8, length: 20, weight: 0.3, insurance_value: 40, quantity: Number(body.quantidade || 1) }],
    options: { receipt: false, own_hand: false },
    services: '1,2,3,4'
  };

  const res = await fetch(`${api}/me/shipment/calculate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'TRIDRA 3D' }, body: JSON.stringify(payload) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
