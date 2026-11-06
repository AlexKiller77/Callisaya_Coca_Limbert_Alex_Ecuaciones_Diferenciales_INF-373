'use strict';
const $ = id => document.getElementById(id);
let lastRows = [];
const fmt = (n, digits=6) => Number.isFinite(n) ? n.toLocaleString('es-BO',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
function exact(t,p){return p.capacity-(p.capacity-p.e0)*Math.exp(-p.rate*t)}
function derivative(y,p){return p.rate*(p.capacity-y)}
function simulate(p,h){
  const count=Math.ceil(p.duration/h);
  if(count>2000) throw new Error('Demasiadas iteraciones. Aumenta el tamaño de paso o reduce la duración (máximo 2000 pasos con h/2).');
  let y=p.e0,z=p.e0,t=0;
  const rows=[{i:0,t:0,exact:p.e0,heun:y,rk4:z}];
  for(let i=1;i<=count;i++){
    const dt=Math.min(h,p.duration-t);
    const a=derivative(y,p),b=derivative(y+dt*a,p);
    y+=dt*(a+b)/2;
    const k1=derivative(z,p),k2=derivative(z+dt*k1/2,p),k3=derivative(z+dt*k2/2,p),k4=derivative(z+dt*k3,p);
    z+=dt*(k1+2*k2+2*k3+k4)/6;
    t=Math.min(p.duration,t+dt);
    rows.push({i,t,exact:exact(t,p),heun:y,rk4:z});
  }
  return rows;
}
function errors(row,key){const abs=Math.abs(row[key]-row.exact);return {abs,rel:row.exact!==0?abs/Math.abs(row.exact)*100:null}}
function params(){
  const p={capacity:+$('capacity').value,initial:+$('initial').value,rate:+$('rate').value,duration:+$('duration').value,step:+$('step').value,target:+$('target').value};
  if(Object.values(p).some(v=>!Number.isFinite(v)))throw new Error('Completa todos los campos con números válidos.');
  if(p.capacity<=0||p.rate<=0||p.duration<=0||p.step<=0)throw new Error('Capacidad, constante k, duración y paso h deben ser positivos.');
  if(p.initial<0||p.initial>100||p.target<0||p.target>100)throw new Error('Los porcentajes deben estar entre 0 y 100.');
  if(p.rate*p.step>4)throw new Error('El producto k × h es demasiado grande para una simulación estable. Reduce el paso h.');
  if(Math.ceil(p.duration/(p.step/2))>2000)throw new Error('La comparación con h/2 supera 2000 iteraciones. Aumenta h o reduce la duración.');
  p.e0=p.capacity*p.initial/100;
  return p;
}
function fillTable(rows){
  const body=$('results');body.replaceChildren();
  const shown=rows.length>400?rows.filter((r,i)=>i===0||i===rows.length-1||i%Math.ceil(rows.length/399)===0):rows;
  const fragment=document.createDocumentFragment();
  for(const r of shown){const a=errors(r,'heun'),b=errors(r,'rk4');const tr=document.createElement('tr');
    [r.i,fmt(r.t,4),fmt(r.exact),fmt(r.heun),fmt(r.rk4),fmt(a.abs),a.rel===null?'—':fmt(a.rel),fmt(b.abs),b.rel===null?'—':fmt(b.rel)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});fragment.appendChild(tr)}
  body.appendChild(fragment);$('rowsNote').textContent=rows.length>400?`Mostrando ${shown.length} de ${rows.length} filas. Descarga el CSV para obtener todas.`:`${rows.length} filas (incluida la condición inicial).`;
}
function fillComparison(coarse,fine,p){
  const body=$('comparison');body.replaceChildren();
  const tests=[['Heun',p.step,coarse.at(-1),'heun'],['RK4',p.step,coarse.at(-1),'rk4'],['Heun',p.step/2,fine.at(-1),'heun'],['RK4',p.step/2,fine.at(-1),'rk4']];
  for(const [name,h,row,key] of tests){const e=errors(row,key),tr=document.createElement('tr');[name,fmt(h,5),fmt(row[key]),fmt(e.abs,8),e.rel===null?'—':fmt(e.rel,6)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});body.appendChild(tr)}
  const eH=errors(coarse.at(-1),'heun'),eR=errors(coarse.at(-1),'rk4');
  $('bestMethod').textContent=eR.abs<=eH.abs?'RK4':'Heun';
  $('interpretation').textContent=`Con h = ${fmt(p.step,3)} h, el error absoluto final de Heun es ${fmt(eH.abs,8)} kWh y el de RK4 es ${fmt(eR.abs,8)} kWh. En este ensayo ${eR.abs<=eH.abs?'RK4':'Heun'} se aproxima más a la solución exacta. Reducir h permite estudiar cómo cambia la precisión. Los resultados corresponden a un modelo idealizado, no a una predicción física verificada.`;
}
function draw(rows,p){
  const canvas=$('chart'),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=rect.width,H=rect.height;
  const m={left:64,right:16,top:18,bottom:42},cw=w-m.left-m.right,ch=H-m.top-m.bottom;
  if(cw<=0||ch<=0)return;
  const x=t=>m.left+t/p.duration*cw,y=v=>m.top+ch-(v/p.capacity)*ch;
  ctx.font='11px system-ui';ctx.lineWidth=1;
  for(let i=0;i<=5;i++){const v=p.capacity*i/5,py=y(v);ctx.strokeStyle='#2b4561';ctx.beginPath();ctx.moveTo(m.left,py);ctx.lineTo(w-m.right,py);ctx.stroke();ctx.fillStyle='#aabbd0';ctx.textAlign='right';ctx.fillText(fmt(v,2),m.left-9,py+4)}
  for(let i=0;i<=5;i++){const t=p.duration*i/5,px=x(t);ctx.fillStyle='#aabbd0';ctx.textAlign='center';ctx.fillText(fmt(t,1),px,H-17)}
  const series=[['exact','#46b4ff'],['heun','#ffb44a'],['rk4','#4ee3a0']];
  for(const [key,color] of series){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2.6;rows.forEach((r,i)=>{const px=x(r.t),py=y(r[key]);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)});ctx.stroke()}
}
function render(){const error=$('error');error.hidden=true;try{
  const p=params(),coarse=simulate(p,p.step),fine=simulate(p,p.step/2),final=coarse.at(-1);
  if(!coarse.every(r=>Number.isFinite(r.heun)&&Number.isFinite(r.rk4))||!fine.every(r=>Number.isFinite(r.heun)&&Number.isFinite(r.rk4)))throw new Error('Los parámetros producen valores numéricos no finitos. Reduce k o el paso.');
  lastRows=coarse;$('modelConditions').innerHTML=`<strong>Condición inicial:</strong> E(0) = ${fmt(p.capacity*p.initial/100,4)} kWh (${fmt(p.initial,2)} %). <strong>Intervalo:</strong> 0 ≤ t ≤ ${fmt(p.duration,3)} horas. <strong>Parámetros:</strong> E<sub>max</sub> = ${fmt(p.capacity,4)} kWh, k = ${fmt(p.rate,4)} h⁻¹ y h = ${fmt(p.step,4)} horas.`;$('finalCharge').textContent=fmt(final.exact/p.capacity*100,2)+' %';$('finalEnergy').textContent=fmt(final.exact,4)+' kWh';
  if(p.target<=p.initial){$('targetTime').textContent='0 h'}else if(p.target===100){$('targetTime').textContent='∞ (asintótico)'}else{$('targetTime').textContent=fmt(Math.log((1-p.initial/100)/(1-p.target/100))/p.rate,3)+' h'}
  fillTable(coarse);fillComparison(coarse,fine,p);draw(coarse,p);window.currentSimulation={rows:coarse,p};
}catch(e){error.textContent=e.message;error.hidden=false}}
$('settings').addEventListener('submit',e=>{e.preventDefault();render()});
$('download').addEventListener('click',()=>{
 if(!lastRows.length)return;
 const header=['Iteracion','Tiempo_h','Exacta_kWh','Heun_kWh','RK4_kWh','ErrorAbs_Heun','ErrorRel_Heun_pct','ErrorAbs_RK4','ErrorRel_RK4_pct'];
 const lines=[header.join(',')];for(const r of lastRows){const a=errors(r,'heun'),b=errors(r,'rk4');lines.push([r.i,r.t,r.exact,r.heun,r.rk4,a.abs,a.rel??'',b.abs,b.rel??''].join(','))}
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='solarcharge_resultados.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('resize',()=>{if(window.currentSimulation)draw(window.currentSimulation.rows,window.currentSimulation.p)});
render();
