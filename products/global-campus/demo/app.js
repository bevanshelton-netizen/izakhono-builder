const demoModules = [
  {code:"DEMO101",institution:"Illustrative Demo University",qualification:"Illustrative Bachelor of Commerce",title:"Introduction to Financial Accounting",topics:["accounting equation","debits and credits","financial statements"],outcomes:["prepare basic financial statements","explain the accounting equation"],guide:"Accounting Foundations: Concepts and Worked Examples",kind:"Concept guide",language:"English",status:"Illustrative test record"},
  {code:"DEMO202",institution:"Illustrative Demo University",qualification:"Illustrative Bachelor of Social Science",title:"Introduction to Research Methods",topics:["research design","sampling","qualitative research","quantitative research"],outcomes:["distinguish research approaches","design a basic research question"],guide:"Research Methods Made Clear",kind:"Study skills guide",language:"English",status:"Illustrative test record"},
  {code:"DEMO303",institution:"Illustrative Technical Institute",qualification:"Illustrative Diploma in Information Technology",title:"Foundations of Data Analysis",topics:["data analysis","statistics","data cleaning","visualisation"],outcomes:["interpret descriptive statistics","prepare a simple data summary"],guide:"Practical Data Analysis: A Beginner's Workbook",kind:"Practical workbook",language:"English",status:"Illustrative test record"}
];
const form=document.querySelector("#search-form");
const queryInput=document.querySelector("#query");
const results=document.querySelector("#results");
const count=document.querySelector("#result-count");
const title=document.querySelector("#results-title");
const empty=document.querySelector("#empty-state");
function render(items,query=""){
  results.replaceChildren();
  count.textContent=`${items.length} demo resource${items.length===1?"":"s"}`;
  title.textContent=query?`Results for “${query}”`:"Explore learning resources";
  empty.hidden=items.length!==0;
  for(const item of items){
    const card=document.createElement("article");card.className="resource-card";
    const tag=document.createElement("span");tag.className="tag";tag.textContent=item.kind;
    const h=document.createElement("h3");h.textContent=item.guide;
    const p=document.createElement("p");p.textContent=`Supports ${item.title}. Topics: ${item.topics.join(", ")}.`;
    const demo=document.createElement("span");demo.className="demo-label";demo.textContent="DEMO DATA · NOT A REAL CURRICULUM";
    const meta=document.createElement("div");meta.className="meta";meta.textContent=`${item.institution} · ${item.qualification} · ${item.code} · ${item.language}`;
    card.append(tag,h,p,demo,meta);results.append(card);
  }
}
function search(q){
  const tokens=q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if(!tokens.length){render(demoModules);return}
  const matches=demoModules.map(item=>{
    const text=[item.code,item.institution,item.qualification,item.title,...item.topics,...item.outcomes,item.guide].join(" ").toLocaleLowerCase();
    const hits=tokens.filter(token=>text.includes(token)).length;
    return {item,score:hits/tokens.length};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.item);
  render(matches,q);
}
form.addEventListener("submit",event=>{event.preventDefault();search(queryInput.value.trim())});
document.querySelectorAll("[data-query]").forEach(button=>button.addEventListener("click",()=>{queryInput.value=button.dataset.query;search(button.dataset.query)}));
render(demoModules);
