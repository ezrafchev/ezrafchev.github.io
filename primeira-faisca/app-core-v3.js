const $=id=>document.getElementById(id);
const views=['home','setup','game','result','tarot','dice','kit','credits'];
let state={p1:'',p2:'',level:2,total:18,deck:[],index:0,answered:0,skipped:0,favorites:0,spark:0,fav:false,categories:{}};
let deferredPrompt=null;
function show(view){views.forEach(v=>$(v).classList.toggle('hidden',v!==view));document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2100);}
function title(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function startGame(){
const p1=$('p1').value.trim(),p2=$('p2').value.trim();
if(!p1||!p2){$('setupError').textContent='Preencha os dois nomes para iniciar.';return;}
state={...state,p1,p2,total:Number($('duration').value),deck:[],index:0,answered:0,skipped:0,favorites:0,spark:0,fav:false,categories:{}};
const eligible=cards.filter(x=>x.l<=state.level);
const questions=shuffle(eligible.filter(x=>!x.d));
const challenges=shuffle(eligible.filter(x=>x.d));
const targetChallenges=Math.max(3,Math.round(state.total*.28));
state.deck=shuffle([...questions.slice(0,state.total-targetChallenges),...challenges.slice(0,targetChallenges)]).slice(0,state.total);
$('setupError').textContent='';show('game');renderCard();
}
function renderCard(){
if(state.index>=state.deck.length){finishGame();return;}
const card=state.deck[state.index];state.fav=false;$('favorite').textContent='♡';$('favorite').classList.remove('on');
$('categoryBadge').textContent=`${icons[card.c]||'◌'} ${title(card.c)}`;
$('levelBadge').textContent=`Nível ${card.l}`;
$('turn').textContent=`Vez de ${state.index%2===0?state.p1:state.p2}`;
$('question').textContent=card.q;$('why').textContent=card.w;$('how').textContent=card.h;
$('consentNote').textContent=card.d?'Desafio de proximidade: só acontece com concordância clara dos dois. Adaptar também é uma resposta válida.':'Respondam no nível de detalhe que seja confortável para ambos.';
$('roundMeta').textContent=`${state.index+1} de ${state.deck.length}`;
$('progressBar').style.width=`${(state.index/state.deck.length)*100}%`;
}
function advance(kind){
const card=state.deck[state.index];state.categories[card.c]=(state.categories[card.c]||0)+1;
if(kind==='answered'){state.answered++;state.spark+=card.d?2:1;}
if(kind==='skipped')state.skipped++;
if(state.fav)state.favorites++;
state.index++;renderCard();
}
function adaptCurrent(){
const card=state.deck[state.index];
$('question').textContent=`Versão adaptada: ${card.q.replace(/\?$/,'')} — responda apenas com o que for confortável agora.`;
$('how').textContent='Vocês podem reduzir o nível de detalhe, trocar o exemplo ou responder de forma geral.';
toast('Pergunta adaptada.');
}
function openSkip(){pickAlternative();$('skipModal').classList.remove('hidden');}
function pickAlternative(){$('alternative').textContent=alternatives[Math.floor(Math.random()*alternatives.length)];}
function finishGame(){
$('progressBar').style.width='100%';$('answeredStat').textContent=state.answered;$('skippedStat').textContent=state.skipped;$('favStat').textContent=state.favorites;$('sparkStat').textContent=state.spark;
$('resultText').textContent=`${state.p1} e ${state.p2} concluíram ${state.deck.length} cartas. A leitura do Tarô Cigano já pode usar os sinais desta rodada.`;show('result');
}
function drawTarot(){
const selected=shuffle(lenormand).slice(0,3);const roles=['Clima atual','Ponte de conexão','Próximo passo'];
$('spread').innerHTML=selected.map((c,i)=>`<article class="lenormand"><span class="cardNumber">${String(c[0]).padStart(2,'0')}</span><div class="cardSymbol">${c[2]}</div><div class="cardName">${c[1]}</div><div class="cardRole">${roles[i]}</div></article>`).join('');
const q=$('tarotQuestion').value.trim();const topCat=Object.entries(state.categories).sort((a,b)=>b[1]-a[1])[0]?.[0];
const participation=state.answered+state.skipped?`Na rodada, vocês responderam ${state.answered} cartas e escolheram ${state.skipped} alternativas.`:'Esta leitura foi aberta sem uma rodada anterior.';
const sync=topCat?`A categoria mais presente foi ${title(topCat)}, então a interpretação enfatiza esse aspecto.`:'A leitura considera apenas a pergunta e a combinação das cartas.';
const text=`${participation} ${sync} ${selected[0][1]} aponta ${selected[0][4].toLowerCase()} ${selected[1][1]} sugere que a ponte entre vocês passa por ${selected[1][3]}. ${selected[2][1]} orienta o próximo passo: ${selected[2][4].toLowerCase()} ${q?`Em relação à pergunta “${q}”, usem as cartas como perspectivas para conversar, não como uma resposta definitiva.`:''}`;
$('readingText').textContent=text;
$('readingPrompt').textContent=`${selected[0][6]} Depois, conversem sobre: ${selected[1][6]} Para fechar, decidam juntos: ${selected[2][6]}`;
$('reading').classList.remove('hidden');
}
const dice={action:['Dar as mãos','Abraço confortável','Contato visual','Dança curta','Carinho nas mãos','Gesto escolhido juntos'],time:['5 segundos','10 segundos','15 segundos','20 segundos','30 segundos','45 segundos'],mood:['divertido','carinhoso','calmo','romântico','criativo','surpresa conjunta']};
function rollDice(){
const ids=['dieAction','dieTime','dieMood'];ids.forEach(id=>{const el=$(id);el.classList.remove('rolling');void el.offsetWidth;el.classList.add('rolling');});
const a=Math.floor(Math.random()*6),t=Math.floor(Math.random()*6),m=Math.floor(Math.random()*6);
setTimeout(()=>{
$('dieAction').querySelector('.dieNum').textContent=a+1;$('dieAction').querySelector('b').textContent=dice.action[a];
$('dieTime').querySelector('.dieNum').textContent=t+1;$('dieTime').querySelector('b').textContent=dice.time[t];
$('dieMood').querySelector('.dieNum').textContent=m+1;$('dieMood').querySelector('b').textContent=title(dice.mood[m]);
$('diceCombo').textContent=`${dice.action[a]} por ${dice.time[t]}, de modo ${dice.mood[m]}.`;
},420);
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
document.querySelectorAll('#levels .option').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#levels .option').forEach(x=>x.classList.remove('on'));b.classList.add('on');state.level=Number(b.dataset.value);}));
$('startGame').addEventListener('click',startGame);$('exitGame').addEventListener('click',()=>show('setup'));$('answer').addEventListener('click',()=>advance('answered'));$('adapt').addEventListener('click',adaptCurrent);$('skip').addEventListener('click',openSkip);
$('favorite').addEventListener('click',()=>{state.fav=!state.fav;$('favorite').textContent=state.fav?'♥':'♡';$('favorite').classList.toggle('on',state.fav);});
$('newAlternative').addEventListener('click',pickAlternative);$('cancelSkip').addEventListener('click',()=>$('skipModal').classList.add('hidden'));$('acceptAlternative').addEventListener('click',()=>{$('skipModal').classList.add('hidden');advance('skipped');});
$('playAgain').addEventListener('click',()=>show('setup'));$('kitInfo').addEventListener('click',()=>toast('O pacote STL completo foi entregue junto ao projeto.'));$('drawTarot').addEventListener('click',drawTarot);$('clearTarot').addEventListener('click',()=>{$('spread').innerHTML='';$('reading').classList.add('hidden');});$('rollDice').addEventListener('click',rollDice);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden');});
$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden');});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));