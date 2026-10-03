const {GoogleGenAI}=require("@google/genai");
const {createClient}=require("@supabase/supabase-js");
const MODEL="gemini-2.5-flash";
const SYSTEM_PROMPT=`You are the analysis engine for RoleMap, a career-transition product for professionals with 1-6 years of experience.
Compare a genuine target job description with only the supplied current role, experience band and strongest functional area.
Return exactly three evidence gaps, one 7-day proof action for each, and a short readiness summary.
Rules:
- Judge only against requirements stated in the job description.
- Do not infer education, employers, credentials, intelligence, personality, protected traits or hiring probability.
- If evidence is missing, say "not shown in the information provided".
- Use "evidence gap" or "likely evidence gap", never "you lack this skill".
- If the text is not a genuine job description with responsibilities or requirements, refuse to evaluate the person and ask for a job description.
- Never judge worth or ability and never invent experience.
- Each action must be doable within 7 days and create a visible artifact.
Return JSON only: {"readiness_summary":"max 45 words","gaps":[{"skill":"short label","why":"max 45 words","action":"max 45 words"}]}
Exactly 3 gaps. Keep the response under 350 output tokens. Tone: direct, calm, practical.`;
const safe=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const validVisitor=v=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);
const looksLikeJD=t=>t.length>=180&&/(responsibilit|requirement|qualification|what you('ll| will) do|role)/i.test(t)&&/(experience|skills|candidate|ability|years|proficien)/i.test(t);
module.exports=async function handler(req,res){
if(req.method!=="POST")return res.status(405).json({error:"Method not allowed."});
try{
const b=req.body||{},jobDescription=safe(b.jobDescription,6000),currentRole=safe(b.currentRole,60),experience=safe(b.experience,30),strongestArea=safe(b.strongestArea,60),visitor=req.headers["x-visitor-id"];
if(!jobDescription||!currentRole||!experience||!strongestArea)return res.status(400).json({error:"Complete all four fields."});
if(!validVisitor(visitor))return res.status(400).json({error:"Invalid visitor session. Refresh and try again."});
if(!looksLikeJD(jobDescription))return res.status(400).json({error:"RoleMap needs a genuine job description with responsibilities or requirements before it can run a gap scan."});
if(!process.env.GEMINI_API_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)throw new Error("Server environment is incomplete.");
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
const since24=new Date(Date.now()-86400000).toISOString();
const {count,error:countError}=await supabase.from("analyses").select("*",{count:"exact",head:true}).eq("visitor_id",visitor).gte("created_at",since24);
if(countError)throw countError;
if((count||0)>=3)return res.status(429).json({error:"You have used today's 3 scans. Try again tomorrow."});
const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
const response=await ai.models.generateContent({model:MODEL,contents:JSON.stringify({jobDescription,currentRole,experience,strongestArea}),config:{systemInstruction:SYSTEM_PROMPT,responseMimeType:"application/json",maxOutputTokens:350,temperature:.25}});
const parsed=JSON.parse(response.text);
if(!parsed||typeof parsed.readiness_summary!=="string"||!Array.isArray(parsed.gaps)||parsed.gaps.length!==3)throw new Error("Unexpected model response.");
const gaps=parsed.gaps.map(g=>({skill:safe(g.skill,80),why:safe(g.why,400),action:safe(g.action,400)}));
if(gaps.some(g=>!g.skill||!g.why||!g.action))throw new Error("Incomplete model response.");
const usage=response.usageMetadata||{};
const {error:insertError}=await supabase.from("analyses").insert({visitor_id:visitor,input_text:jobDescription,role_level:currentRole,experience_level:experience,strongest_area:strongestArea,skill_gaps:gaps.map(g=>g.skill),output:{readiness_summary:safe(parsed.readiness_summary,500),gaps},input_tokens:usage.promptTokenCount||null,output_tokens:usage.candidatesTokenCount||null});
if(insertError)throw insertError;
const since7=new Date(Date.now()-7*86400000).toISOString();
const {data,error:readError}=await supabase.from("analyses").select("skill_gaps").gte("created_at",since7).limit(100);
if(readError)throw readError;
const freq={};(data||[]).flatMap(r=>r.skill_gaps||[]).forEach(s=>freq[s]=(freq[s]||0)+1);
const top_skills=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([s])=>s);
return res.status(200).json({readiness_summary:safe(parsed.readiness_summary,500),gaps,top_skills});
}catch(err){console.error("RoleMap analyze error:",err?.message);return res.status(500).json({error:"The scan could not be completed. Please try again."})}
};