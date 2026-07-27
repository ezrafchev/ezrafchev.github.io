function startGame(){
  const p1=$('p1').value.trim(),p2=$('p2').value.trim();
  if(!p1||!p2){safeText('setupError','Preencha os dois nomes para iniciar.');return;}
  state={...state,p1,p2,level:Number(document.querySelector('#levels .option.on')?.dataset.value||2),total:Number($('duration').value),hostStyle:$('hostStyle').value,deck:[],index:0,answered:0,skipped:0,favorites:0,spark:0,fav:false,categories:{},phaseStats:{},insights:[],favoriteCards:[],lastDice:'',currentPhase:'',journeySynthesis:'',phaseNarrations:{},startedAt:Date.now()};
  state.deck=buildJourney();phases.forEach(p=>state.phaseStats[p.id]={seen:0,answered:0,skipped:0});
  if(!state.deck.length){safeText('setupError','Não foi possível montar o baralho. Atualize a página.');return;}
  safeText('setupError','');show('game');renderCard();announcePhase(currentPhase(),true);
}
function renderCard(){
  if(state.index>=state.deck.length){finishGame();return;}
  const card=currentCard(),phase=currentPhase();state.fav=false;
  $('favorite').textContent='♡';$('favorite').classList.remove('on');
  safeText('categoryBadge',`${ICONS[card.c]||'◌'} ${title(card.c)}`);
  safeText('levelBadge',`Nível ${card.l}`);
  safeText('turn',`Vez de ${state.index%2===0?state.p1:state.p2}`);
  safeText('questionText',card.q,'Compartilhem algo importante sobre o tema.');
  safeText('cardReason',card.w,defaultReasons[card.c]||defaultReasons.conversa);
  safeText('answerGuide',card.h,defaultGuides[card.c]||defaultGuides.conversa);
  safeText('consentNote',card.d?'Atividade compartilhada: conversem antes, adaptem livremente e só realizem com concordância clara.':'Respondam apenas no nível de detalhe confortável para os dois.');
  safeText('roundMeta',`${state.index+1} de ${state.deck.length}`);
  $('progressBar').style.width=`${(state.index/state.deck.length)*100}%`;
  safeText('phaseIcon',phase.icon);safeText('phaseTitle',phase.title);safeText('phaseDescription',phase.description);$('insightInput').value='';renderPhaseRail();
  if(!$('answerGuide').textContent.trim())safeText('answerGuide',defaultGuides[card.c]||defaultGuides.conversa);
}
function localReaction(card,kind){
  if(kind==='skipped')return 'A alternativa preserva o ritmo sem transformar exposição em obrigação.';
  const reactions={conversa:'A conversa ganhou um ponto concreto para continuar.',afinidade:'A resposta revelou uma preferência que ajuda a entender compatibilidade.',vinculo:'A jornada registrou um sinal de confiança, limite ou necessidade.',romance:'O tema romântico foi nomeado sem pressupor o sentimento do outro.',faisca:'A proximidade foi tratada como preferência e escolha conjunta.',desafio:'A experiência transformou conversa em uma pequena memória compartilhada.'};
  return reactions[card.c]||'A resposta foi incorporada ao percurso da sessão.';
}
function advance(kind){
  const card=currentCard(),previousPhase=card.phaseId;state.categories[card.c]=(state.categories[card.c]||0)+1;state.phaseStats[card.phaseId].seen++;
  if(kind==='answered'){state.answered++;state.spark+=card.d?2:1;state.phaseStats[card.phaseId].answered++;}else{state.skipped++;state.phaseStats[card.phaseId].skipped++;}
  if(state.fav){state.favorites++;state.favoriteCards.push(card.q);}state.index++;
  if(state.index>=state.deck.length){finishGame();return;}
  const nextPhase=currentCard().phaseId;renderCard();
  if(previousPhase!==nextPhase)announcePhase(currentPhase(),false,phases.find(p=>p.id===previousPhase));else setHost('Dealer da jornada',localReaction(card,kind));
}
function localAdapt(card){return{question:`${card.q.replace(/\?$/,'')} — responda de forma geral, usando apenas um exemplo confortável?`,reason:card.w,guide:'Escolha somente uma parte da pergunta, responda com um exemplo simples e deixe de fora qualquer detalhe que não queira compartilhar.',note:card.d?'A atividade pode ser reduzida, trocada ou convertida apenas em conversa.':'A versão adaptada mantém o objetivo sem exigir aprofundamento.'};}
async function adaptCurrent(){
  const card=currentCard();if(!card)return;const fallback=localAdapt(card);applyAdaptation(fallback);setHost('Mediadora',`A pergunta foi suavizada sem perder o objetivo da etapa ${currentPhase().title}.`);
  if(!geminiKey){toast('Adaptação local aplicada. Conecte o Gemini para uma mediação contextual.');return;}
  const button=$('adapt');button.disabled=true;setHost('Mediadora','A mediadora está ajustando a pergunta ao contexto da jornada…','Gemini pensando');
  try{
    const schema={type:'object',required:['question','reason','guide','note'],properties:{question:{type:'string'},reason:{type:'string'},guide:{type:'string'},note:{type:'string'}}};
    const prompt=`Adapte uma carta do jogo Primeira Faísca. Preserve a intenção, reduza exposição e mantenha uma pergunta clara.\nEtapa: ${currentPhase().title}.\nCategoria: ${card.c}.\nPergunta original: ${card.q}\nMotivo: ${card.w}\nGuia original: ${card.h}\nIntensidade: ${state.level}.\nEstilo da anfitriã: ${state.hostStyle}.`;
    const result=await generateStructured(prompt,schema,{maxOutputTokens:900,thinkingLevel:'medium',system:hostSystem('mediadora')});
    applyAdaptation(result);setHost('Mediadora',result.note,'Gemini conectado');
  }catch(error){applyAdaptation(fallback);setHost('Mediadora','A adaptação local foi mantida porque a IA não respondeu corretamente.','fallback local');toast(error.message.slice(0,130));}
  finally{button.disabled=false;}
}
function applyAdaptation(data){safeText('questionText',data.question);safeText('cardReason',data.reason,currentCard()?.w);safeText('answerGuide',data.guide,defaultGuides[currentCard()?.c]||defaultGuides.conversa);safeText('consentNote',data.note);}
function saveInsight(){const value=$('insightInput').value.trim();if(!value){toast('Escreva um insight antes de guardar.');return;}if(state.insights.length>=12){toast('Limite de 12 insights alcançado.');return;}state.insights.push(value);$('insightInput').value='';setHost('Narradora',`Insight ${state.insights.length} guardado. Ele será usado na síntese e no Tarô.`);toast('Insight guardado.');}
function openSkip(){pickAlternative();$('skipModal').classList.remove('hidden');}
function pickAlternative(){safeText('alternative',ALT_BANK[Math.floor(Math.random()*ALT_BANK.length)]);}
function finishGame(){
  safeText('answeredStat',state.answered);safeText('skippedStat',state.skipped);safeText('favStat',state.favorites);safeText('sparkStat',state.spark);
  safeText('resultText',`${state.p1} e ${state.p2} concluíram ${state.deck.length} cartas em cinco etapas conectadas.`);
  $('phaseSummary').innerHTML=phases.map(phase=>{const stat=state.phaseStats[phase.id]||{};return `<div class="summaryRow"><b>${phase.icon} ${phase.title}</b><span>${stat.answered||0} respondidas · ${stat.skipped||0} alternativas</span></div>`;}).join('');
  $('insightSummary').innerHTML=state.insights.length?state.insights.map(item=>`<div class="insightPill">${escapeHtml(item)}</div>`).join(''):'<p class="muted">Nenhum insight foi registrado. A síntese ainda usará o percurso e as favoritas.</p>';
  state.journeySynthesis=localSynthesis();safeText('journeySynthesis',state.journeySynthesis);show('result');setHost('Narradora da jornada','A sessão foi organizada. O próximo passo lógico é criar um símbolo com os dados e então interpretar o conjunto.');
}
function localSynthesis(){const top=topCategory();return `A jornada avançou por cinco etapas, com ${state.answered} respostas e ${state.skipped} alternativas. ${top?`A categoria mais presente foi ${title(top)}. `:''}${state.insights.length?`${state.insights.length} insights foram guardados. `:''}O fechamento deve transformar esses sinais em uma conversa prática, sem tratar estatísticas como diagnóstico.`;}
async function generateSynthesis(){
  const fallback=localSynthesis();safeText('journeySynthesis',fallback);if(!geminiKey){toast('Síntese local exibida. Conecte a IA para aprofundar.');return;}
  const button=$('generateSynthesis');button.disabled=true;button.textContent='Gerando…';setHost('Narradora','A narradora está conectando etapas, favoritas e insights…','Gemini pensando');
  try{
    const schema={type:'object',required:['summary','bridge'],properties:{summary:{type:'string'},bridge:{type:'string'}}};
    const result=await generateStructured(`${journeyContext()}\nProduza uma síntese cuidadosa da jornada e uma ponte lógica para os dados e o Tarô. Não diagnostique a relação e não presuma sentimentos.`,schema,{maxOutputTokens:1400,thinkingLevel:'high',system:hostSystem('narradora')});
    state.journeySynthesis=result.summary;safeText('journeySynthesis',`${result.summary}\n\n${result.bridge}`);setHost('Narradora',result.bridge,'Gemini conectado');
  }catch(error){safeText('journeySynthesis',fallback);toast('A síntese local foi mantida.');setHost('Narradora','A síntese local preservou a sequência da experiência.','fallback local');}
  finally{button.disabled=false;button.textContent='Gerar síntese com IA';}
}

