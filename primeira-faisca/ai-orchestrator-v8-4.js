'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const nativeFetch=window.fetch.bind(window);
  const MARKER='HF_PROXY_MULTIAI_TOKEN_V84';
  const models=[
    ['openai/gpt-oss-120b:cheapest','GPT‑OSS 120B · melhor qualidade'],
    ['Qwen/Qwen3-235B-A22B-Instruct-2507:cheapest','Qwen3 235B · contexto longo'],
    ['zai-org/GLM-4.5:preferred','GLM‑4.5 · raciocínio alternativo'],
    ['Qwen/Qwen3-4B-Thinking-2507:cheapest','Qwen3 4B Thinking · econômico']
  ];
  const cfg={hf:'',model:models[0][0],mode:'balanced',last:''};
  const clean=v=>String(v??'').replace(/```(?:json)?/gi,'').replace(/^\s*[-*_]{3,}\s*$/gm,'').replace(/^\s{0,3}#{1,6}\s*/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').trim();
  const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const headersObject=h=>{const out={};if(h instanceof Headers)h.forEach((v,k)=>out[k.toLowerCase()]=v);else if(Array.isArray(h))h.forEach(([k,v])=>out[String(k).toLowerCase()]=v);else Object.entries(h||{}).forEach(([k,v])=>out[String(k).toLowerCase()]=v);return out;};
  const setStatus=(text,state='ready')=>{const e=$('multiAiStatus');if(e){e.textContent=text;e.dataset.state=state;}const top=$('aiTopStatus');if(top)top.textContent=state==='ready'?'Multi‑AI ativo':state==='work'?'IA trabalhando':'Motor local';const dot=$('aiDot');if(dot)dot.classList.toggle('on',state!=='local');};
  const host=(role,message,mode='Multi‑AI v8.4')=>{if($('hostRole'))$('hostRole').textContent=role;if($('hostMessage'))$('hostMessage').textContent=message;if($('hostMode'))$('hostMode').textContent=mode;};
  const order=()=>{
    const chosen=cfg.model;
    const rest=models.map(x=>x[0]).filter(x=>x!==chosen);
    if(cfg.mode==='economy')return ['Qwen/Qwen3-4B-Thinking-2507:cheapest',chosen,...rest].filter((v,i,a)=>a.indexOf(v)===i);
    return [chosen,...rest];
  };
  const withTimeout=async(url,options,ms=75000)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await nativeFetch(url,{...options,signal:c.signal});}finally{clearTimeout(t);}};
  const promptFromGemini=body=>{
    const system=(body?.systemInstruction?.parts||[]).map(p=>p.text||'').join('\n');
    const user=(body?.contents||[]).flatMap(c=>c.parts||[]).map(p=>p.text||'').join('\n\n');
    return {system,user};
  };
  async function hfCompletion(geminiBody){
    if(!cfg.hf)throw new Error('Token Hugging Face não conectado.');
    const {system,user}=promptFromGemini(geminiBody);
    const schema=geminiBody?.generationConfig?.responseJsonSchema;
    let lastError='';
    for(const model of order()){
      const body={model,messages:[{role:'system',content:`${system}\nResponda em português do Brasil. Não use conteúdo sexual explícito, não pressione contato físico e respeite o formato solicitado.`},{role:'user',content:user}],max_tokens:Math.min(Number(geminiBody?.generationConfig?.maxOutputTokens)||5000,12000),temperature:.55};
      if(schema)body.response_format={type:'json_schema',json_schema:{name:'primeira_faisca',strict:true,schema}};
      const request=()=>withTimeout('https://router.huggingface.co/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${cfg.hf}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
      try{
        setStatus(`Tentando Hugging Face · ${model.split(':')[0]}…`,'work');
        let r=await request();
        if(!r.ok&&body.response_format&&r.status===400){delete body.response_format;body.messages[0].content+=`\nRetorne somente JSON válido conforme este esquema: ${JSON.stringify(schema)}.`;r=await request();}
        const data=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(data?.error?.message||data?.message||`HTTP ${r.status}`);
        const text=data?.choices?.[0]?.message?.content;if(!text)throw new Error('Resposta vazia.');
        cfg.last=model;setStatus(`Resposta validada por Hugging Face · ${model.split(':')[0]}.`,'ready');host('Orquestrador Multi‑AI','A resposta foi produzida por um modelo do Hugging Face.',`HF · ${model.split(':')[0]}`);
        return jsonResponse({candidates:[{content:{parts:[{text:clean(text)}]},finishReason:'STOP'}]});
      }catch(error){lastError=error.message;}
    }
    throw new Error(lastError||'Todos os modelos do Hugging Face falharam.');
  }
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const h=headersObject(init.headers||input?.headers);const key=h['x-goog-api-key']||'';
    if(url.includes('generativelanguage.googleapis.com/v1beta/models')&&key===MARKER){
      return jsonResponse({models:[{name:'models/hf-multi-ai',displayName:'Hugging Face Multi‑AI',supportedGenerationMethods:['generateContent']} ]});
    }
    if(url.includes('generativelanguage.googleapis.com')&&url.includes(':generateContent')){
      const body=JSON.parse(init.body||'{}');
      const hfOnly=key===MARKER||url.includes('/hf-multi-ai:generateContent');
      if(cfg.hf&&(hfOnly||cfg.mode==='hf-first'||cfg.mode==='economy')){
        try{return await hfCompletion(body);}catch(error){if(hfOnly)return jsonResponse({error:{message:error.message}},429);}
      }
      const original=await nativeFetch(input,init);
      if(original.ok||!cfg.hf||cfg.mode==='gemini-only')return original;
      try{return await hfCompletion(body);}catch{return original;}
    }
    return nativeFetch(input,init);
  };
  function inject(){
    const panel=$('aiPanel');if(!panel||$('hfToken'))return;
    const title=panel.querySelector('.ai-head h3');if(title)title.textContent='Orquestrador Multi‑AI + motor local';
    const desc=panel.querySelector('.ai-head p');if(desc)desc.textContent='Conecte Gemini, Hugging Face ou os dois. Em caso de cota ou falha, o sistema troca automaticamente de motor.';
    const fields=panel.querySelector('.ai-fields');
    fields?.insertAdjacentHTML('beforeend',`<label>Token Hugging Face<input id="hfToken" type="password" autocomplete="off" placeholder="Token com permissão Inference Providers"></label><label>Modelo principal do Hugging Face<select id="hfModel">${models.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Estratégia<select id="multiAiMode"><option value="balanced">Equilibrado · Gemini primeiro, HF como reserva</option><option value="hf-first">Hugging Face primeiro</option><option value="economy">Econômico · modelo menor primeiro</option><option value="gemini-only">Somente Gemini externo</option><option value="local">Somente motor local</option></select></label><div class="multi-ai-health"><b>Estado dos motores</b><p id="multiAiStatus" data-state="local">Motor local ativo. Nenhuma chave externa é necessária.</p></div>`);
    const connect=panel.querySelector('[data-action="connect-ai"]');if(connect)connect.textContent='Conectar motores';
    const disconnect=panel.querySelector('[data-action="disconnect-ai"]');if(disconnect)disconnect.textContent='Desconectar IAs externas';
    if($('aiHelp'))$('aiHelp').textContent='As chaves ficam somente na memória desta página. Hugging Face e Gemini possuem cotas; o motor local mantém a experiência.';
    panel.insertAdjacentHTML('beforeend','<small class="multi-ai-note">Hugging Face oferece créditos mensais limitados. O padrão usa fallback sequencial para evitar chamadas duplicadas.</small>');
    const style=document.createElement('style');style.textContent='.ai-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important}.multi-ai-health{border:1px solid var(--line);border-radius:16px;padding:15px;background:rgba(255,255,255,.025);align-self:end}.multi-ai-health b{display:block;margin-bottom:7px}.multi-ai-health p{margin:0;color:var(--muted);line-height:1.45}.multi-ai-health p[data-state="ready"]{color:var(--good)}.multi-ai-health p[data-state="error"]{color:var(--danger)}.multi-ai-note{display:block;margin-top:10px;color:var(--muted)}@media(max-width:760px){.ai-fields{grid-template-columns:1fr!important}}';document.head.appendChild(style);
    document.querySelectorAll('.hero .eyebrow').forEach(e=>e.textContent='Couple Experience · v8.4 Multi‑AI');
    const hero=document.querySelector('.hero>p');if(hero)hero.textContent='Uma jornada viva com 96 cartas e um orquestrador de IA: Gemini, GPT‑OSS, Qwen, GLM e motor local em sequência inteligente.';
    document.querySelectorAll('[data-action="refine-synthesis"],[data-action="refine-closing"]').forEach(b=>b.textContent='Aprofundar com Multi‑AI');
    if($('retryTarot'))$('retryTarot').textContent='Tentar outro motor';
  }
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='connect-ai'){
      cfg.hf=$('hfToken')?.value.trim()||'';cfg.model=$('hfModel')?.value||models[0][0];cfg.mode=$('multiAiMode')?.value||'balanced';
      const g=$('geminiKey');if(cfg.hf&&g&&!g.value.trim())g.value=MARKER;
      if(cfg.hf)nativeFetch('https://router.huggingface.co/v1/models',{headers:{Authorization:`Bearer ${cfg.hf}`}}).then(r=>{if(!r.ok)throw 0;setStatus('Hugging Face conectado. Fallback automático habilitado.','ready');}).catch(()=>setStatus('Token Hugging Face não foi validado. O motor local permanece ativo.','error'));
    }
    if(action==='disconnect-ai'){cfg.hf='';cfg.last='';const g=$('geminiKey');if(g?.value===MARKER)g.value='';setStatus('Motor local ativo. Chaves externas removidas da memória.','local');}
  },true);
  document.addEventListener('change',event=>{if(event.target.id==='hfModel')cfg.model=event.target.value;if(event.target.id==='multiAiMode')cfg.mode=event.target.value;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
