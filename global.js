// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
 
// Numerical integration: Riemann sum with N=400 strips
function integrate(f, a, b, N=400){
  if(a>=b) return 0;
  const h=(b-a)/N;
  let s=0;
  for(let i=0;i<N;i++) s+=f(a+h*(i+0.5));
  return s*h;
}
 
// Normal pdf
function normalPDF(x,mu,sigma){
  return Math.exp(-0.5*((x-mu)/sigma)**2)/(sigma*Math.sqrt(2*Math.PI));
}
 
// ───── Error cumulative (erf approximation) ─────
function erf(x){
  const t=1/(1+0.3275911*Math.abs(x));
  const poly=t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429))));
  return Math.sign(x)*(1-poly*Math.exp(-x*x));
}
function normalCDF(x,mu,sigma){ return 0.5*(1+erf((x-mu)/(sigma*Math.sqrt(2)))); }
 
// ═══════════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════════
function switchTab(tab){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  event.target.classList.add('active');
}
 
// ═══════════════════════════════════════════════════════════
//  C8 — Simulation Mode
// ═══════════════════════════════════════════════════════════
let c8Chart = null;
let currentDist = 'uniform';
 
function selectDist(d){
  currentDist = d;
  document.querySelectorAll('.dist-pill').forEach(p=>p.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.dist-params').forEach(p=>p.classList.remove('active'));
  document.getElementById('params-'+d).classList.add('active');
  updateC8();
}
 
// Piecewise pieces data
let pieces = [
  {a:0, b:2, h:0.25},
  {a:2, b:4, h:0.25}
];
 
function renderPieceList(){
  const div=document.getElementById('piece-list');
  div.innerHTML='';
  pieces.forEach((p,i)=>{
    const row=document.createElement('div');
    row.className='piece-row';
    row.innerHTML=`
      <div class="field"><label>a<sub>${i}</sub></label><input type="number" value="${p.a}" step="0.1" oninput="pieces[${i}].a=+this.value;updateC8()"></div>
      <div class="field"><label>b<sub>${i}</sub></label><input type="number" value="${p.b}" step="0.1" oninput="pieces[${i}].b=+this.value;updateC8()"></div>
      <div class="field"><label>height h<sub>${i}</sub></label><input type="number" value="${p.h}" step="0.01" oninput="pieces[${i}].h=+this.value;updateC8()"></div>
      <button class="del-btn" onclick="removePiece(${i})">✕</button>
    `;
    div.appendChild(row);
  });
}
function addPiece(){
  const last=pieces[pieces.length-1]||{b:0};
  pieces.push({a:last.b,b:last.b+2,h:0.1});
  renderPieceList();
  updateC8();
}
function removePiece(i){
  if(pieces.length<=1) return;
  pieces.splice(i,1);
  renderPieceList();
  updateC8();
}
renderPieceList();
 
// ── Build PDF from current distribution ──
function buildPDF(){
  const err=[];
  let pdf, domain;
 
  if(currentDist==='uniform'){
    const a=+document.getElementById('u-a').value;
    const b=+document.getElementById('u-b').value;
    if(b<=a){err.push('Need b > a'); return {err};}
    const h=1/(b-a);
    pdf=x=>(x>=a&&x<=b?h:0);
    domain=[a,b];
  }
  else if(currentDist==='triangular'){
    const a=+document.getElementById('t-a').value;
    const b=+document.getElementById('t-b').value;
    const c=+document.getElementById('t-c').value;
    if(b<=a||c<a||c>b){err.push('Need a ≤ c ≤ b and b > a'); return {err};}
    pdf=x=>{
      if(x<a||x>b) return 0;
      if(x<=c) return 2*(x-a)/((b-a)*(c-a));
      return 2*(b-x)/((b-a)*(b-c));
    };
    domain=[a,b];
  }
  else if(currentDist==='linear'){
    const a=+document.getElementById('l-a').value;
    const b=+document.getElementById('l-b').value;
    const dir=document.getElementById('l-dir').value;
    if(b<=a){err.push('Need b > a'); return {err};}
    const w=b-a;
    pdf=x=>{
      if(x<a||x>b) return 0;
      if(dir==='inc') return 2*(x-a)/(w*w);
      return 2*(b-x)/(w*w);
    };
    domain=[a,b];
  }
  else if(currentDist==='piecewise'){
    // Validate pieces
    let total=0;
    for(const p of pieces){
      if(p.b<=p.a){err.push(`Piece [${p.a},${p.b}] invalid: b must > a`); return {err};}
      total+=p.h*(p.b-p.a);
    }
    document.getElementById('piece-sum').textContent=`Sum of areas = ${total.toFixed(4)} (must equal 1.000)`;
    const minA=Math.min(...pieces.map(p=>p.a));
    const maxB=Math.max(...pieces.map(p=>p.b));
    pdf=x=>{
      for(const p of pieces){
        if(x>=p.a&&x<=p.b) return p.h;
      }
      return 0;
    };
    domain=[minA,maxB];
  }
  else if(currentDist==='normal'){
    const mu=+document.getElementById('n-mu').value;
    const sigma=+document.getElementById('n-sigma').value;
    if(sigma<=0){err.push('σ must be > 0'); return {err};}
    pdf=x=>normalPDF(x,mu,sigma);
    domain=[mu-4.5*sigma,mu+4.5*sigma];
  }
  return {pdf,domain,err:[]};
}
 
function updateC8(){
  const {pdf,domain,err}=buildPDF();
  const result=document.getElementById('c8-result');
 
  if(err.length>0){
    result.innerHTML=`<span style="color:#ff6b6b;">⚠ ${err.join('; ')}</span>`;
    return;
  }
 
  // Generate curve points
  const N=200;
  const [a,b]=domain;
  const xs=[],ys=[];
  for(let i=0;i<=N;i++){
    const x=a+(b-a)*i/N;
    xs.push(parseFloat(x.toFixed(4)));
    ys.push(parseFloat(pdf(x).toFixed(6)));
  }
 
  // Probability
  const probType=document.getElementById('prob-type').value;
  const x1=+document.getElementById('prob-x1').value;
  const x2=+document.getElementById('prob-x2').value;
  document.getElementById('x2-wrap').style.display=(probType==='between'?'block':'none');
 
  let lo,hi;
  if(probType==='below'){ lo=a; hi=x1; }
  else if(probType==='above'){ lo=x1; hi=b; }
  else { lo=Math.min(x1,x2); hi=Math.max(x1,x2); }
  lo=clamp(lo,a,b); hi=clamp(hi,a,b);
 
  const prob=integrate(pdf,lo,hi);
 
  // Shade region
  const shadeX=[],shadeY=[];
  const Ns=100;
  for(let i=0;i<=Ns;i++){
    const x=lo+(hi-lo)*i/Ns;
    shadeX.push(parseFloat(x.toFixed(4)));
    shadeY.push(parseFloat(pdf(x).toFixed(6)));
  }
 
  // Total area check
  const total=integrate(pdf,a,b);
 
  // Build chart
  const ctx=document.getElementById('c8-chart').getContext('2d');
  if(c8Chart) c8Chart.destroy();
 
  c8Chart=new Chart(ctx,{
    data:{
      datasets:[
        {
          type:'line',
          label:'PDF f(x)',
          data:xs.map((x,i)=>({x,y:ys[i]})),
          borderColor:'#0f0e0d',
          borderWidth:2.5,
          fill:false,
          pointRadius:0,
          tension:0.3,
          order:1
        },
        {
          type:'line',
          label:'Shaded Region',
          data:shadeX.map((x,i)=>({x,y:shadeY[i]})),
          borderColor:'rgba(192,57,43,0.8)',
          backgroundColor:'rgba(192,57,43,0.25)',
          borderWidth:1.5,
          fill:'origin',
          pointRadius:0,
          tension:0.3,
          order:2
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:true,
      animation:{duration:200},
      scales:{
        x:{type:'linear',title:{display:true,text:'x',font:{family:"'DM Mono', monospace",size:12}},grid:{color:'rgba(0,0,0,0.06)'}},
        y:{title:{display:true,text:'f(x)',font:{family:"'DM Mono', monospace",size:12}},min:0,grid:{color:'rgba(0,0,0,0.06)'}}
      },
      plugins:{
        legend:{labels:{font:{family:"'DM Mono', monospace",size:11}}},
        tooltip:{callbacks:{
          label:ctx=>`f(x) = ${ctx.parsed.y.toFixed(5)}`
        }}
      }
    }
  });
 
  // Compute additional stats for normal
  let extra='';
  if(currentDist==='normal'){
    const mu=+document.getElementById('n-mu').value;
    const sg=+document.getElementById('n-sigma').value;
    const p1s=(normalCDF(mu+sg,mu,sg)-normalCDF(mu-sg,mu,sg)).toFixed(4);
    extra=`  |  P(μ±σ) = ${p1s}`;
  }
 
  let probLabel='';
  if(probType==='below') probLabel=`P(X < ${x1})`;
  else if(probType==='above') probLabel=`P(X > ${x1})`;
  else probLabel=`P(${lo} < X < ${hi})`;
 
  result.innerHTML=`<span>${probLabel} = ${prob.toFixed(4)}</span>${extra}  |  Total area check: ${total.toFixed(4)}`;
}
 
updateC8();
 
// ═══════════════════════════════════════════════════════════
//  C9 — Data Modeling
// ═══════════════════════════════════════════════════════════
let c9Chart=null;
let loadedData=[];
 
// CSV file input
document.getElementById('csv-input').addEventListener('change',e=>{
  const f=e.target.files[0];
  if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>parseAndLoad(ev.target.result);
  reader.readAsText(f);
});
 
// Drag & drop
const dropZone=document.getElementById('drop-zone');
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag'));
dropZone.addEventListener('drop',e=>{
  e.preventDefault();
  dropZone.classList.remove('drag');
  const f=e.dataTransfer.files[0];
  if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>parseAndLoad(ev.target.result);
  reader.readAsText(f);
});
 
function parseAndLoad(text){
  const vals=text.split(/[\n,;\t\r]+/)
    .map(v=>parseFloat(v.trim()))
    .filter(v=>!isNaN(v));
  if(vals.length===0){ alert('No numeric data found in file.'); return; }
  loadedData=vals;
  document.getElementById('data-paste').value=vals.join(', ');
  fitData();
}
 
function loadData(){
  const raw=document.getElementById('data-paste').value;
  const vals=raw.split(/[\n,;\t\r]+/)
    .map(v=>parseFloat(v.trim()))
    .filter(v=>!isNaN(v));
  if(vals.length===0){ alert('No valid numbers found.'); return; }
  loadedData=vals;
  fitData();
}
 
function clearData(){
  loadedData=[];
  document.getElementById('data-paste').value='';
  document.getElementById('c9-stats').innerHTML='';
  document.getElementById('c9-result').innerHTML='← Upload or paste data to begin.';
  if(c9Chart){ c9Chart.destroy(); c9Chart=null; }
}
 
function fitData(){
  if(loadedData.length===0) return;
  const data=[...loadedData].sort((a,b)=>a-b);
  const n=data.length;
  const mean=data.reduce((s,v)=>s+v,0)/n;
  const variance=data.reduce((s,v)=>s+(v-mean)**2,0)/(n-1);
  const std=Math.sqrt(variance);
  const minV=data[0], maxV=data[n-1];
  const median=n%2===0?(data[n/2-1]+data[n/2])/2:data[Math.floor(n/2)];
 
  // Stats table
  document.getElementById('c9-stats').innerHTML=`
    <table class="stats-table" style="margin-bottom:0.75rem;">
      <tr><th>Statistic</th><th>Value</th></tr>
      <tr><td>n</td><td>${n}</td></tr>
      <tr><td>Mean (x̄)</td><td>${mean.toFixed(4)}</td></tr>
      <tr><td>Std dev (s)</td><td>${std.toFixed(4)}</td></tr>
      <tr><td>Min</td><td>${minV.toFixed(4)}</td></tr>
      <tr><td>Max</td><td>${maxV.toFixed(4)}</td></tr>
      <tr><td>Median</td><td>${median.toFixed(4)}</td></tr>
    </table>`;
 
  // ── Histogram bins (Sturges rule) ──
  const nBins=Math.max(5,Math.ceil(1+Math.log2(n)));
  const binW=(maxV-minV)/nBins||1;
  const bins=Array(nBins).fill(0);
  data.forEach(v=>{
    let i=Math.floor((v-minV)/binW);
    if(i>=nBins) i=nBins-1;
    bins[i]++;
  });
  const binDensities=bins.map(c=>c/(n*binW)); // density
  const binLabels=Array.from({length:nBins},(_,i)=>+(minV+binW*(i+0.5)).toFixed(3));
 
  // ── Fit chosen distribution ──
  const fitType=document.getElementById('fit-dist').value;
  let pdf, params='', interpretation='';
 
  if(fitType==='normal'){
    pdf=x=>normalPDF(x,mean,std);
    params=`μ̂ = ${mean.toFixed(4)}, σ̂ = ${std.toFixed(4)}`;
    const kurt=data.reduce((s,v)=>s+(v-mean)**4,0)/(n*std**4);
    interpretation=kurt>3.5?'The normal overlay may underfit heavy tails (excess kurtosis detected).'
      :kurt<2.5?'Data may be platykurtic; uniform fit could also be considered.'
      :'The normal distribution appears a reasonable fit for this dataset.';
  }
  else if(fitType==='uniform'){
    const h=1/(maxV-minV);
    pdf=x=>(x>=minV&&x<=maxV?h:0);
    params=`â = ${minV.toFixed(4)}, b̂ = ${maxV.toFixed(4)}, height = ${h.toFixed(4)}`;
    interpretation='Uniform fit assigns equal probability across the full range. Check if the histogram is approximately flat.';
  }
  else if(fitType==='triangular'){
    // Mode = midpoint of bin with highest density
    const maxBinIdx=bins.indexOf(Math.max(...bins));
    const modeEst=minV+binW*(maxBinIdx+0.5);
    pdf=x=>{
      if(x<minV||x>maxV) return 0;
      const c=modeEst;
      if(Math.abs(modeEst-minV)<1e-9||Math.abs(modeEst-maxV)<1e-9) return 1/(maxV-minV);
      if(x<=c) return 2*(x-minV)/((maxV-minV)*(c-minV));
      return 2*(maxV-x)/((maxV-minV)*(maxV-c));
    };
    params=`â = ${minV.toFixed(3)}, b̂ = ${maxV.toFixed(3)}, ĉ (mode) = ${modeEst.toFixed(3)}`;
    interpretation='Triangular fit captures a central peak. Compare the PDF apex with the tallest histogram bar.';
  }
  else if(fitType==='linear'){
    const w=maxV-minV;
    pdf=x=>(x>=minV&&x<=maxV?2*(x-minV)/(w*w):0);
    params=`â = ${minV.toFixed(4)}, b̂ = ${maxV.toFixed(4)} [increasing linear]`;
    interpretation='Increasing linear PDF: probability rises from a to b. Check if the histogram shows a right-skewed ramp shape.';
  }
  else if(fitType==='linear-dec'){
    const w=maxV-minV;
    pdf=x=>(x>=minV&&x<=maxV?2*(maxV-x)/(w*w):0);
    params=`â = ${minV.toFixed(4)}, b̂ = ${maxV.toFixed(4)} [decreasing linear]`;
    interpretation='Decreasing linear PDF: probability falls from a to b. Check if the histogram shows a left-skewed ramp shape.';
  }
  else if(fitType==='piecewise-uniform'){
    // Split at median; each half has constant density so area = 0.5
    const h1=0.5/(median-minV||1);
    const h2=0.5/(maxV-median||1);
    pdf=x=>{
      if(x<minV||x>maxV) return 0;
      return x<=median?h1:h2;
    };
    params=`[${minV.toFixed(3)}, ${median.toFixed(3)}]: h₁=${h1.toFixed(4)}  |  [${median.toFixed(3)}, ${maxV.toFixed(3)}]: h₂=${h2.toFixed(4)}`;
    interpretation='Piecewise uniform split at the median. Each half carries 50% of the probability. Useful when data has two distinct density levels.';
  }
 
  // ── Probability calculations ──
  const pMidSigma=integrate(pdf,mean-std,mean+std);
  const pTails=integrate(pdf,minV-1e-9,mean-2*std)+integrate(pdf,mean+2*std,maxV+1e-9);
 
  // ── Fitted PDF curve ──
  const N=200;
  const pdfXs=[], pdfYs=[];
  const lo=minV-0.05*(maxV-minV), hi=maxV+0.05*(maxV-minV);
  for(let i=0;i<=N;i++){
    const x=lo+(hi-lo)*i/N;
    pdfXs.push(parseFloat(x.toFixed(4)));
    pdfYs.push(parseFloat(pdf(x).toFixed(6)));
  }
 
  // ── Draw chart ──
  const ctx=document.getElementById('c9-chart').getContext('2d');
  if(c9Chart) c9Chart.destroy();
 
  c9Chart=new Chart(ctx,{
    data:{
      datasets:[
        {
          type:'bar',
          label:'Histogram (density)',
          data:binLabels.map((x,i)=>({x,y:binDensities[i]})),
          backgroundColor:'rgba(44,122,110,0.35)',
          borderColor:'rgba(44,122,110,0.8)',
          borderWidth:1,
          barPercentage:1.0,
          categoryPercentage:1.0,
          order:2
        },
        {
          type:'line',
          label:'Fitted PDF',
          data:pdfXs.map((x,i)=>({x,y:pdfYs[i]})),
          borderColor:'#c0392b',
          borderWidth:2.5,
          fill:false,
          pointRadius:0,
          tension:0.3,
          order:1
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:true,
      animation:{duration:300},
      scales:{
        x:{type:'linear',title:{display:true,text:'x',font:{family:"'DM Mono',monospace",size:11}},grid:{color:'rgba(0,0,0,0.05)'}},
        y:{title:{display:true,text:'Density',font:{family:"'DM Mono',monospace",size:11}},min:0,grid:{color:'rgba(0,0,0,0.05)'}}
      },
      plugins:{
        legend:{labels:{font:{family:"'DM Mono',monospace",size:11}}}
      }
    }
  });
 
  document.getElementById('c9-result').innerHTML=
    `<span>Estimated parameters:</span> ${params}<br>` +
    `<span>P(μ−σ &lt; X &lt; μ+σ)</span> = ${pMidSigma.toFixed(4)}<br>` +
    `<span>P(X &lt; μ−2σ or X &gt; μ+2σ)</span> = ${pTails.toFixed(4)}<br>` +
    `<span>Interpretation:</span> ${interpretation}`;
}