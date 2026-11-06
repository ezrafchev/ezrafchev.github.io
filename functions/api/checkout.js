/**
 * Mercado Pago Checkout Pro — server-side skeleton for future authorized launch.
 * The endpoint is LOCKED unless price book, token and explicit activation are all set.
 * Never treat frontend quotes as sale prices. Never expose access tokens in client code.
 * Before go-live implement order persistence, inventory checks, idempotency and a verified webhook.
 */
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply=(data,status)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const SKU=/^[a-z0-9][a-z0-9-]{1,63}$/;
export async function onRequestPost({request,env}) {
  // A safety gate: payment remains disabled until the merchant configures both payments and fulfillment.
  if(env.CHECKOUT_ENABLED!=='true'||env.WEBHOOK_VERIFIED!=='true'||!env.MP_ACCESS_TOKEN||!env.TRIDRALAB_CATALOG_JSON){
    return reply({ok:false,code:'CHECKOUT_NOT_CONFIGURED',message:'Pagamento online ainda não habilitado. A lista de projetos não constitui compra.'},503);
  }
  const origin=new URL(request.url).origin;
  const requestOrigin=request.headers.get('origin');
  if(requestOrigin&&requestOrigin!==origin)return reply({ok:false,code:'ORIGIN_NOT_ALLOWED'},403);
  const length=Number(request.headers.get('content-length')||0);
  if(length>12000)return reply({ok:false,code:'BODY_TOO_LARGE'},413);
  let order,book;try{order=await request.json();book=JSON.parse(env.TRIDRALAB_CATALOG_JSON);}catch{return reply({ok:false,code:'INVALID_JSON'},400);}
  if(!order||!Array.isArray(order.items)||order.items.length<1||order.items.length>20||!book||typeof book!=='object')return reply({ok:false,code:'INVALID_ITEMS'},422);
  const items=[];
  for(const entry of order.items){
    const id=typeof entry?.sku==='string'?entry.sku:'';
    const qty=entry?.quantity;
    if(!SKU.test(id)||!Number.isInteger(qty)||qty<1||qty>25)return reply({ok:false,code:'INVALID_ITEM'},422);
    const product=Object.hasOwn(book,id)?book[id]:null;
    if(!product||product.active!==true||typeof product.title!=='string'||!Number.isInteger(product.price_cents)||product.price_cents<100||product.price_cents>100000000)return reply({ok:false,code:'SKU_UNAVAILABLE'},422);
    items.push({id,title:product.title.slice(0,200),quantity:qty,unit_price:product.price_cents/100,currency_id:'BRL'});
  }
  const total=items.reduce((s,item)=>s+item.quantity*item.unit_price,0);
  if(total>100000)return reply({ok:false,code:'MAX_AMOUNT_EXCEEDED'},422);
  // Do NOT create payment preferences before idempotency/order records are deployed.
  // WEBHOOK_VERIFIED flag denotes the merchant has installed and tested signed webhook validation and order tracking.
  const idempotency=crypto.randomUUID();
  const preference={items,external_reference:idempotency,statement_descriptor:'TRIDRALAB',back_urls:{success:`${origin}/?pagamento=pendente`,failure:`${origin}/?pagamento=falhou`,pending:`${origin}/?pagamento=pendente`},auto_return:'approved',notification_url:env.MP_WEBHOOK_URL||undefined};
  if(!env.MP_WEBHOOK_URL||!env.MP_WEBHOOK_URL.startsWith('https://'))return reply({ok:false,code:'WEBHOOK_URL_REQUIRED'},503);
  try{
    const response=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${env.MP_ACCESS_TOKEN}`,'x-idempotency-key':idempotency},body:JSON.stringify(preference)});
    if(!response.ok)return reply({ok:false,code:'PAYMENT_PROVIDER_ERROR'},502);
    const data=await response.json();const url=new URL(data.init_point);
    if(url.protocol!=='https:'||!(url.hostname==='mercadopago.com.br'||url.hostname.endsWith('.mercadopago.com.br')))return reply({ok:false,code:'INVALID_PROVIDER_URL'},502);
    return reply({ok:true,checkout_url:url.href},200);
  }catch{return reply({ok:false,code:'PAYMENT_PROVIDER_UNAVAILABLE'},502);}
}
export function onRequestGet(){return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);}
