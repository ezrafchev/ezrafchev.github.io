'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setText = (id, value, fallback='') => { const el=$(id); if(el) el.textContent=String(value ?? fallback); };
  const showEl = (id, show=true) => $(id)?.classList.toggle('hidden', !show);
  const shuffle = source => { const a=[...source]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const stripMarkdown = value => String(value ?? '')
    .replace(/```(?:json)?/gi,'')
    .replace(/^\s*[-*_]{3,}\s*$/gm,'')
    .replace(/^\s{0,3}#{1,6}\s*/gm,'')
    .replace(/\*\*(.*?)\*\*/g,'$1')
    .replace(/__(.*?)__/g,'$1')
    .replace(/\*(.*?)\*/g,'$1')
    .replace(/_(.*?)_/g,'$1')
    .replace(/^\s*[-*+]\s+/gm,'')
    .trim();

  const rawCards = typeof cards !== 'undefined' && Array.isArray(cards) ? cards : [];
  const tarotDeck = typeof lenormand !== 'undefined' && Array.isArray(lenormand) ? lenormand : [];
  const iconMap = typeof icons !== 'undefined' ? icons : {};
  const ALT = typeof alternatives !== 'undefined' && Array.isArray(alternatives) && alternatives.length ? alternatives : [
    'Façam um elogio específico um ao outro.',
    'Escolham uma música para representar este momento.',
    'Inventem uma pergunta nova e respondam os dois.'
  ];
  const PHASES = [
    {id:'abertura',symbol:'○',name:'Abertura',description:'Comecem por temas leves para criar presença.',cats:['conversa']},
    {id:'descoberta',symbol:'◎',name:'Descoberta',description:'Conheçam preferências, hábitos e compatibilidade.',cats:['afinidade']},
    {id:'conexao',symbol:'◇',name:'Conexão',description:'Aprofundem confiança, vulnerabilidade e comunicação.',cats:['vinculo']},
    {id:'romance',symbol:'♥',name:'Romance',description:'Conversem sobre afeto, desejo de proximidade e formas de carinho.',cats:['romance','faisca']},
    {id:'experiencia',symbol:'↗',name:'Experiência',description:'Transformem a conversa em uma atividade compartilhada.',cats:['desafio']}
  ];
  const GUIDE = {
    conversa:'Conte um exemplo real e explique por que foi importante.',
    afinidade:'Diga sua preferência e mostre como ela aparece na prática.',
    vinculo:'Fale sobre atitudes concretas no nível de detalhe confortável.',
    romance:'Fale do que você sente e prefere, sem tentar adivinhar o outro.',
    faisca:'Descreva uma forma de proximidade confortável e o que cria segurança.',
    desafio:'Conversem antes, adaptem livremente e só realizem com concordância clara.'
  };
  const REASON = {
    conversa:'Cria presença e abre a conversa.',
    afinidade:'Ajuda a perceber preferências e compatibilidade.',
    vinculo:'Favorece compreensão emocional e segurança.',
    romance:'Nomeia afeto e intimidade sem criar obrigação.',
    faisca:'Explora química e proximidade com respeito.',
    desafio:'Transforma conversa em uma memória compartilhada.'
  };
  const CARDS = rawCards.map((c,i)=>({
    id:`c${i}`, c:c?.c||'conversa', l:Math.max(1,Math.min(3,Number(c?.l)||1)),
    q:String(c?.q||'Compartilhem algo importante.'),
    w:String(c?.w||REASON[c?.c]||REASON.conversa),
    h:String(c?.h||GUIDE[c?.c]||GUIDE.conversa),
    r:String(c?.r||''), d:Boolean(c?.d)
  }));
  const DICE = {
    action:['Dar as mãos','Abraço confortável','Contato visual','Dança curta','Carinho nas mãos','Gesto escolhido juntos'],
    time:['5 segundos','10 segundos','15 segundos','20 segundos','30 segundos','45 segundos'],
    mood:['divertido','carinhoso','calmo','romântico','criativo','como surpresa conjunta']
  };
  const blank = () => ({
    version:82,p1:'',p2:'',duration:18,level:2,deck:[],index:0,answered:0,skipped:0,
    favorites:0,spark:0,fav:false,insights:[],favoriteCards:[],phaseStats:{},categories:{},
    lastDice:'',synthesis:'',tarotData:null,tarotCards:[],closing:null,currentView:'home'
  });
  let state=blank(), apiKey='', model='', spotifyController=null, lastTarot=null;

  function save(){try{sessionStorage.setItem('primeira-faisca-v8-2',JSON.stringify(state));}catch{}}
  function restore(){try{const saved=JSON.parse(sessionStorage.getItem('primeira-faisca-v8-2')||'null');if(saved?.version===82)state={...blank(),...saved};}catch{}}
  function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800);}
  function host(role,message,mode=apiKey?'Gemini conectado':'motor local'){setText('hostRole',role);setText('hostMessage',message);setText('hostMode',mode);}
  function current(){return state.deck[state.index]||null;}
  function phase(card=current()){return PHASES.find(p=>p.id===card?.phaseId)||PHASES[0];}
  function topCategory(){return Object.entries(state.categories).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';}
  function viewId(view){return `view-${view}`;}
  function show(view,force=false){
    if(!force){
      if(['map','chemistry'].includes(view)&&!state.deck.length)view='setup';
      if(view==='tarot'&&state.index<state.deck.length)view='session';
      if(view==='closing'&&!state.tarotData)view='tarot';
    }
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==viewId(view)));
    state.currentView=view;
    const labels={home:'Início',setup:'Preparação',session:'Jornada',map:'Mapa',chemistry:'Momento da Química',tarot:'Tarô',closing:'Encerramento',kit:'Kit 3D',credits:'Créditos'};
    const step={home:0,setup:1,session:2,map:3,chemistry:4,tarot:5,closing:6}[view]||0;
    setText('globalStep',labels[view]||'Início'); if($('globalBar'))$('globalBar').style.width=`${step/6*100}%`;
    if(view==='tarot')renderContext();
    window.scrollTo({top:0,behavior:'smooth'}); save();
  }

  function buildDeck(){
    const counts=state.duration===12?[3,2,3,2,2]:state.duration===24?[5,5,5,5,4]:[4,4,4,4,2];
    const used=new Set(),deck=[];
    PHASES.forEach((p,i)=>{
      const picked=[];
      for(const c of shuffle(CARDS.filter(c=>p.cats.includes(c.c)&&c.l<=state.level))){if(!used.has(c.id)){picked.push({...c,phaseId:p.id});used.add(c.id);}if(picked.length===counts[i])break;}
      if(picked.length<counts[i])for(const c of shuffle(CARDS.filter(c=>c.l<=state.level))){if(!used.has(c.id)){picked.push({...c,phaseId:p.id});used.add(c.id);}if(picked.length===counts[i])break;}
      deck.push(...picked);
    });
    return deck.slice(0,state.duration);
  }
  function start(){
    const p1=$('p1')?.value.trim(),p2=$('p2')?.value.trim();
    if(!p1||!p2){setText('setupError','Preencha os dois nomes.');return;}
    state={...blank(),p1,p2,duration:Number($('duration')?.value||18),level:Number(document.querySelector('#levels .active')?.dataset.level||2),currentView:'session'};
    PHASES.forEach(p=>state.phaseStats[p.id]={seen:0,answered:0,skipped:0});
    state.deck=buildDeck();
    if(!state.deck.length){setText('setupError','O banco de cartas não carregou. Atualize a página.');return;}
    setText('setupError','');show('session',true);renderCard();host('Dealer da jornada',`A jornada começa em ${phase().name}. ${phase().description}`);
  }
  function renderCard(){
    if(state.index>=state.deck.length){finish();return;}
    const c=current(),p=phase(c);
    setText('cardCounter',`${state.index+1} de ${state.deck.length}`);if($('sessionBar'))$('sessionBar').style.width=`${state.index/state.deck.length*100}%`;
    setText('phaseSymbol',p.symbol);setText('phaseName',p.name);setText('phaseDescription',p.description);
    setText('categoryBadge',`${iconMap[c.c]||'◌'} ${c.c}`);setText('levelBadge',`Nível ${c.l}`);setText('turnLabel',`Vez de ${state.index%2===0?state.p1:state.p2}`);
    setText('questionText',c.q);setText('cardReason',c.w||REASON[c.c]);setText('answerGuide',c.h||GUIDE[c.c]);
    setText('cardGuidance',c.r?`DINÂMICA: ${c.r}`:(c.d?'Atividade compartilhada: adaptem livremente e só realizem com concordância clara.':'Respondam no nível confortável.'));
    if($('insightInput'))$('insightInput').value='';
    if($('phaseTimeline'))$('phaseTimeline').innerHTML=PHASES.map(x=>`<div class="${x.id===p.id?'active':''}">${x.symbol} ${x.name}</div>`).join('');
    state.fav=false;setText('favorite','♡');save();
  }
  function advance(kind){
    const c=current();if(!c)return;state.categories[c.c]=(state.categories[c.c]||0)+1;state.phaseStats[c.phaseId].seen++;
    if(kind==='answered'){state.answered++;state.spark+=c.d?2:1;state.phaseStats[c.phaseId].answered++;}else{state.skipped++;state.phaseStats[c.phaseId].skipped++;}
    if(state.fav){state.favorites++;state.favoriteCards.push(c.q);}state.index++;
    if(state.index>=state.deck.length){finish();return;}renderCard();host('Dealer da jornada',phase().description);save();
  }
  function adapt(){const c=current();if(!c)return;setText('questionText',`${c.q.replace(/\?$/,'')} — responda apenas a parte que fizer sentido agora?`);setText('answerGuide','Use um exemplo simples, responda em uma frase e deixe de fora detalhes desconfortáveis.');setText('cardGuidance','DINÂMICA ADAPTADA: cada pessoa responde em até 30 segundos.');host('Mediadora','A pergunta foi adaptada sem perder a intenção.');}
  function insight(){const value=$('insightInput')?.value.trim();if(!value){toast('Escreva um insight.');return;}if(state.insights.length>=12){toast('Limite de 12 insights alcançado.');return;}state.insights.push(value);$('insightInput').value='';save();toast('Insight guardado.');}
  function alternative(){setText('alternativeText',ALT[Math.floor(Math.random()*ALT.length)]);showEl('alternativeModal',true);}
  function synthesis(){return`Vocês concluíram ${state.answered} respostas e escolheram ${state.skipped} alternativas. ${topCategory()?`O tema mais presente foi ${topCategory()}. `:''}${state.insights.length?`${state.insights.length} descobertas foram guardadas. `:''}O percurso aponta quais assuntos criaram mais abertura e prepara o Momento da Química antes da leitura final.`;}
  function finish(){
    setText('answeredMetric',state.answered);setText('skippedMetric',state.skipped);setText('favoriteMetric',state.favorites);setText('sparkMetric',state.spark);
    if($('phaseSummary'))$('phaseSummary').innerHTML=PHASES.map(p=>{const x=state.phaseStats[p.id]||{};return`<div class="summaryRow"><b>${p.symbol} ${p.name}</b><span>${x.answered||0} respondidas · ${x.skipped||0} alternativas</span></div>`;}).join('');
    if($('insightSummary'))$('insightSummary').innerHTML=state.insights.length?state.insights.map(i=>`<div class="insightPill">${esc(i)}</div>`).join(''):'<p class="microcopy">Nenhum insight registrado.</p>';
    state.synthesis=synthesis();setText('journeySynthesis',state.synthesis);show('map',true);host('Diretora da experiência','A jornada foi organizada. Agora vem o Momento da Química.');save();
  }
  function roll(){
    const a=Math.floor(Math.random()*6),t=Math.floor(Math.random()*6),m=Math.floor(Math.random()*6);
    const set=(id,n,v)=>{const e=$(id);if(e){e.querySelector('span').textContent=n;e.querySelector('b').textContent=v;}};
    set('dieAction',a+1,DICE.action[a]);set('dieTime',t+1,DICE.time[t]);set('dieMood',m+1,DICE.mood[m]);
    setText('diceCombo',`${DICE.action[a]} por ${DICE.time[t]}, em clima ${DICE.mood[m]}.`);setText('diceMeaning','A proposta pode ser aceita, adaptada ou rolada novamente. Ao continuar, será integrada ao Tarô.');setText('diceSaved','Momento pronto.');
    if($('continueTarot'))$('continueTarot').disabled=false;host('Anfitriã da Química',`O momento sorteado foi: ${DICE.action[a]} por ${DICE.time[t]}, em clima ${DICE.mood[m]}.`);
  }
  function toTarot(){const combo=$('diceCombo')?.textContent.trim();if(!combo||/Role os dados/i.test(combo)){toast('Role os dados antes de continuar.');return;}state.lastDice=combo;setText('diceSaved','✓ Momento guardado. Abrindo o Tarô…');save();show('tarot',true);}
  function context(){return`Participantes: ${state.p1} e ${state.p2}. Respondidas: ${state.answered}. Alternativas: ${state.skipped}. Favoritas: ${state.favoriteCards.join(' | ')||'nenhuma'}. Insights: ${state.insights.join(' | ')||'nenhum'}. Momento da Química: ${state.lastDice||'não realizado'}. Síntese: ${state.synthesis||'não gerada'}.`;}
  function renderContext(){setText('autoContext',`Contexto automático: ${state.p1||'Pessoa 1'} + ${state.p2||'Pessoa 2'} · ${state.answered} respondidas · ${state.skipped} alternativas${state.lastDice?' · momento guardado':''}.`);}

  const TAROT_SCHEMA={type:'object',required:['visaoGeral','respostaPergunta','posicoes','combinacao','dimensoes','pontoAtencao','planoPratico','perguntaFinal'],properties:{
    visaoGeral:{type:'string'},respostaPergunta:{type:'string'},
    posicoes:{type:'array',minItems:3,maxItems:3,items:{type:'object',required:['posicao','carta','interpretacao','potencial','sombra','convite'],properties:{posicao:{type:'string'},carta:{type:'string'},interpretacao:{type:'string'},potencial:{type:'string'},sombra:{type:'string'},convite:{type:'string'}}}},
    combinacao:{type:'string'},dimensoes:{type:'object',required:['atracao','carinho','confianca','comunicacao','expectativas','intencao'],properties:{atracao:{type:'string'},carinho:{type:'string'},confianca:{type:'string'},comunicacao:{type:'string'},expectativas:{type:'string'},intencao:{type:'string'}}},
    pontoAtencao:{type:'string'},planoPratico:{type:'array',minItems:3,maxItems:5,items:{type:'string'}},perguntaFinal:{type:'string'}
  }};
  function localTarot(sel,q){const roles=['Clima atual','Ponte de conexão','Próximo passo'];return{
    visaoGeral:`As cartas ${sel.map(c=>c[1]).join(', ')} formam uma sequência simbólica. A primeira mostra o clima percebido, a segunda indica como criar ligação e a terceira propõe um próximo passo.\n\nA leitura considera o percurso do jogo, mas não afirma conhecer sentimentos ocultos nem prever fatos.`,
    respostaPergunta:q?`Sobre “${q}”, as cartas convidam a observar como ${sel[0][3]} encontra apoio em ${sel[1][3]} e pode ser transformado em ${sel[2][3]}. A resposta concreta depende da conversa entre vocês.`:'A tiragem recomenda transformar curiosidade em comunicação clara.',
    posicoes:sel.map((c,i)=>({posicao:roles[i],carta:c[1],interpretacao:c[4],potencial:`O potencial está em ${c[3]}.`,sombra:c[5],convite:c[6]})),
    combinacao:`${sel[0][1]} abre o tema, ${sel[1][1]} mostra a ponte e ${sel[2][1]} orienta a ação.`,
    dimensoes:{atracao:'Pode haver curiosidade e presença, mas a tiragem não comprova intensidade.',carinho:'Carinho aparece em cuidado, atenção e disponibilidade observáveis.',confianca:'Confiança cresce por constância, clareza e respeito aos limites.',comunicacao:'A comunicação transforma impressão em entendimento.',expectativas:'Expectativas precisam ser nomeadas para não virarem suposições.',intencao:'Intenção só pode ser confirmada por escolhas e conversas diretas.'},
    pontoAtencao:'Não usem as cartas como prova sobre o que o outro sente.',planoPratico:sel.map(c=>c[6]).slice(0,3),perguntaFinal:'Qual parte corresponde a algo observável e qual ainda precisa ser conversada?'
  };}
  function validateTarot(data){
    if(!data||typeof data!=='object')throw new Error('Resposta da IA não é um objeto.');
    for(const key of TAROT_SCHEMA.required)if(data[key]===undefined||data[key]===null||String(data[key]).trim()==='')throw new Error(`Campo ausente: ${key}`);
    if(!Array.isArray(data.posicoes)||data.posicoes.length!==3)throw new Error('As três posições não foram preenchidas.');
    if(!Array.isArray(data.planoPratico)||data.planoPratico.length<3)throw new Error('Plano prático incompleto.');
    if(String(data.visaoGeral).length<180||String(data.respostaPergunta).length<100)throw new Error('Leitura superficial.');
    return data;
  }
  function renderReading(data,meta='Motor local inteligente'){
    const paragraph=value=>esc(stripMarkdown(value)).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
    const d=data.dimensoes||{};
    if($('readingSections'))$('readingSections').innerHTML=`
      <section class="readingSection"><h4>Visão geral</h4><p>${paragraph(data.visaoGeral)}</p></section>
      <section class="readingSection"><h4>Resposta à pergunta</h4><p>${paragraph(data.respostaPergunta)}</p></section>
      <section class="readingSection"><h4>As três posições</h4><div class="positionGrid">${data.posicoes.map(x=>`<article class="positionBox"><b>${esc(x.posicao)} · ${esc(x.carta)}</b><p>${paragraph(x.interpretacao)}</p><p><strong>Potencial:</strong> ${paragraph(x.potencial)}</p><p><strong>Sombra:</strong> ${paragraph(x.sombra)}</p><p><strong>Convite:</strong> ${paragraph(x.convite)}</p></article>`).join('')}</div></section>
      <section class="readingSection"><h4>Combinação das cartas</h4><p>${paragraph(data.combinacao)}</p></section>
      <section class="readingSection"><h4>Dimensões da relação</h4><div class="dimensionGrid">${Object.entries({Atração:d.atracao,Carinho:d.carinho,Confiança:d.confianca,Comunicação:d.comunicacao,Expectativas:d.expectativas,Intenção:d.intencao}).map(([k,v])=>`<article class="dimensionBox"><b>${k}</b><p>${paragraph(v||'Não analisado.')}</p></article>`).join('')}</div></section>
      <section class="readingSection"><h4>Ponto de atenção</h4><p>${paragraph(data.pontoAtencao)}</p></section>
      <section class="readingSection"><h4>Plano prático</h4><ol>${data.planoPratico.map(x=>`<li>${esc(stripMarkdown(x))}</li>`).join('')}</ol></section>
      <section class="readingSection"><h4>Pergunta final</h4><p>${paragraph(data.perguntaFinal)}</p></section>`;
    setText('readingMeta',meta);setText('readingEngine',meta);showEl('reading',true);showEl('toClosing',true);
  }
  function tarotPrompt(sel,q,extra){const roles=['Clima atual','Ponte de conexão','Próximo passo'];return`Você é a intérprete técnica do Baralho Cigano do jogo Primeira Faísca. Responda SOMENTE em JSON válido, sem Markdown, sem asteriscos, sem títulos e sem texto fora do objeto.\n\n${context()}\nPergunta principal: ${q||'O que esta experiência ajuda o casal a compreender sobre a conexão construída?'}\nContexto adicional: ${extra||'não informado'}.\nCartas: ${sel.map((c,i)=>`${roles[i]} — ${c[1]}: núcleo=${c[3]}; potência=${c[4]}; sombra=${c[5]}; convite=${c[6]}`).join(' | ')}.\n\nProduza uma leitura específica, profunda, coerente e sem repetição. Diferencie atração, carinho, confiança, comunicação, expectativas e intenção. Não trate símbolos como fatos sobre pensamentos ou futuro. O plano prático deve ter 3 a 5 ações realistas.`;}
  function draw(){
    const button=$('drawTarot');if(button){button.disabled=true;button.textContent='Embaralhando…';}
    try{
      if(tarotDeck.length<3)throw new Error('O Baralho Cigano não carregou.');
      const sel=shuffle(tarotDeck).slice(0,3),roles=['Clima atual','Ponte de conexão','Próximo passo'];state.tarotCards=sel;lastTarot={sel,q:$('tarotQuestion')?.value.trim()||'',extra:$('tarotContext')?.value.trim()||''};
      if($('spread'))$('spread').innerHTML=sel.map((c,i)=>`<article class="lenormand"><span class="number">${String(c[0]).padStart(2,'0')}</span><div class="symbol">${c[2]}</div><h3>${esc(c[1])}</h3><small>${roles[i]}</small></article>`).join('');
      state.tarotData=localTarot(sel,lastTarot.q);renderReading(state.tarotData,'Motor local inteligente');save();$('spread')?.scrollIntoView({behavior:'smooth',block:'center'});
      if(apiKey)enhanceTarot(lastTarot).catch(error=>{toast(friendly(error));setText('readingMeta','Motor local mantido');});
    }catch(error){toast(error.message);}finally{if(button){button.disabled=false;button.textContent='Tirar três cartas e interpretar';}}
  }
  async function enhanceTarot(request){
    setText('readingMeta','A IA está aprofundando a mesma leitura…');showEl('readingLoading',true);
    try{
      let data;
      try{data=validateTarot(await geminiJSON(tarotPrompt(request.sel,request.q,request.extra),TAROT_SCHEMA,9000));}
      catch(first){data=validateTarot(await geminiJSON(`A resposta anterior ficou inválida: ${first.message}. Gere novamente todos os campos com profundidade.\n\n${tarotPrompt(request.sel,request.q,request.extra)}`,TAROT_SCHEMA,11000));}
      state.tarotData=data;renderReading(data,`Gemini · ${model}`);save();host('Cigana simbólica','A leitura foi aprofundada e organizada em uma única estrutura.','Gemini conectado');
    } finally {showEl('readingLoading',false);}
  }

  function localClosing(){return{clareza:`A experiência mostrou quais temas receberam mais atenção${topCategory()?`: ${topCategory()}`:''}.`,conversaPendente:'Escolham apenas um tema que ainda merece esclarecimento e conversem sem tentar resolver tudo de uma vez.',proximoPasso:'Combinem uma atividade simples e uma data realista para continuar a conexão.',memoriaFinal:state.lastDice?`Guardem como símbolo: ${state.lastDice}`:'Escolham uma música ou frase para representar o encontro.',fraseFinal:'A experiência termina, a conversa continua.',instrucaoFinal:'Cada pessoa diz uma coisa de que gostou e uma que gostaria de repetir.'};}
  function renderClosing(d){if($('closingGrid'))$('closingGrid').innerHTML=`<article class="closingCard"><h3>O que ficou claro</h3><p>${esc(stripMarkdown(d.clareza))}</p></article><article class="closingCard"><h3>Conversa pendente</h3><p>${esc(stripMarkdown(d.conversaPendente))}</p></article><article class="closingCard"><h3>Próximo passo</h3><p>${esc(stripMarkdown(d.proximoPasso))}</p></article><article class="closingCard"><h3>Memória final</h3><p>${esc(stripMarkdown(d.memoriaFinal))}</p></article>`;setText('finalPhrase',stripMarkdown(d.fraseFinal));setText('finalInstruction',stripMarkdown(d.instrucaoFinal));}
  function closing(){state.closing=localClosing();renderClosing(state.closing);show('closing',true);save();}

  function friendly(error){const m=String(error?.message||error);if(/quota|429|rate.?limit|resource_exhausted/i.test(m))return'A cota gratuita da IA está temporariamente esgotada. A versão local permanece ativa.';if(/abort|timeout/i.test(m))return'A IA demorou demais. A versão local permaneceu ativa.';return'A IA externa não respondeu corretamente. A versão local permaneceu ativa.';}
  function parseJSON(text){return JSON.parse(String(text).trim().replace(/^```json\s*/i,'').replace(/^```/,'').replace(/```$/,'').trim());}
  async function geminiRaw(prompt,{schema=null,max=2000}={}){
    if(!apiKey||!model)throw new Error('IA não conectada.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);
    const generationConfig={maxOutputTokens:max};if(schema){generationConfig.responseMimeType='application/json';generationConfig.responseJsonSchema=schema;}
    const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body={systemInstruction:{parts:[{text:'Responda em português do Brasil. Quando houver esquema JSON, retorne somente JSON válido, sem Markdown, asteriscos, títulos ou comentários externos.'}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig};
    const request=async()=>{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify(body),signal:controller.signal});let data={};try{data=await response.json();}catch{}if(!response.ok){const error=new Error(data?.error?.message||`Erro ${response.status}`);error.status=response.status;throw error;}const out=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!out)throw new Error('Resposta vazia.');return out;};
    try{return await request();}catch(first){if(first.status===400&&schema){delete generationConfig.responseJsonSchema;generationConfig.responseMimeType='application/json';body.contents[0].parts[0].text=`Retorne somente JSON válido conforme este esquema: ${JSON.stringify(schema)}.\n\n${prompt}`;return await request();}throw first;}finally{clearTimeout(timer);}
  }
  async function geminiJSON(prompt,schema,max){return parseJSON(await geminiRaw(prompt,{schema,max}));}
  async function connect(){
    const key=$('geminiKey')?.value.trim();if(!key||key.length<20){setText('aiState','Chave inválida');return;}setText('aiState','Conectando…');
    try{
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':key}}),data=await response.json();if(!response.ok)throw new Error(data?.error?.message||'Falha ao listar modelos.');
      const models=(data.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')&&/gemini/i.test(m.name||'')&&!/image|audio|tts|live/i.test(m.name||''));if(!models.length)throw new Error('Nenhum modelo compatível.');
      apiKey=key;model=(models.find(m=>/flash/i.test(m.name))||models[0]).name.replace(/^models\//,'');if($('geminiModel'))$('geminiModel').innerHTML=models.map(m=>`<option value="${esc(m.name.replace(/^models\//,''))}">${esc(m.displayName||m.name)}</option>`).join('');$('geminiModel').value=model;
      setText('aiState',`Conectado a ${model}`);setText('aiTopStatus','Gemini ativo');if($('aiDot'))$('aiDot').classList.add('on');toast('IA conectada.');host('Anfitriã da experiência','A IA está pronta para aprofundar síntese, Tarô e encerramento.','Gemini conectado');
    }catch(error){apiKey='';model='';setText('aiState',friendly(error));}
  }
  function disconnect(){apiKey='';model='';setText('aiState','Motor local ativo');setText('aiTopStatus','Motor local');if($('aiDot'))$('aiDot').classList.remove('on');}
  async function refineSynthesis(){const local=synthesis();state.synthesis=local;setText('journeySynthesis',local);if(!apiKey){toast('Síntese local atualizada.');return;}try{const schema={type:'object',required:['sintese','ponte'],properties:{sintese:{type:'string'},ponte:{type:'string'}}};const data=await geminiJSON(`${context()} Produza uma síntese específica do percurso e uma ponte para o Momento da Química. Não use Markdown e não diagnostique a relação.`,schema,2200);state.synthesis=stripMarkdown(data.sintese);setText('journeySynthesis',`${stripMarkdown(data.sintese)}\n\n${stripMarkdown(data.ponte)}`);save();}catch(error){toast(friendly(error));}}
  async function askHost(){const q=$('hostQuestion')?.value.trim();if(!q){toast('Escreva uma pergunta.');return;}const local='A sequência correta é preparação, jornada, mapa, Momento da Química, Tarô e encerramento. Cada etapa usa informações da anterior.';setText('hostReply',local);if(!apiKey)return;try{const answer=await geminiRaw(`${context()} Pergunta dos participantes sobre a experiência: ${q}. Responda em 100 a 180 palavras, sem Markdown, explicando a lógica e indicando uma ação prática.`,{max:700});setText('hostReply',stripMarkdown(answer));}catch(error){toast(friendly(error));}}
  async function refineClosing(){closing();if(!apiKey){toast('Encerramento local atualizado.');return;}try{const schema={type:'object',required:['clareza','conversaPendente','proximoPasso','memoriaFinal','fraseFinal','instrucaoFinal'],properties:{clareza:{type:'string'},conversaPendente:{type:'string'},proximoPasso:{type:'string'},memoriaFinal:{type:'string'},fraseFinal:{type:'string'},instrucaoFinal:{type:'string'}}};const data=await geminiJSON(`${context()} Leitura: ${JSON.stringify(state.tarotData)}. Crie um encerramento específico, elegante e sem Markdown. Não repita a leitura e não presuma sentimentos.`,schema,3500);state.closing=data;renderClosing(data);save();}catch(error){toast(friendly(error));}}

  async function action(name){
    switch(name){
      case'go-home':show('home');break;case'go-setup':show('setup');break;case'go-current':show(state.currentView||'home',true);break;case'go-kit':show('kit');break;case'go-credits':show('credits');break;case'go-chemistry':show('chemistry');break;
      case'scroll-instructions':$('instructions')?.scrollIntoView({behavior:'smooth'});break;case'start':start();break;case'answer':advance('answered');break;case'alternative':alternative();break;case'adapt':adapt();break;case'favorite':state.fav=!state.fav;setText('favorite',state.fav?'♥':'♡');break;case'save-insight':insight();break;
      case'new-alternative':alternative();break;case'use-alternative':showEl('alternativeModal',false);advance('skipped');break;case'close-alternative':showEl('alternativeModal',false);break;case'roll':roll();break;case'continue-tarot':toTarot();break;case'draw-tarot':draw();break;case'retry-tarot':lastTarot?enhanceTarot(lastTarot).catch(e=>toast(friendly(e))):draw();break;
      case'clear-tarot':if($('spread'))$('spread').innerHTML='';showEl('reading',false);showEl('toClosing',false);state.tarotData=null;save();break;case'build-closing':closing();break;case'restart':sessionStorage.removeItem('primeira-faisca-v8-2');state=blank();show('home',true);break;
      case'connect-ai':await connect();break;case'disconnect-ai':disconnect();break;case'open-ai':show('setup');setTimeout(()=>$('aiPanel')?.scrollIntoView({behavior:'smooth'}),100);break;case'open-host':showEl('hostModal',true);break;case'close-host':showEl('hostModal',false);break;case'ask-host':await askHost();break;case'refine-synthesis':await refineSynthesis();break;case'refine-closing':await refineClosing();break;case'toggle-music':if(spotifyController)spotifyController.togglePlay();break;
    }
  }
  function bind(){document.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(!target)return;event.preventDefault();action(target.dataset.action).catch(error=>{console.error(error);toast('O comando não pôde ser concluído.');});});document.querySelectorAll('#levels button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('#levels button').forEach(x=>x.classList.remove('active'));button.classList.add('active');}));$('geminiModel')?.addEventListener('change',event=>model=event.target.value);}
  function spotify(){window.onSpotifyIframeApiReady=API=>API.createController($('spotifyEmbed'),{width:'100%',height:152,uri:'spotify:playlist:3OkkVMtZSxmRuD4BIlDQkf'},controller=>{spotifyController=controller;controller.addListener('ready',()=>setText('musicStatus','Playlist pronta.'));});const script=document.createElement('script');script.src='https://open.spotify.com/embed/iframe-api/v1';script.async=true;script.onerror=()=>setText('musicStatus','Não foi possível carregar o Spotify.');document.body.appendChild(script);}
  function audit(){const actions=[...document.querySelectorAll('[data-action]')].map(e=>e.dataset.action),known=new Set(['go-home','go-setup','go-current','go-kit','go-credits','go-chemistry','scroll-instructions','start','answer','alternative','adapt','favorite','save-insight','new-alternative','use-alternative','close-alternative','roll','continue-tarot','draw-tarot','retry-tarot','clear-tarot','build-closing','restart','connect-ai','disconnect-ai','open-ai','open-host','close-host','ask-host','refine-synthesis','refine-closing','toggle-music']),unknown=[...new Set(actions.filter(a=>!known.has(a)))],ids={};document.querySelectorAll('[id]').forEach(e=>ids[e.id]=(ids[e.id]||0)+1);const duplicates=Object.entries(ids).filter(([,n])=>n>1).map(([id])=>id),badCards=CARDS.filter(c=>!c.q.trim()||!c.w.trim()||!c.h.trim());console.info('Auditoria v8.2',{unknownActions:unknown,duplicateIds:duplicates,badCards:badCards.length,cards:CARDS.length,tarot:tarotDeck.length});if(unknown.length||duplicates.length||badCards.length)host('Auditoria','Uma inconsistência foi detectada. Atualize a página.','modo de segurança');}
  function restoreUI(){if(state.p1)$('p1').value=state.p1;if(state.p2)$('p2').value=state.p2;if(state.currentView==='session'&&state.deck.length)renderCard();if(state.tarotData)renderReading(state.tarotData,'Sessão restaurada');if(state.closing)renderClosing(state.closing);show(state.currentView||'home',true);}

  restore();bind();audit();restoreUI();spotify();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
})();