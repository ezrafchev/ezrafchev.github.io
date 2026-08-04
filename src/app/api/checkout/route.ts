import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(request: NextRequest) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' }, { status: 500 });

  const form = await request.formData();
  const produto = String(form.get('produto') || 'Pedido TRIDRA 3D');
  const quantidade = Number(form.get('quantidade') || 1);
  const frete = Number(form.get('frete') || 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

  const client = new MercadoPagoConfig({ accessToken: token });
  const preference = new Preference(client);
  const result = await preference.create({ body: {
    external_reference: `TRIDRA-${Date.now()}`,
    items: [{ id: 'tridra-produto', title: produto, quantity: quantidade, unit_price: 39.9, currency_id: 'BRL' }],
    shipments: { cost: frete, mode: 'not_specified' },
    back_urls: { success: `${siteUrl}/pedidos`, pending: `${siteUrl}/pedidos`, failure: `${siteUrl}/checkout` },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/webhooks/mercadopago`
  }});

  return NextResponse.redirect(result.init_point || siteUrl, { status: 303 });
}
