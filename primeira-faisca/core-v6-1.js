'use strict';

const $=id=>document.getElementById(id);
const escapeHtml=(value='')=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[char]));
const title=value=>value?String(value).charAt(0).toUpperCase()+String(value).slice(1):'';
const shuffle=input=>{const arr=[...input];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function prepareDOM(){
  document.querySelectorAll('[id="how"]').forEach(el=>{el.id=el.closest('#game')?'answerGuide':'instructions';});
  const oldQuestion=$('question');if(oldQuestion)oldQuestion.id='questionText';
  const oldReason=$('why');if(oldReason)oldReason.id='cardReason';
  const heroVersion=document.querySelector('#home .hero .eyebrow');if(heroVersion)heroVersion.textContent='✦ Edição Couple · v6.0';
  const credits=document.querySelector('#credits .credits p');if(credits)credits.textContent='Conceito, direção criativa e autoria de Primeira Faísca. Edição Couple v6.0 com jornada inteligente, dealer por IA, mediação, dados, música e Tarô Cigano contextual.';
  const header=document.querySelector('.topbar');
  if(header&&!$('hostDock'))header.insertAdjacentHTML('afterend',`<aside class="hostDock" id="hostDock" aria-live="polite"><div class="hostAvatar" aria-hidden="true">✦</div><div class="hostContent"><div class="hostMeta"><b id="hostRole">Dealer da jornada</b><span id="hostAIState">modo local</span></div><p id="hostMessage">A anfitriã organiza a experiência e conecta os mecanismos.</p></div><div class="hostActions"><button class="btn compact secondary" id="askHost">Perguntar</button><button class="btn compact primary" id="openAIConfig">Configurar IA</button></div></aside>`);
  const setupPanel=document.querySelector('#setup .grid .panel:nth-child(2)');
  if(setupPanel&&!$('hostStyle'))setupPanel.insertAdjacentHTML('beforeend',`<div class="field"><label for="hostStyle">Estilo da anfitriã</label><select id="hostStyle"><option value="elegante">Elegante e precisa</option><option value="leve">Leve e divertida</option><option value="mistica">Mística e contemplativa</option></select></div>`);
  const instructions=$('instructions');
  if(instructions)instructions.innerHTML=`<div class="sectionHead"><span class="eyebrow">Instruções completas</span><h2>Como jogar sem perder a lógica.</h2><p>Cada recurso produz informações para o próximo.</p></div><div class="instructionGrid"><article class="instructionCard"><span>1</span><h3>Preparem</h3><p>Informem nomes, duração e intensidade. A IA pode ser conectada antes ou durante a jornada.</p></article><article class="instructionCard"><span>2</span><h3>Respondam em ordem</h3><p>As cartas avançam por Abertura, Descoberta, Conexão, Romance e Experiência.</p></article><article class="instructionCard"><span>3</span><h3>Usem as decisões</h3><p>Responder avança; Adaptar preserva a intenção; Alternativa troca a pergunta por uma atividade acordada.</p></article><article class="instructionCard"><span>4</span><h3>Guardem sinais</h3><p>Favoritas e insights formam a memória da sessão e entram na síntese.</p></article><article class="instructionCard"><span>5</span><h3>Façam o ritual</h3><p>Os dados combinam ação, duração e clima e podem ser guardados para o Tarô.</p></article><article class="instructionCard"><span>6</span><h3>Finalizem com sentido</h3><p>O Tarô reúne percurso, pergunta e símbolos em leitura, atenção e plano prático.</p></article></div><div class="panel rulePanel"><h3>Regra central</h3><p>Nenhuma pergunta ou atividade exige justificativa. Adaptar, trocar ou interromper faz parte do jogo.</p></div><div class="sectionHead"><span class="eyebrow">Inteligência da experiência</span><h2>Uma IA, quatro funções.</h2></div><div class="roleGrid"><article class="roleCard"><span>♠</span><div><b>Dealer</b><p>Apresenta etapas e controla o ritmo.</p></div></article><article class="roleCard"><span>◇</span><div><b>Mediadora</b><p>Adapta perguntas sem perder a intenção.</p></div></article><article class="roleCard"><span>○</span><div><b>Narradora</b><p>Cria pontes e sintetiza o percurso.</p></div></article><article class="roleCard"><span>☾</span><div><b>Cigana simbólica</b><p>Interpreta o Lenormand como reflexão.</p></div></article></div>`;
  const resultFlow=document.querySelector('#result .nextFlow');
  if(resultFlow&&!$('journeySynthesis'))resultFlow.insertAdjacentHTML('beforebegin',`<div class="panel hostSummary"><div><span class="eyebrow">Narradora</span><h3>Ponte para o fechamento</h3><p id="journeySynthesis">A síntese inteligente ficará disponível após a conclusão.</p></div><button class="btn secondary" id="generateSynthesis">Gerar síntese com IA</button></div>`);
  const diceCombo=$('diceCombo');if(diceCombo&&!$('diceMeaning'))diceCombo.insertAdjacentHTML('afterend','<p id="diceMeaning">O significado do resultado aparecerá após a rolagem.</p>');
  if(!$('hostModal'))document.body.insertAdjacentHTML('beforeend',`<div class="modal hidden" id="hostModal" role="dialog" aria-modal="true" aria-labelledby="hostModalTitle"><div class="modalBox wideModal"><div class="modalHead"><div><span class="eyebrow">Anfitriã da jornada</span><h3 id="hostModalTitle">Pergunte sobre a experiência</h3></div><button class="iconButton" id="closeHost" aria-label="Fechar">×</button></div><div class="field"><label for="hostQuestion">Pergunta</label><textarea id="hostQuestion" maxlength="500" rows="4" placeholder="Ex.: Por que esta etapa vem antes do romance?"></textarea></div><button class="btn primary wide" id="sendHostQuestion">Perguntar à anfitriã</button><div class="hostReply" id="hostReply">A resposta aparecerá aqui.</div></div></div>`);
  const aiState=$('aiState');if(aiState)aiState.id='aiStateLine';
  const adapt=$('adapt');if(adapt)adapt.textContent='Adaptar com a mediadora';
  const skip=$('skip');if(skip)skip.textContent='Alternativa';
  const answer=$('answer');if(answer)answer.textContent='Respondido · continuar';
}

const phases=[
  {id:'abertura',icon:'○',title:'Abertura',description:'Reduzir tensão, criar presença e iniciar por temas simples.',cats:['conversa']},
  {id:'descoberta',icon:'◎',title:'Descoberta',description:'Entender hábitos, preferências e compatibilidade prática.',cats:['afinidade']},
  {id:'conexao',icon:'◇',title:'Conexão',description:'Aprofundar confiança, apoio, limites e segurança emocional.',cats:['vinculo']},
  {id:'romance',icon:'♥',title:'Romance',description:'Nomear afeto, interesse e formas confortáveis de proximidade.',cats:['romance','faisca']},
  {id:'experiencia',icon:'↗',title:'Experiência',description:'Transformar conversa em uma atividade compartilhada e consentida.',cats:['desafio']}
];

const phaseFallbackCats={abertura:['conversa'],descoberta:['afinidade','conversa'],conexao:['vinculo','afinidade'],romance:['romance','faisca','afinidade'],experiencia:['desafio']};
const defaultReasons={conversa:'A pergunta cria presença e oferece uma entrada simples para a conversa.',afinidade:'A resposta ajuda a perceber preferências e compatibilidade prática.',vinculo:'O tema favorece compreensão emocional e comunicação mais clara.',romance:'A carta nomeia interesse e afeto sem transformar percepção em obrigação.',faisca:'A pergunta explora proximidade e curiosidade de forma respeitosa.',desafio:'A atividade converte conversa em uma pequena experiência compartilhada.'};
const defaultGuides={conversa:'Escolha um exemplo específico, conte o que aconteceu e explique por que isso foi importante.',afinidade:'Diga sua preferência principal e use uma situação real para mostrar como ela funciona.',vinculo:'Responda apenas no nível confortável, descrevendo atitudes concretas que ajudam ou dificultam.',romance:'Fale sobre sua própria preferência e evite presumir o que a outra pessoa sente.',faisca:'Descreva uma forma de proximidade confortável e as condições que tornam a experiência positiva.',desafio:'Conversem antes, combinem uma versão confortável e só realizem a atividade com concordância clara.'};

const RAW_CARDS=typeof cards!=='undefined'&&Array.isArray(cards)?cards:[];
const CARD_BANK=RAW_CARDS.map((card,index)=>({
  ...card,
  id:`card-${index+1}`,
  c:card?.c||'conversa',
  l:clamp(Number(card?.l)||1,1,3),
  q:String(card?.q||'Compartilhem algo que gostariam de compreender melhor um sobre o outro.'),
  w:String(card?.w||defaultReasons[card?.c]||defaultReasons.conversa),
  h:String(card?.h||defaultGuides[card?.c]||defaultGuides.conversa),
  d:Boolean(card?.d)
}));
const ALT_BANK=typeof alternatives!=='undefined'&&Array.isArray(alternatives)&&alternatives.length?alternatives:[
  'Cada pessoa faz um elogio específico e sincero.',
  'Inventem uma pergunta nova e respondam os dois.',
  'Escolham uma música que represente o momento.',
  'Planejem uma atividade simples para outro dia.'
];
const LENORMAND=typeof lenormand!=='undefined'&&Array.isArray(lenormand)?lenormand:[];
const ICONS=typeof icons!=='undefined'&&icons&&typeof icons==='object'?icons:{};

let state={
  p1:'',p2:'',level:2,total:18,hostStyle:'elegante',deck:[],index:0,answered:0,skipped:0,
  favorites:0,spark:0,fav:false,categories:{},phaseStats:{},insights:[],favoriteCards:[],lastDice:'',
  currentPhase:'',journeySynthesis:'',phaseNarrations:{},startedAt:null
};
let deferredPrompt=null;
let geminiKey='';
let modelMeta=new Map();
let spotifyController=null;
let musicPlaying=false;
let userInteracted=false;
let lastTarotRequest=null;
let hostBusy=false;

function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600);}
function setHost(role,message,status){if($('hostRole'))$('hostRole').textContent=role;if($('hostMessage'))$('hostMessage').textContent=message;if($('hostAIState'))$('hostAIState').textContent=status||(geminiKey?'Gemini conectado':'modo local');}
function setAIState(message,kind=''){const el=$('aiStateLine');if(!el)return;el.textContent=message;el.className=`aiStateLine ${kind}`.trim();}
function setMusicStatus(message,kind=''){const el=$('musicStatus');if(!el)return;el.textContent=message;el.className=`musicStatus ${kind}`.trim();}
function currentCard(){return state.deck[state.index]||null;}
function currentPhase(){const card=currentCard();return phases.find(p=>p.id===card?.phaseId)||phases[0];}
function topCategory(){return Object.entries(state.categories).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';}
function safeText(id,value,fallback){const el=$(id);if(!el)return;if(value!==undefined&&value!==null){el.textContent=String(value).trim();return;}if(fallback!==undefined&&fallback!==null){el.textContent=String(fallback).trim();return;}el.textContent='Orientação indisponível.';}

function auditRuntime(){
  const idCounts={};document.querySelectorAll('[id]').forEach(el=>idCounts[el.id]=(idCounts[el.id]||0)+1);
  const duplicates=Object.entries(idCounts).filter(([,count])=>count>1).map(([id])=>id);
  const required=['home','setup','game','result','dice','tarot','questionText','cardReason','answerGuide','hostDock','hostMessage','startGame','drawTarot'];
  const missing=required.filter(id=>!$(id));
  const contentIssues=CARD_BANK.filter(card=>!card.q.trim()||!card.w.trim()||!card.h.trim());
  const report={duplicates,missing,contentIssues:contentIssues.length,cards:CARD_BANK.length,lenormand:LENORMAND.length};
  if(duplicates.length||missing.length||contentIssues.length)console.warn('Auditoria Primeira Faísca',report);else console.info('Auditoria Primeira Faísca aprovada',report);
  return report;
}

function viewHostMessage(view){
  const messages={
    home:['Dealer da jornada','A anfitriã apresenta as regras e mostra como cada mecanismo alimenta o seguinte.'],
    setup:['Dealer da jornada','Definam ritmo e intensidade. O sistema montará uma sequência, não um conjunto aleatório de perguntas.'],
    game:['Dealer da jornada',`${currentPhase().title}: ${currentPhase().description}`],
    result:['Narradora da jornada','O mapa da sessão organiza participação, favoritas e insights antes do ritual final.'],
    dice:['Dealer do ritual','Os dados criam um símbolo de ação, duração e clima; o resultado pode ser guardado para a leitura.'],
    tarot:['Cigana simbólica','A leitura usa o percurso como contexto, mas não transforma cartas em prova sobre pensamentos ou futuro.'],
    kit:['Guia do kit','Cada peça física corresponde a uma função do jogo digital.'],
    credits:['Guia da experiência','Primeira Faísca foi concebido e dirigido por Esdra Felipe.']
  };
  const [role,message]=messages[view]||messages.home;setHost(role,message);
}
function show(view){
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==view));
  document.querySelectorAll('.navbtn').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  const visible=$(view);if(visible){visible.classList.remove('viewPulse');void visible.offsetWidth;visible.classList.add('viewPulse');}
  window.scrollTo({top:0,behavior:'smooth'});if(view==='tarot')renderAutoContext();viewHostMessage(view);
}

