/* TridraLab Lab: deterministic cost model and local 3D file inspection. */
(() => {
'use strict';
const samples = Object.freeze({PETG:95, PLA:80, TPU:150, ASA:120, OUTRO:100});
const brl = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const number = (v, min=0, max=1e9) => {const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:NaN};
function calculate(x){
 const kg=number(x.kg,0,10000), grams=number(x.grams,1,100000), hours=number(x.hours,.1,1000), watts=number(x.watts,0,5000), energy=number(x.energy,0,100), machine=number(x.machine,0,1000), minutes=number(x.minutes,0,10000),labor=number(x.labor,0,10000),extras=number(x.extras,0,100000),failure=number(x.failure,0,90)/100,overhead=number(x.overhead,0,500)/100,margin=number(x.margin,0,90)/100,tax=number(x.tax,0,90)/100;
 const all=[kg,grams,hours,watts,energy,machine,minutes,labor,extras,failure,overhead,margin,tax];
 if(all.some(v=>!Number.isFinite(v)))throw Error('Revise os campos: todos os valores devem estar dentro dos limites indicados.');
 if(margin+tax>=.99)throw Error('A soma de margem e taxas precisa ser inferior a 99% para permitir um preço matematicamente válido.');
 const material=grams*kg/1000;
 const electricity=(watts/1000)*hours*energy;
 const machineWear=machine*hours;
 const activeLabor=(minutes/60)*labor;
 const direct=material+electricity+machineWear+activeLabor+extras;
 // Expected-value risk: if failure p, expected print attempts per successful part = 1/(1-p).
 const riskAdjusted=direct/(1-failure);
 const indirect=riskAdjusted*overhead;
 const cost=riskAdjusted+indirect;
 // Margin and fees are fractions of REVENUE, not multipliers of cost.
 const price=cost/(1-margin-tax);
 if(!Number.isFinite(price)||price>1e12)throw Error('O resultado ficou fora do intervalo suportado.');
 const result={material,electricity,machineWear,activeLabor,extras,riskLoss:riskAdjusted-direct,indirect,cost,price,profitBeforeTax:price*(margin),taxes:price*tax,percentMargin:margin*100,percentTax:tax*100,inputs:{...x}};
 return result;
}
function formatSummary(r){return [
'TRIDRALAB — Simulação de custos (estimativa não vinculante)',
`Material: ${r.inputs.material || 'a definir'}`,
`Massa: ${r.inputs.grams} g | Impressão: ${r.inputs.hours} h`,
`Filamento: ${brl(r.material)} | Energia: ${brl(r.electricity)}`,
`Máquina: ${brl(r.machineWear)} | Mão de obra: ${brl(r.activeLabor)}`,
`Acabamento/embalagem: ${brl(r.extras)}`,
`Provisão de falhas: ${brl(r.riskLoss)} | Indiretos: ${brl(r.indirect)}`,
`Custo estimado: ${brl(r.cost)}`,
`Margem-alvo: ${r.percentMargin.toFixed(1)}% | Tributos/taxas na venda: ${r.percentTax.toFixed(1)}%`,
`Preço de referência: ${brl(r.price)}`,
'NOTA: valores informados pelo usuário; frete e validação técnica não inclusos. Não constitui oferta comercial.'
].join('\n');}
function csv(r){return 'Componente;Valor (BRL)\n'+[['Filamento',r.material],['Energia',r.electricity],['Máquina',r.machineWear],['Mão de obra',r.activeLabor],['Acabamento e embalagem',r.extras],['Provisão por falhas',r.riskLoss],['Despesas indiretas',r.indirect],['Custo total',r.cost],['Margem alvo (%)',r.percentMargin],['Tributos e taxas (%)',r.percentTax],['Preço de referência',r.price]].map(([k,v])=>`"${k}";${v.toFixed(2).replace('.',',')}`).join('\n')+'\n';}
const maxSize=25*1024*1024;
const allExt=['stl','obj','3mf'];
const fmtSize=b=>b<1024*1024?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(2)} MB`;
const fmtNum=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);
function boundsUpdate(bounds,x,y,z){if(![x,y,z].every(Number.isFinite))return false;bounds.min[0]=Math.min(bounds.min[0],x);bounds.min[1]=Math.min(bounds.min[1],y);bounds.min[2]=Math.min(bounds.min[2],z);bounds.max[0]=Math.max(bounds.max[0],x);bounds.max[1]=Math.max(bounds.max[1],y);bounds.max[2]=Math.max(bounds.max[2],z);return true;}
function dims(bounds){return bounds.min.map((v,i)=>bounds.max[i]-v);}
function volumeTriangle(a,b,c,center){const ax=a[0]-center[0],ay=a[1]-center[1],az=a[2]-center[2],bx=b[0]-center[0],by=b[1]-center[1],bz=b[2]-center[2],cx=c[0]-center[0],cy=c[1]-center[1],cz=c[2]-center[2];return (ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;}
function classify(ext,size){return {extension:ext,size:fmtSize(size),bytes:size,warning:''};}
function inspectBinarySTL(buffer){
 const view=new DataView(buffer),count=view.getUint32(80,true),bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 if(!count||84+count*50>buffer.byteLength)throw Error('Estrutura binária STL inválida ou incompleta.');
 if(count>500000)throw Error('Este modelo excede o limite de 500 mil triângulos para a inspeção local.');
 let degenerate=0;for(let i=0;i<count;i++){const pos=84+i*50+12;const pts=[];for(let j=0;j<3;j++){const p=pos+j*12;const point=[view.getFloat32(p,true),view.getFloat32(p+4,true),view.getFloat32(p+8,true)];if(!boundsUpdate(bounds,...point))throw Error('Coordenadas inválidas no arquivo STL.');pts.push(point);}const [a,b,c]=pts;const ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...cross)<1e-10)degenerate++;}
 const center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);let signed=0;
 for(let i=0;i<count;i++){const pos=84+i*50+12;const v=[];for(let j=0;j<3;j++){const p=pos+j*12;v.push([view.getFloat32(p,true),view.getFloat32(p+4,true),view.getFloat32(p+8,true)]);}signed+=volumeTriangle(...v,center);}
 return {triangles:count,degenerate,dims:dims(bounds),bounds,volume:Math.abs(signed),signedVolume:signed,method:'STL binário'};
}
function inspectASCIISTL(text){
 const matches=text.matchAll(/\bvertex\s+([+\-\deE.]+)\s+([+\-\deE.]+)\s+([+\-\deE.]+)/gi);const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};let vertices=0;let signed=0;let tri=[];
 for(const match of matches){const p=[Number(match[1]),Number(match[2]),Number(match[3])];if(!boundsUpdate(bounds,...p))throw Error('Coordenadas inválidas no STL ASCII.');tri.push(p);vertices++;if(tri.length===3){signed+=volumeTriangle(...tri,[0,0,0]);tri=[];}if(vertices>1500000)throw Error('O STL excede o limite de inspeção local.');}
 if(vertices<3||vertices%3!==0)throw Error('Não foram encontrados triângulos válidos no STL ASCII.');
 return {triangles:vertices/3,degenerate:null,dims:dims(bounds),bounds,volume:Math.abs(signed),signedVolume:signed,method:'STL ASCII'};
}
function inspectOBJ(text){
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};let vertices=0,faces=0;
 for(const line of text.split(/\r?\n/)){if(line.startsWith('v ')){const coords=line.trim().split(/\s+/).slice(1,4).map(Number);if(coords.length!==3||!boundsUpdate(bounds,...coords))throw Error('Vértice OBJ inválido.');vertices++;}else if(line.startsWith('f '))faces++;if(vertices>1000000)throw Error('OBJ acima do limite de vértices.');}
 if(vertices<3)throw Error('Nenhum conjunto válido de vértices foi encontrado no OBJ.');
 return {vertices,faces,dims:dims(bounds),bounds,volume:null,method:'OBJ'};
}
async function inspect(file){
 if(!(file instanceof File))throw Error('Selecione um arquivo local válido.');
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 if(!allExt.includes(ext))throw Error('Formato não compatível. Utilize STL, OBJ ou 3MF.');
 if(!file.size||file.size>maxSize)throw Error('O arquivo precisa ter entre 1 byte e 25 MB.');
 const info=classify(ext,file.size);
 if(ext==='3mf')return {...info,method:'3MF (ZIP/XML)',warning:'O arquivo 3MF foi identificado, mas a geometria não é analisada nesta versão. É necessário abrir em um fatiador e auditar dimensões, unidades e malha.'};
 if(ext==='obj'){const geom=inspectOBJ(await file.text());return {...info,...geom,warning:'OBJ pode não ter unidade de medida definida. Dimensões presumem milímetros; faces não foram auditadas para fabricação.'};}
 const buf=await file.arrayBuffer();let geom;
 if(buf.byteLength>=84){const view=new DataView(buf),count=view.getUint32(80,true);const expected=84+count*50;if(count>0&&expected<=buf.byteLength&&buf.byteLength-expected<4096)geom=inspectBinarySTL(buf);}
 if(!geom)geom=inspectASCIISTL(new TextDecoder('utf-8',{fatal:false}).decode(buf));
 return {...info,...geom,warning:'STL não define unidades. Dimensões presumem milímetros; volume depende de malha fechada e orientada. A ferramenta NÃO verifica manifold, interferências, resistência ou imprimibilidade.'};
}
window.TRIDRA_LAB={calculate,brl,samples,formatSummary,csv,inspect,fmtSize,fmtNum};
})();
