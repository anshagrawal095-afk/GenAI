const form=document.getElementById("scanForm"),result=document.getElementById("result"),btn=document.getElementById("submit");
function visitorId(){let id=localStorage.getItem("rolemap_visitor_id");if(!id){id=crypto.randomUUID();localStorage.setItem("rolemap_visitor_id",id)}return id}
form.addEventListener("submit",async e=>{
e.preventDefault();btn.disabled=true;result.innerHTML='<div class="summary">Reading the job requirements…</div>';
const payload={jobDescription:document.getElementById("jd").value,currentRole:document.getElementById("role").value,experience:document.getElementById("exp").value,strongestArea:document.getElementById("strength").value};
try{
const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","X-Visitor-ID":visitorId()},body:JSON.stringify(payload)});
const d=await r.json();if(!r.ok)throw new Error(d.error||"Request failed");
result.innerHTML='<div class="summary"><b>Readiness summary</b><p>'+d.readiness_summary+'</p></div>'+d.gaps.map((g,i)=>'<div class="result-card"><b>'+(i+1)+'. '+g.skill+'</b><p>'+g.why+'</p><p><strong>7-day proof:</strong> '+g.action+'</p></div>').join("");
if(d.top_skills?.length)document.getElementById("skills").textContent=d.top_skills.join(" · ");
}catch(err){result.innerHTML='<div class="summary"><b>Could not run the scan.</b><p>'+err.message+'</p></div>'}
finally{btn.disabled=false}
});