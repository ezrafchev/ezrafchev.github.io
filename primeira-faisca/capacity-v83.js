'use strict';
(() => {
  const nativeSlice=Array.prototype.slice;
  const phaseByCategory={conversa:'abertura',afinidade:'descoberta',vinculo:'conexao',romance:'romance',faisca:'romance',desafio:'experiencia'};
  const reasons={conversa:'Cria presença e abre a conversa.',afinidade:'Ajuda a perceber preferências e compatibilidade.',vinculo:'Favorece compreensão emocional e segurança.',romance:'Nomeia afeto e intimidade sem criar obrigação.',faisca:'Explora química e proximidade com respeito.',desafio:'Transforma conversa em uma memória compartilhada.'};
  const guides={conversa:'Conte um exemplo real e explique por que foi importante.',afinidade:'Diga sua preferência e mostre como ela aparece na prática.',vinculo:'Fale sobre atitudes concretas no nível de detalhe confortável.',romance:'Fale do que você sente e prefere, sem tentar adivinhar o outro.',faisca:'Descreva uma forma de proximidade confortável e o que cria segurança.',desafio:'Conversem antes, adaptem livremente e só realizem com concordância clara.'};
  const dynamics={conversa:'RESPOSTA DINÂMICA · cada pessoa responde e faz uma pergunta curta.',afinidade:'COMPARAÇÃO · encontrem uma semelhança e uma diferença.',vinculo:'ESCUTA · quem ouve resume antes de responder.',romance:'MEMÓRIA OU DESEJO · usem um exemplo concreto.',faisca:'CONFORTO PRIMEIRO · digam também o sinal para desacelerar.',desafio:'ATIVIDADE COMPARTILHADA · somente com concordância clara.'};
  const shuffle=source=>{const a=[...source];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const normalize=(card,index)=>({id:`v83-${index}`,c:card.c||'conversa',l:Math.max(1,Math.min(3,Number(card.l)||1)),q:String(card.q||'Compartilhem algo importante.'),w:reasons[card.c]||reasons.conversa,h:guides[card.c]||guides.conversa,r:dynamics[card.c]||'',d:Boolean(card.d),phaseId:phaseByCategory[card.c]||'abertura'});
  const allocate=(requested,pools)=>{
    const total=pools.reduce((sum,pool)=>sum+pool.length,0);
    const exact=pools.map(pool=>requested*pool.length/total);
    const counts=exact.map((value,index)=>Math.min(pools[index].length,Math.floor(value)));
    let remaining=requested-counts.reduce((a,b)=>a+b,0);
    while(remaining>0){
      let best=-1,bestScore=-Infinity;
      for(let i=0;i<pools.length;i++){
        if(counts[i]>=pools[i].length)continue;
        const score=(exact[i]-Math.floor(exact[i]))+((pools[i].length-counts[i])/Math.max(1,pools[i].length))*0.01;
        if(score>bestScore){bestScore=score;best=i;}
      }
      if(best<0)break;
      counts[best]++;remaining--;
    }
    return counts;
  };
  Array.prototype.slice=function(start,end){
    const requested=Number(end);
    const looksLikeGeneratedDeck=start===0&&[48,72,96].includes(requested)&&this.length<=24&&this.length>0&&this.every(item=>item&&typeof item==='object'&&'phaseId'in item&&'q'in item);
    if(!looksLikeGeneratedDeck)return nativeSlice.call(this,start,end);
    const level=Number(document.querySelector('#levels .active')?.dataset.level||2);
    const all=(typeof cards!=='undefined'?cards:[]).map(normalize).filter(card=>card.l<=level);
    if(all.length<requested)return nativeSlice.call(this,start,end);
    const order=['abertura','descoberta','conexao','romance','experiencia'];
    const pools=order.map(phase=>shuffle(all.filter(card=>card.phaseId===phase)));
    const counts=allocate(requested,pools);
    return pools.flatMap((pool,index)=>nativeSlice.call(pool,0,counts[index]));
  };
  const availableByLevel=level=>(typeof cards!=='undefined'?cards:[]).filter(card=>(Number(card.l)||1)<=level).length;
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action="start"]');
    if(!target)return;
    const requested=Number(document.getElementById('duration')?.value||24);
    const level=Number(document.querySelector('#levels .active')?.dataset.level||2);
    const available=availableByLevel(level);
    if(requested>available){
      event.preventDefault();event.stopImmediatePropagation();
      const required=[1,2,3].find(candidate=>availableByLevel(candidate)>=requested);
      const label=required===2?'Conexão':'Faísca';
      const error=document.getElementById('setupError');
      if(error)error.textContent=`Para jogar ${requested} cartas, selecione intensidade ${label}. A intensidade atual oferece ${available} cartas únicas.`;
    }
  },true);
  const upgrade=()=>{
    const select=document.getElementById('duration');
    if(select){
      const previous=Number(select.value)||24;
      select.innerHTML='<option value="12">Essencial · 12 cartas</option><option value="24">Completa · 24 cartas</option><option value="48">Imersiva · 48 cartas</option><option value="72">Maratona · 72 cartas</option><option value="96">Experiência total · 96 cartas</option>';
      select.value=String([12,24,48,72,96].includes(previous)?previous:24);
      if(!select.parentElement.querySelector('.capacity-note')){
        const note=document.createElement('small');note.className='microcopy capacity-note';note.textContent='48 cartas exige Conexão ou Faísca. 72 e 96 cartas exigem Faísca.';select.parentElement.appendChild(note);
      }
    }
    document.querySelectorAll('.hero .eyebrow').forEach(el=>el.textContent='Couple Experience · v8.3');
    const hero=document.querySelector('.hero>p');if(hero)hero.textContent='Uma jornada viva e coerente com 96 cartas únicas: conexão emocional, romance, Momento da Química, Tarô Cigano e encerramento estruturado.';
    const intro=document.querySelector('#instructions .section-title p');if(intro)intro.textContent='Escolha entre 12, 24, 48, 72 ou 96 cartas. O sistema distribui as perguntas pelas cinco fases, sem repetição.';
    const credits=document.querySelector('#view-credits .credits p');if(credits)credits.textContent='Conceito, direção criativa e autoria de Primeira Faísca. Edição v8.3 com 96 cartas únicas, leitura estruturada e encerramento completo.';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',upgrade,{once:true});else upgrade();
})();
