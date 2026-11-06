/** Safe public capability flags; never reveal tokens or account settings. */
export function onRequestGet({env}) {
 const ready=env.CHECKOUT_ENABLED==='true'&&env.WEBHOOK_VERIFIED==='true'&&!!env.MP_ACCESS_TOKEN&&!!env.TRIDRALAB_CATALOG_JSON&&!!env.MP_WEBHOOK_URL;
 return new Response(JSON.stringify({ok:true,checkout:ready?'configured':'disabled',catalog:'demonstration',quote_submission:'local_only',model_upload:'local_only',version:'2.0'}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
