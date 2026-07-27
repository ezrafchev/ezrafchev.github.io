function journeyContext(){
  const phaseText=phases.map(phase=>{const stat=state.phaseStats[phase.id]||{};return `${phase.title}: ${stat.answered||0} respondidas, ${stat.skipped||0} alternativas`;}).join('; ');
  return `Participantes: ${state.p1&&state.p2?`${state.p1} e ${state.p2}`:'não informados'}.\nIntensidade: ${state.level}.\nEtapas: ${phaseText}.\nTotal: ${state.answered} respondidas, ${state.skipped} alternativas, ${state.favorites} favoritas, ${state.spark} faíscas.\nCategoria predominante: ${topCategory()||'não identificada'}.\nFavoritas: ${state.favoriteCards.length?state.favoriteCards.join(' | '):'nenhuma'}.\nInsights: ${state.insights.length?state.insights.join(' | '):'nenhum'}.\nDados: ${state.lastDice||'não utilizado'}.\nSíntese: ${state.journeySynthesis||'não gerada'}.`;
}
function renderAutoContext(){const parts=[];if(state.p1&&state.p2)parts.push(`${state.p1} + ${state.p2}`);if(state.answered||state.skipped)parts.push(`${state.answered} respondidas`,`${state.skipped} alternativas`);if(state.insights.length)parts.push(`${state.insights.length} insights`);if(state.lastDice)parts.push('dados salvos');safeText('autoContext',parts.length?`Contexto automático: ${parts.join(' · ')}.`:'A leitura ainda não possui uma jornada anterior; usará apenas a pergunta e as cartas.');}

function hostSystem(role){
  const style={elegante:'linguagem elegante, clara e precisa',leve:'linguagem leve, acolhedora e bem-humorada',mistica:'linguagem contemplativa, simbólica e sóbria'}[state.hostStyle]||'linguagem clara e precisa';
  return `Você integra o jogo para casais Primeira Faísca como ${role}. Use ${style}. Sua função é organizar a experiência, não participar romanticamente dela. Não pressione, não sexualize, não incentive substâncias e não trate símbolos como fatos. Preserve consentimento, autonomia e coerência entre as etapas. Responda em português do Brasil.`;
}
async function announcePhase(phase,isFirst,previous){
  const local=isFirst?`A jornada começa em ${phase.title}. ${phase.description}`:`A etapa ${previous?.title||'anterior'} foi concluída. Agora ${phase.title} aprofunda o que já apareceu: ${phase.description}`;
  setHost('Dealer da jornada',local);
  if(!geminiKey||state.phaseNarrations[phase.id])return;state.phaseNarrations[phase.id]=true;
  try{
    const schema={type:'object',required:['message'],properties:{message:{type:'string'}}};
    const result=await generateStructured(`${journeyContext()}\nCrie uma transição de 45 a 80 palavras para iniciar a etapa ${phase.title}. Explique por que ela vem agora e como o casal deve abordá-la.`,schema,{maxOutputTokens:500,thinkingLevel:'low',system:hostSystem('dealer da jornada')});
    setHost('Dealer da jornada',result.message,'Gemini conectado');
  }catch{setHost('Dealer da jornada',local,'fallback local');}
}