function allocateCounts(total){if(total===12)return[3,2,3,2,2];if(total===24)return[5,5,5,5,4];return[4,4,4,4,2];}
function phasePool(phase){
  const cats=phaseFallbackCats[phase.id]||phase.cats;
  let pool=CARD_BANK.filter(card=>cats.includes(card.c)&&card.l<=state.level);
  if(!pool.length)pool=CARD_BANK.filter(card=>cats.includes(card.c)&&card.l<=Math.min(3,state.level+1));
  return pool;
}
function buildJourney(){
  const counts=allocateCounts(state.total),used=new Set(),deck=[];
  phases.forEach((phase,index)=>{
    const selected=[];
    for(const card of shuffle(phasePool(phase))){if(!used.has(card.id)){selected.push({...card,phaseId:phase.id});used.add(card.id);}if(selected.length===counts[index])break;}
    if(selected.length<counts[index]){
      for(const card of shuffle(CARD_BANK.filter(item=>item.l<=Math.min(3,state.level+1)))){if(!used.has(card.id)){selected.push({...card,phaseId:phase.id});used.add(card.id);}if(selected.length===counts[index])break;}
    }
    deck.push(...selected);
  });
  return deck.slice(0,state.total);
}
function renderPhaseRail(){
  const phaseId=currentCard()?.phaseId||'experiencia',currentIndex=phases.findIndex(p=>p.id===phaseId);
  $('phaseRail').innerHTML=phases.map((phase,index)=>`<div class="phaseDot ${index<currentIndex?'done':index===currentIndex?'active':''}"><b>${phase.icon}</b><span>${phase.title}</span></div>`).join('');
}
