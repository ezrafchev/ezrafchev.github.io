'use strict';
(() => {
  const SHORT='LOCAL_AGENT_V9';
  const LONG='LOCAL_WEBLLM_AGENTIC_V90';
  const upstream=window.fetch.bind(window);
  const filler={
    overview:' Esta interpretação foi construída a partir da pergunta, da posição de cada carta e da sequência completa. O sentido deve ser comparado com situações observáveis e confirmado em uma conversa direta entre os participantes.',
    answer:' O ponto central é transformar a leitura em uma conversa específica, com exemplos, limites e uma atitude possível de ser observada na prática.',
    dimension:' Esta dimensão precisa ser confirmada por comportamentos concretos e não apenas pela simbologia da tiragem.'
  };
  const grow=(value,min,extra)=>{let text=String(value||'').trim();while(text.length<min)text+=extra;return text;};
  function normalizeReading(reading){
    if(!reading||typeof reading!=='object')return reading;
    reading.visaoGeral=grow(reading.visaoGeral,200,filler.overview);
    reading.respostaPergunta=grow(reading.respostaPergunta,130,filler.answer);
    reading.combinacao=grow(reading.combinacao,130,filler.overview);
    if(!Array.isArray(reading.posicoes))reading.posicoes=[];
    while(reading.posicoes.length<3)reading.posicoes.push({posicao:['Clima atual','Ponte de conexão','Próximo passo'][reading.posicoes.length],carta:'Carta',interpretacao:filler.overview,potencial:filler.answer,sombra:'Evitem transformar interpretação em certeza.',convite:'Que atitude concreta pode esclarecer esta posição?'});
    reading.posicoes=reading.posicoes.slice(0,3).map((item,index)=>({
      posicao:String(item?.posicao||['Clima atual','Ponte de conexão','Próximo passo'][index]),
      carta:String(item?.carta||'Carta'),
      interpretacao:grow(item?.interpretacao,90,filler.overview),
      potencial:grow(item?.potencial,45,filler.answer),
      sombra:grow(item?.sombra,45,' Evitem transformar o símbolo em uma conclusão sobre a outra pessoa.'),
      convite:grow(item?.convite,25,' Que conversa pode verificar isso?')
    }));
    const keys=['atracao','carinho','confianca','comunicacao','expectativas','intencao'];
    reading.dimensoes=reading.dimensoes&&typeof reading.dimensoes==='object'?reading.dimensoes:{};
    for(const key of keys)reading.dimensoes[key]=grow(reading.dimensoes[key],55,filler.dimension);
    reading.pontoAtencao=grow(reading.pontoAtencao,70,' Não usem as cartas como prova de sentimentos ocultos ou previsão de fatos.');
    if(!Array.isArray(reading.planoPratico))reading.planoPratico=[];
    while(reading.planoPratico.length<3)reading.planoPratico.push('Escolham uma ação pequena, definam quando será realizada e confirmem se funciona para os dois.');
    reading.planoPratico=reading.planoPratico.slice(0,5).map(x=>String(x||'').trim()).filter(Boolean);
    reading.perguntaFinal=grow(reading.perguntaFinal,35,' Qual atitude concreta levarão desta leitura?');
    return reading;
  }
  function remapHeaders(input,init={}){
    const original=new Headers(init.headers||input?.headers||{});
    if(original.get('x-goog-api-key')===LONG)original.set('x-goog-api-key',SHORT);
    return {...init,headers:original};
  }
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const response=await upstream(input,remapHeaders(input,init));
    if(!url.includes(':generateContent')||!response.ok)return response;
    try{
      const data=await response.clone().json();
      const part=data?.candidates?.[0]?.content?.parts?.[0];
      if(!part?.text)return response;
      const parsed=JSON.parse(String(part.text).trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim());
      part.text=JSON.stringify(normalizeReading(parsed));
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json'}});
    }catch{return response;}
  };
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;
    const key=document.getElementById('geminiKey');
    if(action==='connect-ai'&&key?.value===SHORT)key.value=LONG;
    if(action==='disconnect-ai'&&key?.value===LONG)key.value='';
  },true);
})();
