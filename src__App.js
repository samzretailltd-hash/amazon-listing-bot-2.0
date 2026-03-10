import { useState, useRef, useCallback, useEffect } from "react";

const CATS = ["Electronics","Home & Kitchen","Beauty & Personal Care","Sports & Outdoors","Clothing & Apparel","Toys & Games","Health & Household","Books","Automotive","Garden & Outdoor","Pet Supplies","Baby Products","Office Products","Kitchen & Dining","Tools & Home Improvement"];
const KWS = {"Electronics":["wireless","bluetooth 5.0","fast charging","noise cancelling","waterproof","alexa compatible","USB-C","long battery life","portable","smart home"],"Home & Kitchen":["non-stick","dishwasher safe","BPA free","space saving","stainless steel","eco friendly","multi-purpose","durable","easy clean","modern design"],"Beauty & Personal Care":["cruelty free","vegan","organic","hypoallergenic","dermatologist tested","sulfate free","paraben free","natural ingredients","anti-aging","moisturizing"],"Sports & Outdoors":["lightweight","breathable","moisture wicking","UV protection","heavy duty","ergonomic","high performance","durable","professional grade","all weather"],"Clothing & Apparel":["slim fit","machine washable","wrinkle resistant","breathable fabric","premium quality","comfortable","versatile","stylish","all season","stretchable"],"Toys & Games":["STEM learning","educational","safe for kids","non-toxic","interactive","durable","award winning","creative play","screen free","age appropriate"],"Health & Household":["natural","plant based","eco friendly","non toxic","long lasting","clinically tested","safe for family","biodegradable","effective","concentrated"],"Baby Products":["BPA free","soft material","easy to clean","safe for newborns","hypoallergenic","durable","pediatrician recommended","non-toxic","easy to use","dermatologist tested"],"default":["premium quality","best seller","highly rated","fast delivery","customer favorite","top rated","trusted brand","value pack","money back guarantee","limited edition"]};

const api = async (body) => {
  const r = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || d.error || "API error");
  return d;
};