async function listModels(key){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':key}});
  const data=await response.json();if(!response.ok)throw new Error(data?.error?.message||`Erro ${response.status}`);
  return (data.models||[]).filter(model=>(model.supportedGenerationMethods||[]).includes('generateContent')&&/gemini/i.test(model.name||''));
}
function modelId(model){return String(model.name||'').replace(/^models\//,'');}
function rankModel(model){const id=modelId(model);let score=0;if(/flash/i.test(id))score+=50;if(/^gemini-3\.6-flash/.test(id))score+=60;else if(/^gemini-3\.5-flash/.test(id))score+=55;else if(/^gemini-3/.test(id))score+=45;else if(/2\.5-flash/.test(id))score+=40;if(/lite/i.test(id))score-=12;if(/image|live|audio|tts/i.test(id))score-=100;score+=Math.min(20,(model.outputTokenLimit||0)/4000);return score;}
function chooseModels(models){return [...models].filter(model=>!(/image|live|audio|tts/i.test(modelId(model)))).sort((a,b)=>rankModel(b)-rankModel(a)).slice(0,15);}
function selectedModel(){return $('geminiModel').value||'';}
function supportsThinking(model){const meta=modelMeta.get(model);return Boolean(meta?.thinking)||/^gemini-3/.test(model)||/gemini-2\.5/.test(model);}
function outputLimit(model){return modelMeta.get(model)?.outputTokenLimit||8192;}
async function connectAI(){
  const key=$('geminiKey').value.trim();if(key.length<20){setAIState('Chave inválida.','error');return;}
  geminiKey=key;setAIState('Consultando modelos…');$('connectAI').disabled=true;
  try{
    const available=chooseModels(await listModels(key));if(!available.length)throw new Error('Nenhum modelo compatível foi encontrado.');
    modelMeta=new Map(available.map(model=>[modelId(model),model]));$('geminiModel').innerHTML=available.map((model,index)=>`<option value="${escapeHtml(modelId(model))}" ${index===0?'selected':''}>${escapeHtml(model.displayName||modelId(model))}</option>`).join('');
    await callGeminiRaw('Responda apenas com CONECTADO.',{maxOutputTokens:30,thinkingLevel:'minimal',system:'Responda exatamente como solicitado.'});
    setAIState(`Conectado a ${selectedModel()}.`,'connected');$('geminiKey').value='';$('hostAIState').textContent='Gemini conectado';setHost('Dealer da jornada','A IA está pronta para mediar perguntas, narrar transições, sintetizar a jornada e interpretar o Tarô.','Gemini conectado');toast('Gemini conectado.');
  }catch(error){geminiKey='';modelMeta.clear();setAIState(`Falha: ${error.message}`,'error');$('hostAIState').textContent='modo local';}
  finally{$('connectAI').disabled=false;}
}
function disconnectAI(){geminiKey='';modelMeta.clear();$('geminiKey').value='';$('geminiModel').innerHTML='<option value="">Conecte para listar modelos</option>';setAIState('IA desconectada.');$('hostAIState').textContent='modo local';setHost('Dealer da jornada','O jogo continua funcionando com inteligência local e respostas de fallback.','modo local');}
async function callGeminiRaw(prompt,{schema=null,maxOutputTokens=1500,thinkingLevel='medium',system='',history=[]}={}){
  if(!geminiKey)throw new Error('Gemini não conectado.');const model=selectedModel();if(!model)throw new Error('Nenhum modelo selecionado.');
  const limit=Math.max(50,Math.min(maxOutputTokens,outputLimit(model)));
  const generationConfig={maxOutputTokens:limit};
  if(schema){generationConfig.responseMimeType='application/json';generationConfig.responseJsonSchema=schema;}
  if(supportsThinking(model)&&thinkingLevel)generationConfig.thinkingConfig={thinkingLevel};
  const contents=[...history,{role:'user',parts:[{text:prompt}]}];
  const body={contents,generationConfig};if(system)body.systemInstruction={parts:[{text:system}]};
  const request=async payload=>{const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},body:JSON.stringify(payload)});let data={};try{data=await response.json();}catch{}if(!response.ok)throw Object.assign(new Error(data?.error?.message||`Erro ${response.status}`),{status:response.status});return data;};
  let data;
  try{data=await request(body);}catch(firstError){
    if(firstError.status!==400)throw firstError;
    if(generationConfig.thinkingConfig)delete generationConfig.thinkingConfig;
    try{data=await request(body);}catch(secondError){
      if(secondError.status!==400||!schema)throw secondError;
      delete generationConfig.responseJsonSchema;generationConfig.responseMimeType='application/json';
      body.contents[body.contents.length-1].parts[0].text=`Retorne somente JSON válido obedecendo a este esquema: ${JSON.stringify(schema)}.\n\n${prompt}`;
      data=await request(body);
    }
  }
  const candidate=data?.candidates?.[0],text=candidate?.content?.parts?.map(part=>part.text||'').join('').trim();if(!text)throw new Error(`A IA não retornou conteúdo. Motivo: ${candidate?.finishReason||'desconhecido'}.`);
  return{text,finishReason:candidate?.finishReason||'desconhecido',usage:data.usageMetadata||{}};
}
function parseJSONLoose(text){const clean=String(text).trim().replace(/^```json\s*/i,'').replace(/^```/,'').replace(/```$/,'').trim();return JSON.parse(clean);}
async function generateStructured(prompt,schema,options={}){const response=await callGeminiRaw(prompt,{...options,schema});const parsed=parseJSONLoose(response.text);for(const key of schema.required||[]){if(parsed?.[key]===undefined||parsed?.[key]===null||String(parsed[key]).trim()==='')throw new Error(`Resposta estruturada sem o campo ${key}.`);}return parsed;}

function localHostAnswer(question){
  const q=question.toLowerCase();if(q.includes('como')||q.includes('regra'))return 'A ordem é: configurar, responder as cinco etapas, guardar insights, concluir, rolar os dados e finalizar com o Tarô. Adaptar preserva a intenção da carta; alternativa troca a pergunta sem punição.';
  if(q.includes('tarô')||q.includes('tarot'))return 'O Tarô recebe a pergunta, as três cartas, as posições e os sinais da jornada. Ele serve para organizar reflexão e próximos passos, não para provar sentimentos ocultos ou prever fatos.';
  if(q.includes('dado'))return 'Os dados produzem ação, duração e clima. O resultado só entra no Tarô quando vocês escolhem guardá-lo.';
  if(q.includes('adapt'))return 'Adaptar reduz exposição ou complexidade sem mudar o objetivo editorial da carta.';
  return `A etapa atual é ${currentPhase().title}. ${currentPhase().description} Use a pergunta para conversar sobre fatos e preferências próprias, sem tentar adivinhar o outro.`;
}
async function askHostQuestion(){
  const question=$('hostQuestion').value.trim();if(!question){toast('Escreva uma pergunta.');return;}const reply=$('hostReply');reply.textContent=localHostAnswer(question);reply.classList.add('loading');
  if(!geminiKey){reply.classList.remove('loading');return;}
  $('sendHostQuestion').disabled=true;setHost('Anfitriã da jornada','A anfitriã está organizando uma resposta contextual…','Gemini pensando');
  try{const response=await callGeminiRaw(`${journeyContext()}\nEtapa atual: ${currentPhase().title}.\nPergunta do casal sobre o jogo: ${question}\nResponda em 100 a 220 palavras, explicando a lógica e indicando uma ação prática.`,{maxOutputTokens:700,thinkingLevel:'medium',system:hostSystem('anfitriã e guia de regras')});reply.textContent=response.text;setHost('Anfitriã da jornada','A dúvida foi respondida com base no estado atual da experiência.','Gemini conectado');}
  catch{reply.textContent=localHostAnswer(question);setHost('Anfitriã da jornada','A resposta local foi usada porque a IA estava indisponível.','fallback local');}
  finally{reply.classList.remove('loading');$('sendHostQuestion').disabled=false;}
}

const tarotSchema={type:'object',required:['visaoGeral','respostaPergunta','posicoes','combinacao','dimensoes','pontoAtencao','planoPratico','perguntaFinal'],properties:{
  visaoGeral:{type:'string'},respostaPergunta:{type:'string'},
  posicoes:{type:'array',minItems:3,maxItems:3,items:{type:'object',required:['posicao','carta','interpretacao','potencial','sombra','convite'],properties:{posicao:{type:'string'},carta:{type:'string'},interpretacao:{type:'string'},potencial:{type:'string'},sombra:{type:'string'},convite:{type:'string'}}}},
  combinacao:{type:'string'},dimensoes:{type:'object',required:['atracao','carinho','confianca','comunicacao','expectativas','intencao'],properties:{atracao:{type:'string'},carinho:{type:'string'},confianca:{type:'string'},comunicacao:{type:'string'},expectativas:{type:'string'},intencao:{type:'string'}}},
  pontoAtencao:{type:'string'},planoPratico:{type:'array',minItems:3,maxItems:5,items:{type:'string'}},perguntaFinal:{type:'string'}
}};