const dice={action:['Dar as mãos','Abraço confortável','Contato visual','Dança curta','Carinho nas mãos','Gesto escolhido juntos'],time:['5 segundos','10 segundos','15 segundos','20 segundos','30 segundos','45 segundos'],mood:['divertido','carinhoso','calmo','romântico','criativo','como surpresa conjunta']};
function diceInterpretation(action,time,mood){return `O resultado combina ${action.toLowerCase()} com um intervalo de ${time}, em clima ${mood}. Ele funciona como um símbolo de coordenação: os dois podem aceitar, adaptar ou escolher outra combinação antes de guardar o resultado.`;}
function rollDice(){
  ['dieAction','dieTime','dieMood'].forEach(id=>{const el=$(id);el.classList.remove('rolling');void el.offsetWidth;el.classList.add('rolling');});
  const a=Math.floor(Math.random()*6),t=Math.floor(Math.random()*6),m=Math.floor(Math.random()*6);
  setTimeout(()=>{$('dieAction').querySelector('.dieNum').textContent=a+1;$('dieAction').querySelector('b').textContent=dice.action[a];$('dieTime').querySelector('.dieNum').textContent=t+1;$('dieTime').querySelector('b').textContent=dice.time[t];$('dieMood').querySelector('.dieNum').textContent=m+1;$('dieMood').querySelector('b').textContent=title(dice.mood[m]);const combo=`${dice.action[a]} por ${dice.time[t]}, de modo ${dice.mood[m]}.`;safeText('diceCombo',combo);safeText('diceMeaning',diceInterpretation(dice.action[a],dice.time[t],dice.mood[m]));safeText('diceSaved','');setHost('Dealer do ritual',`Os dados propõem: ${combo} A escolha continua sendo dos dois.`);},430);
}
function saveDice(){state.lastDice=$('diceCombo').textContent.trim();safeText('diceSaved','✓ Resultado guardado e integrado ao contexto do Tarô.');setHost('Narradora',`O símbolo final foi guardado: ${state.lastDice}`);toast('Resultado guardado.');}