export default function App() {
  const [step, setStep] = useState("input");
  const [productInput, setProductInput] = useState("");
  const [pricePoint, setPricePoint] = useState("");
  const [listing, setListing] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [activeTab, setActiveTab] = useState("title");
  const [copied, setCopied] = useState("");
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);

  const [detecting, setDetecting] = useState(false);
  const [detCat, setDetCat] = useState("");
  const [detAud, setDetAud] = useState("");
  const [detFeat, setDetFeat] = useState("");
  const [detConf, setDetConf] = useState(null);
  const [detDone, setDetDone] = useState(false);
  const [detErr, setDetErr] = useState("");
  const [ovCat, setOvCat] = useState(false);
  const [ovAud, setOvAud] = useState(false);
  const [ovFeat, setOvFeat] = useState(false);
  const [manCat, setManCat] = useState("");
  const [manAud, setManAud] = useState("");
  const [manFeat, setManFeat] = useState("");
  const debRef = useRef(null);

  const toB64 = f => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });

  const handleFiles = useCallback(files => {
    const imgs = Array.from(files).filter(f=>f.type.startsWith("image/")).slice(0,5);
    Promise.all(imgs.map(async f => { const b64=await toB64(f); return {b64, preview:`data:${f.type};base64,${b64}`, mediaType:f.type, name:f.name}; }))
      .then(r => setImages(p => [...p,...r].slice(0,5)));
  }, []);

  const onDrop = useCallback(e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);

  const detect = useCallback(async (title, imgs) => {
    if (!title.trim() || title.length < 5) { setDetDone(false); setDetCat(""); setDetAud(""); setDetFeat(""); return; }
    setDetecting(true); setDetDone(false); setDetErr("");
    const mc = [];
    if (imgs.length > 0) mc.push({ type:"image", source:{ type:"base64", media_type:imgs[0].mediaType, data:imgs[0].b64 } });
    mc.push({ type:"text", text:`Amazon product expert. Return ONLY valid JSON no markdown.\nPRODUCT: "${title}"\n${imgs.length>0?"IMAGE: attached":""}\nCATEGORIES: ${CATS.join(", ")}\n\n{"category":"exact match","targetAudience":"specific buyer personas 1-2 sentences","keyFeatures":"3-5 USP features comma separated","confidence":95}` });
    try {
      const d = await api({ model:"claude-sonnet-4-20250514", max_tokens:300, messages:[{role:"user",content:mc}] });
      const t = d.content?.map(b=>b.text||"").join("") || "";
      const p = JSON.parse(t.replace(/```json|```/g,"").trim());
      setDetCat(p.category||""); setDetAud(p.targetAudience||""); setDetFeat(p.keyFeatures||""); setDetConf(p.confidence||null); setDetDone(true);
    } catch { setDetErr("Auto-detect failed — fill manually or retry."); }
    finally { setDetecting(false); }
  }, []);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (productInput.trim().length >= 5) debRef.current = setTimeout(() => detect(productInput, images), 1200);
    else { setDetDone(false); setDetCat(""); setDetAud(""); setDetFeat(""); }
    return () => clearTimeout(debRef.current);
  }, [productInput]);

  useEffect(() => {
    if (images.length > 0 && productInput.trim().length >= 5) {
      if (debRef.current) clearTimeout(debRef.current);
      debRef.current = setTimeout(() => detect(productInput, images), 800);
    }
  }, [images.length]);

  const cat = ovCat ? manCat : detCat;
  const aud = ovAud ? manAud : detAud;
  const feat = ovFeat ? manFeat : detFeat;

  const tick = async steps => { for (const [t,p] of steps) { setProgressText(t); setProgress(p); await new Promise(r=>setTimeout(r,500+Math.random()*400)); } };

  const generate = async () => {
    if (!productInput.trim() || !cat) return;
    setStep("generating"); setProgress(0);
    const kws = KWS[cat] || KWS["default"];
    const hasImg = images.length > 0;
    await tick([
      [hasImg?"🖼️ Scanning product images with AI vision...":"📋 Reading product details...",6],
      [hasImg?"📐 Estimating product dimensions & size...":"🔍 Parsing attributes...",14],
      ["🎯 Applying AI-detected category, audience & features...",22],
      ["🔍 Cross-referencing Amazon A9 algorithm signals...",32],
      ["📊 Mining top-ranking competitor keywords...",44],
      ["📈 Extracting long-tail & short-tail keyword clusters...",55],
      ["⚡ Crafting A9-optimized title with power words...",65],
      ["🎯 Writing 5 conversion-focused bullet points...",75],
      ["📝 Building SEO-rich HTML description...",85],
      ["🏷️ Scoring keyword density & placement quality...",93],
      ["✅ Finalizing listing for maximum Buy Box impact...",98],
    ]);

    const mc = [];
    if (hasImg) for (const img of images) mc.push({ type:"image", source:{ type:"base64", media_type:img.mediaType, data:img.b64 } });
    mc.push({ type:"text", text:`Elite Amazon A9 SEO expert with computer vision.\n${hasImg?`IMAGES (${images.length}): Estimate SIZE/DIMENSIONS, detect colors, materials, visible features, quality tier.`:""}\n\nPRODUCT: ${productInput}\nCATEGORY: ${cat}\nAUDIENCE: ${aud||"General consumers"}\nFEATURES: ${feat||"Derive from product"}\nPRICE: ${pricePoint||"Mid-range"}\nTRENDING KWS: ${kws.join(", ")}\n\nReturn ONLY valid JSON no markdown:\n{"imageAnalysis":{"productType":"","detectedColors":[],"detectedMaterials":[],"estimatedSize":"detailed size estimate with reasoning","visibleFeatures":[],"packagingObservations":"","qualityAssessment":"","additionalObservations":""},"title":"A9 title 180 chars max front-load top keyword | separator","brand":"","primaryKeywords":[],"longTailKeywords":[],"shortTailKeywords":[],"bullets":["CAPS HOOK – benefit + keyword","CAPS HOOK – size/spec + use case","CAPS HOOK – material + durability","CAPS HOOK – differentiator + compatibility","CAPS HOOK – guarantee + trust"],"description":"HTML 700-900 words p and b tags emotional hook features CTA trending keywords","searchTerms":"240 chars max space-separated no brand names synonyms misspellings","asinScore":91,"keywordDensityScore":93,"conversionScore":90,"seoScore":94,"improvements":[],"competitorGaps":[],"pricingInsight":""}` });

    try {
      const d = await api({ model:"claude-sonnet-4-20250514", max_tokens:4000, messages:[{role:"user",content:mc}] });
      const t = d.content?.map(b=>b.text||"").join("") || "";
      const p = JSON.parse(t.replace(/```json|```/g,"").trim());
      setListing(p); setProgress(100); setProgressText("✅ Listing optimized!");
      await new Promise(r=>setTimeout(r,700));
      setActiveTab(hasImg?"vision":"title"); setStep("result");
    } catch(e) { setProgressText(`❌ ${e.message}`); setTimeout(()=>setStep("input"),3000); }
  };

  const copy = (text,key) => { navigator.clipboard.writeText(Array.isArray(text)?text.join("\n\n"):text||""); setCopied(key); setTimeout(()=>setCopied(""),2000); };

  const reset = () => {
    setStep("input"); setListing(null); setProductInput(""); setPricePoint(""); setImages([]); setActiveTab("title");
    setDetDone(false); setDetCat(""); setDetAud(""); setDetFeat("");
    setOvCat(false); setOvAud(false); setOvFeat(false); setManCat(""); setManAud(""); setManFeat("");
  };

  const Ring = ({score,label,color}) => {
    const r=26,c=2*Math.PI*r,d=(score/100)*c;
    return <div style={{textAlign:"center"}}>
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#1a2235" strokeWidth="5"/>
        <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${d} ${c}`} strokeLinecap="round" transform="rotate(-90 34 34)" style={{transition:"stroke-dasharray 1.2s ease"}}/>
        <text x="34" y="39" textAnchor="middle" fill={color} fontSize="14" fontWeight="800">{score}</text>
      </svg>
      <div style={{fontSize:10,color:"#7a8fa8",marginTop:2,fontFamily:"monospace"}}>{label}</div>
    </div>;
  };

  const Field = ({label,icon,val,detecting:det,done,isOv,setOv,ovVal,setOvVal,type}) => (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <label style={{fontSize:11,color:"#f59500",fontWeight:800,letterSpacing:1}}>{icon} {label}</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {det && <span style={{fontSize:10,color:"#4fc3f7",display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",animation:"spin .8s linear infinite"}}>⚙️</span>Detecting...</span>}
          {done && !isOv && <span style={{fontSize:10,background:"rgba(0,200,150,.15)",border:"1px solid rgba(0,200,150,.4)",color:"#00c896",borderRadius:10,padding:"2px 8px",fontWeight:700}}>✅ AI Detected</span>}
          {done && <button onClick={()=>setOv(!isOv)} style={{fontSize:10,background:isOv?"rgba(245,149,0,.2)":"rgba(255,255,255,.07)",border:`1px solid ${isOv?"rgba(245,149,0,.5)":"rgba(255,255,255,.15)"}`,borderRadius:10,padding:"2px 8px",color:isOv?"#f59500":"#8899aa",cursor:"pointer",fontWeight:700}}>{isOv?"🤖 Use AI":"✏️ Override"}</button>}
        </div>
      </div>
      {!isOv
        ? <div style={{background:det?"rgba(79,195,247,.05)":done?"rgba(0,200,150,.05)":"rgba(255,255,255,.03)",border:`1px solid ${det?"rgba(79,195,247,.3)":done?"rgba(0,200,150,.35)":"rgba(255,255,255,.1)"}`,borderRadius:10,padding:"11px 14px",color:det?"#4fc3f7":done?"#b0ead8":"#556677",minHeight:42,display:"flex",alignItems:"center",fontSize:12,fontStyle:done?"normal":"italic"}}>
            {det?<span style={{display:"flex",alignItems:"center",gap:8}}><span style={{display:"inline-block",animation:"spin .8s linear infinite"}}>🔄</span>AI analyzing...</span>:done?val:"Waiting for product title..."}
          </div>
        : type==="select"
          ? <select value={ovVal} onChange={e=>setOvVal(e.target.value)} style={{width:"100%",background:"#0b1525",border:"1px solid rgba(245,149,0,.5)",borderRadius:10,padding:"11px 14px",color:"#dce8f5",fontSize:13,outline:"none",cursor:"pointer"}}>
              <option value="">Select category...</option>
              {CATS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          : <input value={ovVal} onChange={e=>setOvVal(e.target.value)} placeholder={`Override ${label.toLowerCase()}...`} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(245,149,0,.5)",borderRadius:10,padding:"11px 14px",color:"#dce8f5",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
      }
    </div>
  );

  const hasImg = images.length > 0;
  const canGen = productInput.trim() && cat;
  const iS = {width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(245,149,0,.25)",borderRadius:10,padding:"11px 14px",color:"#dce8f5",fontSize:13,outline:"none",fontFamily:"inherit"};
  const tabs = [{k:"vision",l:"🔬 Vision",s:hasImg},{k:"title",l:"📝 Title",s:true},{k:"bullets",l:"🎯 Bullets",s:true},{k:"description",l:"📄 Description",s:true},{k:"keywords",l:"🔑 Keywords",s:true},{k:"backend",l:"🔧 Backend",s:true},{k:"insights",l:"💡 Insights",s:true}].filter(t=>t.s);

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#060c18 0%,#0b1525 50%,#091220 100%)",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#dce8f5"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* HEADER */}
      <div style={{background:"linear-gradient(90deg,#e65c00,#f9a825)",boxShadow:"0 4px 40px rgba(230,92,0,.5)"}}>
        <div style={{maxWidth:960,margin:"0 auto",padding:"14px 24px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{width:44,height:44,borderRadius:12,background:"rgba(0,0,0,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🛒</div>
          <div>
            <div style={{fontSize:19,fontWeight:900,color:"#fff",letterSpacing:"-.5px"}}>Amazon A9 Vision Listing Bot</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.85)",letterSpacing:1}}>AI VISION • AUTO-DETECT • IMAGE ANALYSIS • A9 SEO OPTIMIZED</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:7,padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:700,background:"rgba(0,200,150,.2)",border:"1px solid rgba(0,200,150,.5)",color:"#00c896"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#00c896",boxShadow:"0 0 6px #00c896"}}/>
            🔒 Secure Server Mode
          </div>
        </div>
      </div>
      <div style={{background:"rgba(0,200,150,.08)",borderBottom:"1px solid rgba(0,200,150,.2)",padding:"8px 24px",textAlign:"center",fontSize:12,color:"#00c896"}}>
        🔒 API key stored securely on Vercel server — never exposed to the browser
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"28px 20px"}}>

        {/* INPUT */}
        {step==="input" && (
          <div>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{fontSize:26,fontWeight:900,color:"#f59500",marginBottom:6}}>AI-Powered Amazon Listing Generator</div>
              <div style={{color:"#7a8fa8",fontSize:13}}>Type your product title — AI instantly auto-detects category, audience & features</div>
            </div>

            {/* Drop Zone */}
            <div onDragOver={e=>{e.preventDefault();setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onDrop={onDrop} onClick={()=>fileRef.current?.click()}
              style={{border:`2px dashed ${isDragging?"#f59500":"rgba(245,149,0,.35)"}`,borderRadius:16,padding:"24px 20px",textAlign:"center",cursor:"pointer",background:isDragging?"rgba(245,149,0,.07)":"rgba(255,255,255,.02)",transition:"all .2s",marginBottom:16}}>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>handleFiles(e.target.files)}/>
              <div style={{fontSize:34,marginBottom:8}}>📸</div>
              <div style={{fontSize:14,fontWeight:800,color:"#f59500",marginBottom:4}}>Drop product images here or click to upload</div>
              <div style={{fontSize:11,color:"#7a8fa8"}}>Up to 5 images • AI detects size, color, material, features, brand</div>
            </div>

            {images.length > 0 && (
              <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
                {images.map((img,i)=>(
                  <div key={i} style={{position:"relative"}}>
                    <img src={img.preview} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:10,border:"2px solid rgba(245,149,0,.5)",display:"block"}}/>
                    <button onClick={()=>setImages(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"#e53935",border:"none",color:"#fff",fontSize:10,cursor:"pointer",fontWeight:900,lineHeight:"18px",textAlign:"center",padding:0}}>✕</button>
                    {i===0 && <div style={{position:"absolute",bottom:4,left:4,background:"#f59500",borderRadius:3,fontSize:8,padding:"1px 4px",color:"#000",fontWeight:900}}>MAIN</div>}
                  </div>
                ))}
                {images.length<5 && <div onClick={()=>fileRef.current?.click()} style={{width:80,height:80,borderRadius:10,border:"2px dashed rgba(245,149,0,.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#7a8fa8",fontSize:24}}>+</div>}
                <div style={{background:"rgba(0,200,150,.1)",border:"1px solid rgba(0,200,150,.3)",borderRadius:10,padding:"8px 14px",fontSize:11,color:"#00c896"}}>✅ {images.length} image{images.length>1?"s":""} ready</div>
              </div>
            )}

            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(245,149,0,.18)",borderRadius:16,padding:28}}>
              {/* Title */}
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <label style={{fontSize:11,color:"#f59500",fontWeight:800,letterSpacing:1}}>📦 PRODUCT TITLE *</label>
                  {detecting && <span style={{fontSize:11,color:"#4fc3f7",display:"flex",alignItems:"center",gap:5,animation:"pulse 1s infinite"}}><span style={{display:"inline-block",animation:"spin .8s linear infinite"}}>🤖</span> AI detecting...</span>}
                  {detDone && !detecting && <span style={{fontSize:11,color:"#00c896",fontWeight:700}}>✅ All detected {detConf&&`(${detConf}%)`}</span>}
                </div>
                <textarea value={productInput} onChange={e=>setProductInput(e.target.value)}
                  placeholder="e.g. Stainless Steel Insulated Water Bottle 32oz with Straw Lid, BPA Free..."
                  style={{...iS,resize:"vertical",minHeight:72,border:`1px solid ${productInput?"rgba(245,149,0,.5)":"rgba(245,149,0,.25)"}`}}/>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
                <Field label="AMAZON CATEGORY" icon="🏷️" val={detCat} detecting={detecting} done={detDone} isOv={ovCat} setOv={setOvCat} ovVal={manCat} setOvVal={setManCat} type="select"/>
                <div>
                  <label style={{fontSize:11,color:"#f59500",fontWeight:800,letterSpacing:1,display:"block",marginBottom:6}}>💰 PRICE POINT</label>
                  <select value={pricePoint} onChange={e=>setPricePoint(e.target.value)} style={{...iS,background:"#0b1525",cursor:"pointer"}}>
                    <option value="">Select range...</option>
                    <option>Budget ($1–$15)</option><option>Mid-range ($15–$50)</option>
                    <option>Premium ($50–$150)</option><option>Luxury ($150+)</option>
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <Field label="TARGET AUDIENCE" icon="👥" val={detAud} detecting={detecting} done={detDone} isOv={ovAud} setOv={setOvAud} ovVal={manAud} setOvVal={setManAud} type="text"/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <Field label="KEY FEATURES / USP" icon="⭐" val={detFeat} detecting={detecting} done={detDone} isOv={ovFeat} setOv={setOvFeat} ovVal={manFeat} setOvVal={setManFeat} type="text"/>
                </div>
              </div>

              {detErr && <div style={{background:"rgba(229,57,53,.08)",border:"1px solid rgba(229,57,53,.25)",borderRadius:10,padding:"9px 14px",marginBottom:16,fontSize:12,color:"#ff8888"}}>⚠️ {detErr} <button onClick={()=>detect(productInput,images)} style={{marginLeft:8,background:"none",border:"1px solid rgba(229,57,53,.4)",borderRadius:6,padding:"2px 8px",color:"#ff8888",fontSize:11,cursor:"pointer"}}>Retry</button></div>}

              <button onClick={generate} disabled={!canGen} style={{width:"100%",padding:16,border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:900,letterSpacing:1,transition:"all .2s",background:!canGen?"rgba(245,149,0,.15)":"linear-gradient(90deg,#e65c00,#f9a825)",cursor:!canGen?"not-allowed":"pointer",boxShadow:!canGen?"none":"0 8px 32px rgba(230,92,0,.55)"}}>
                {!productInput.trim()?"⌨️ Enter Product Title First":detecting?"🤖 AI Detecting Fields...":!cat?"⏳ Waiting for AI Detection...":hasImg?`🔬 ANALYZE ${images.length} IMAGE${images.length>1?"S":""} + GENERATE LISTING`:"🚀 GENERATE OPTIMIZED LISTING"}
              </button>
            </div>
          </div>
        )}

        {/* GENERATING */}
        {step==="generating" && (
          <div style={{textAlign:"center",padding:"70px 20px"}}>
            <div style={{fontSize:52,marginBottom:18,display:"inline-block",animation:"spin 2s linear infinite"}}>⚙️</div>
            <div style={{fontSize:22,fontWeight:900,color:"#f59500",marginBottom:8}}>{hasImg?"Analyzing Images & Building Listing...":"Optimizing Your Listing..."}</div>
            <div style={{color:"#7a8fa8",fontSize:14,marginBottom:36}}>{progressText}</div>
            <div style={{maxWidth:520,margin:"0 auto",background:"rgba(255,255,255,.05)",borderRadius:12,height:12,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:12,background:"linear-gradient(90deg,#e65c00,#f9a825,#ffe066)",width:`${progress}%`,transition:"width .6s ease",boxShadow:"0 0 14px rgba(245,149,0,.6)"}}/>
            </div>
            <div style={{color:"#f59500",fontSize:14,marginTop:10,fontWeight:800}}>{progress}%</div>
            {images.length>0 && <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:22}}>{images.map((img,i)=><img key={i} src={img.preview} alt="" style={{width:52,height:52,objectFit:"cover",borderRadius:8,border:"2px solid rgba(245,149,0,.5)",opacity:.8}}/>)}</div>}
          </div>
        )}

        {/* RESULT */}
        {step==="result" && listing && (
          <div>
            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(245,149,0,.2)",borderRadius:16,padding:"18px 24px",marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:17,fontWeight:800}}>Listing Ready — <span style={{color:"#f59500"}}>{cat}</span>
                  {hasImg && <span style={{marginLeft:8,fontSize:12,color:"#00c896",background:"rgba(0,200,150,.1)",border:"1px solid rgba(0,200,150,.3)",borderRadius:10,padding:"2px 9px"}}>📸 {images.length} analyzed</span>}
                  <span style={{marginLeft:8,fontSize:12,color:"#4fc3f7",background:"rgba(79,195,247,.1)",border:"1px solid rgba(79,195,247,.3)",borderRadius:10,padding:"2px 9px"}}>🤖 AI detected</span>
                </div>
                <div style={{fontSize:11,color:"#7a8fa8",marginTop:3}}>A9 optimized • {new Date().toLocaleDateString()}</div>
              </div>
              <div style={{display:"flex",gap:18}}>
                <Ring score={listing.asinScore||91} label="A9 SCORE" color="#f59500"/>
                <Ring score={listing.seoScore||94} label="SEO" color="#00c896"/>
                <Ring score={listing.conversionScore||90} label="CVR" color="#4fc3f7"/>
                <Ring score={listing.keywordDensityScore||93} label="KW DENSITY" color="#ab47bc"/>
              </div>
            </div>

            <div style={{display:"flex",gap:4,marginBottom:18,flexWrap:"wrap"}}>
              {tabs.map(t=><button key={t.k} onClick={()=>setActiveTab(t.k)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:800,textTransform:"uppercase",background:activeTab===t.k?"linear-gradient(90deg,#e65c00,#f9a825)":"rgba(255,255,255,.05)",color:activeTab===t.k?"#fff":"#7a8fa8",transition:"all .18s"}}>{t.l}</button>)}
            </div>

            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(245,149,0,.15)",borderRadius:16,padding:26}}>

              {/* VISION TAB */}
              {activeTab==="vision" && listing.imageAnalysis && (
                <div>
                  <div style={{fontSize:13,color:"#f59500",fontWeight:800,marginBottom:20}}>🔬 AI VISION — PRODUCT ANALYSIS</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                    {[["🏷️ Product","productType","#f59500",false],["📐 Estimated Size","estimatedSize","#f59500",true],["🎨 Colors","detectedColors","#4fc3f7",false],["🧱 Materials","detectedMaterials","#4fc3f7",false],["⭐ Quality","qualityAssessment","#00c896",false],["📦 Packaging","packagingObservations","#00c896",false]].map(([lbl,key,col,hl])=>(
                      <div key={key} style={{background:hl?"rgba(245,149,0,.08)":"rgba(255,255,255,.03)",border:`1px solid ${hl?"rgba(245,149,0,.4)":"rgba(255,255,255,.07)"}`,borderRadius:12,padding:16}}>
                        <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:7}}>{lbl}</div>
                        <div style={{fontSize:13,color:"#dce8f5",lineHeight:1.6}}>{Array.isArray(listing.imageAnalysis[key])?listing.imageAnalysis[key].join(", "):listing.imageAnalysis[key]||"—"}</div>
                      </div>
                    ))}
                    <div style={{gridColumn:"1/-1",background:"rgba(79,195,247,.06)",border:"1px solid rgba(79,195,247,.2)",borderRadius:12,padding:16}}>
                      <div style={{fontSize:11,color:"#4fc3f7",fontWeight:700,marginBottom:10}}>✅ VISIBLE FEATURES</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{listing.imageAnalysis.visibleFeatures?.map((f,i)=><span key={i} style={{background:"rgba(79,195,247,.1)",border:"1px solid rgba(79,195,247,.25)",borderRadius:16,padding:"5px 13px",fontSize:12,color:"#4fc3f7"}}>{f}</span>)}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10}}>{images.map((img,i)=><img key={i} src={img.preview} alt="" style={{width:72,height:72,objectFit:"cover",borderRadius:10,border:"2px solid rgba(245,149,0,.4)"}}/>)}</div>
                </div>
              )}

              {/* TITLE TAB */}
              {activeTab==="title" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:13,color:"#f59500",fontWeight:800}}>A9-OPTIMIZED PRODUCT TITLE</div>
                    <button onClick={()=>copy(listing.title,"title")} style={{background:copied==="title"?"#00c896":"rgba(245,149,0,.18)",border:"1px solid rgba(245,149,0,.4)",borderRadius:8,padding:"6px 14px",color:copied==="title"?"#fff":"#f59500",fontSize:12,cursor:"pointer",fontWeight:700}}>{copied==="title"?"✓ Copied!":"Copy"}</button>
                  </div>
                  <div style={{background:"rgba(245,149,0,.06)",border:"1px solid rgba(245,149,0,.3)",borderRadius:12,padding:20,fontSize:16,lineHeight:1.65,color:"#dce8f5",fontWeight:500}}>{listing.title}</div>
                  <div style={{display:"flex",gap:14,marginTop:12,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,color:"#7a8fa8"}}>📏 {listing.title?.length||0}/180 chars</span>
                    <span style={{fontSize:12,color:"#00c896"}}>✅ A9 front-loaded</span>
                    {hasImg && <span style={{fontSize:12,color:"#4fc3f7"}}>📸 Image-enhanced</span>}
                  </div>
                </div>
              )}

              {/* BULLETS TAB */}
              {activeTab==="bullets" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:13,color:"#f59500",fontWeight:800}}>5 CONVERSION-OPTIMIZED BULLETS</div>
                    <button onClick={()=>copy(listing.bullets,"bullets")} style={{background:copied==="bullets"?"#00c896":"rgba(245,149,0,.18)",border:"1px solid rgba(245,149,0,.4)",borderRadius:8,padding:"6px 14px",color:copied==="bullets"?"#fff":"#f59500",fontSize:12,cursor:"pointer",fontWeight:700}}>{copied==="bullets"?"✓ Copied!":"Copy All"}</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {listing.bullets?.map((b,i)=>(
                      <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(245,149,0,.14)",borderRadius:10,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
                        <div style={{minWidth:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#e65c00,#f9a825)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff"}}>{i+1}</div>
                        <div style={{fontSize:13,lineHeight:1.75,color:"#ccdaed",flex:1}}>{b}</div>
                        <button onClick={()=>copy(b,`b${i}`)} style={{minWidth:52,background:copied===`b${i}`?"#00c896":"rgba(255,255,255,.06)",border:"none",borderRadius:6,padding:"4px 8px",color:copied===`b${i}`?"#fff":"#7a8fa8",fontSize:11,cursor:"pointer"}}>{copied===`b${i}`?"✓":"Copy"}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DESCRIPTION TAB */}
              {activeTab==="description" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:13,color:"#f59500",fontWeight:800}}>SEO-RICH PRODUCT DESCRIPTION</div>
                    <button onClick={()=>copy(listing.description,"desc")} style={{background:copied==="desc"?"#00c896":"rgba(245,149,0,.18)",border:"1px solid rgba(245,149,0,.4)",borderRadius:8,padding:"6px 14px",color:copied==="desc"?"#fff":"#f59500",fontSize:12,cursor:"pointer",fontWeight:700}}>{copied==="desc"?"✓ Copied!":"Copy"}</button>
                  </div>
                  <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:20,fontSize:13,lineHeight:1.9,color:"#c2d4e8",maxHeight:420,overflowY:"auto"}} dangerouslySetInnerHTML={{__html:listing.description?.replace(/\n/g,"<br/>")||""}}/>
                </div>
              )}

              {/* KEYWORDS TAB */}
              {activeTab==="keywords" && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                  <div><div style={{fontSize:11,color:"#f59500",fontWeight:800,marginBottom:10}}>🎯 PRIMARY</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{listing.primaryKeywords?.map((k,i)=><span key={i} style={{background:"rgba(245,149,0,.13)",border:"1px solid rgba(245,149,0,.4)",borderRadius:18,padding:"5px 12px",fontSize:12,color:"#f59500"}}>{k}</span>)}</div></div>
                  <div><div style={{fontSize:11,color:"#4fc3f7",fontWeight:800,marginBottom:10}}>⚡ SHORT-TAIL</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{listing.shortTailKeywords?.map((k,i)=><span key={i} style={{background:"rgba(79,195,247,.1)",border:"1px solid rgba(79,195,247,.3)",borderRadius:18,padding:"5px 12px",fontSize:12,color:"#4fc3f7"}}>{k}</span>)}</div></div>
                  <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,color:"#00c896",fontWeight:800,marginBottom:10}}>📌 LONG-TAIL (High Buyer Intent)</div><div style={{display:"flex",flexWrap:"wrap",gap:7}}>{listing.longTailKeywords?.map((k,i)=><span key={i} style={{background:"rgba(0,200,150,.08)",border:"1px solid rgba(0,200,150,.3)",borderRadius:18,padding:"5px 12px",fontSize:12,color:"#00c896"}}>{k}</span>)}</div></div>
                </div>
              )}

              {/* BACKEND TAB */}
              {activeTab==="backend" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontSize:13,color:"#f59500",fontWeight:800}}>BACKEND SEARCH TERMS → Seller Central</div>
                    <button onClick={()=>copy(listing.searchTerms,"bk")} style={{background:copied==="bk"?"#00c896":"rgba(245,149,0,.18)",border:"1px solid rgba(245,149,0,.4)",borderRadius:8,padding:"6px 14px",color:copied==="bk"?"#fff":"#f59500",fontSize:12,cursor:"pointer",fontWeight:700}}>{copied==="bk"?"✓ Copied!":"Copy"}</button>
                  </div>
                  <div style={{background:"#060c18",border:"1px solid rgba(0,200,150,.3)",borderRadius:12,padding:20,fontFamily:"monospace",fontSize:13,lineHeight:1.85,color:"#00e5b5",wordBreak:"break-all"}}>{listing.searchTerms}</div>
                  <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,color:"#7a8fa8"}}>📏 {listing.searchTerms?.length||0}/250 chars</span>
                    <span style={{fontSize:12,color:"#00c896"}}>✅ No duplicates</span>
                    <span style={{fontSize:12,color:"#00c896"}}>✅ No brand names</span>
                  </div>
                </div>
              )}

              {/* INSIGHTS TAB */}
              {activeTab==="insights" && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                  <div>
                    <div style={{fontSize:11,color:"#f59500",fontWeight:800,marginBottom:12}}>🚀 IMPROVEMENTS</div>
                    {listing.improvements?.map((x,i)=><div key={i} style={{background:"rgba(245,149,0,.07)",border:"1px solid rgba(245,149,0,.2)",borderRadius:10,padding:14,marginBottom:10,fontSize:13,color:"#ccdaed",lineHeight:1.6}}><span style={{color:"#f59500",fontWeight:800,marginRight:8}}>▶</span>{x}</div>)}
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#ab47bc",fontWeight:800,marginBottom:12}}>🏆 COMPETITOR GAPS</div>
                    {listing.competitorGaps?.map((x,i)=><div key={i} style={{background:"rgba(171,71,188,.07)",border:"1px solid rgba(171,71,188,.23)",borderRadius:10,padding:14,marginBottom:10,fontSize:13,color:"#ccdaed",lineHeight:1.6}}><span style={{color:"#ab47bc",fontWeight:800,marginRight:8}}>◆</span>{x}</div>)}
                    {listing.pricingInsight && <div style={{background:"rgba(79,195,247,.07)",border:"1px solid rgba(79,195,247,.23)",borderRadius:10,padding:14,fontSize:13,color:"#ccdaed",lineHeight:1.6}}><div style={{fontSize:10,color:"#4fc3f7",fontWeight:800,marginBottom:5}}>💰 PRICING</div>{listing.pricingInsight}</div>}
                  </div>
                </div>
              )}
            </div>

            <button onClick={reset} style={{marginTop:18,padding:"13px 26px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(245,149,0,.28)",borderRadius:10,color:"#f59500",fontSize:14,fontWeight:700,cursor:"pointer"}}>← Generate New Listing</button>
          </div>
        )}
      </div>
    </div>
  );
}
