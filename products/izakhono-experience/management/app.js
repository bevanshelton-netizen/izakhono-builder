(() => {
  "use strict";
  let token = "";
  let selectedSurvey = "";
  const $ = (id) => document.getElementById(id);
  const status = (message, error=false) => {
    $("session-status").textContent = message;
    $("session-status").classList.toggle("error", error);
  };
  const notice = (message, error=false) => {
    $("notice").textContent = message;
    $("notice").classList.toggle("error", error);
  };
  async function api(path, options={}) {
    const headers = {"Authorization":"Bearer " + token, "Accept":"application/json"};
    if (options.body !== undefined) headers["Content-Type"]="application/json";
    const response = await fetch("/api/v1" + path, {
      method: options.method || "GET", headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials:"same-origin", cache:"no-store", redirect:"error"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed (" + response.status + ")");
    return data;
  }
  function element(tag, className, text) {
    const node=document.createElement(tag);
    if (className) node.className=className;
    if (text !== undefined) node.textContent=String(text);
    return node;
  }
  async function loadSurveys() {
    const data=await api("/surveys");
    $("survey-count").textContent=data.surveys.length;
    $("active-count").textContent=data.surveys.filter(x=>x.status==="active").length;
    const list=$("surveys"); list.replaceChildren();
    if (!data.surveys.length) list.append(element("p","muted","No surveys yet. Create your first draft."));
    data.surveys.forEach(survey=>{
      const item=element("button","list-item");
      item.type="button";
      const left=element("span","item-main");
      left.append(element("strong","",survey.name),element("small","",survey.metric+" · "+survey.status));
      item.append(left,element("span","arrow","›"));
      item.addEventListener("click",()=>openSurvey(survey.id));
      list.append(item);
    });
  }
  async function loadCases() {
    const data=await api("/cases");
    const open=data.cases.filter(x=>!["closed","resolved","unable_to_resolve"].includes(x.status));
    $("case-count").textContent=open.length;
    const list=$("cases"); list.replaceChildren();
    if (!data.cases.length) list.append(element("p","muted","No cases recorded."));
    data.cases.forEach(item=>{
      const row=element("article","case-row");
      const info=element("div","item-main");
      info.append(element("strong","",item.severity.toUpperCase()+" · "+item.status.replaceAll("_"," ")),
                  element("small","",item.id+" · updated "+item.updated_at));
      row.append(info);
      if (item.status==="in_progress") {
        const resolve=element("button","button secondary","Resolve");
        resolve.addEventListener("click",async()=>{
          const note=window.prompt("Record the resolution outcome:");
          if (!note || !note.trim()) return;
          try { await api("/cases/"+encodeURIComponent(item.id)+"/transition",{method:"POST",body:{status:"resolved",resolution_note:note,expected_version:item.version}}); await loadCases(); notice("Case resolved and recorded."); }
          catch(error){notice(error.message,true);}
        });
        row.append(resolve);
      }
      list.append(row);
    });
  }
  async function openSurvey(id) {
    selectedSurvey=id;
    const data=await api("/surveys/"+encodeURIComponent(id));
    $("survey-detail").hidden=false;
    $("detail-title").textContent=data.survey.name;
    $("detail-meta").textContent=data.survey.metric+" · "+data.survey.status;
    $("activate").hidden=data.survey.status!=="draft";
    const list=$("questions"); list.replaceChildren();
    if (!data.questions.length) list.append(element("p","muted","Add the first question to this draft."));
    data.questions.forEach(q=>{
      list.append(element("article","question-row",q.position+". "+q.prompt+" · "+q.kind));
    });
    $("add-question").hidden=data.survey.status!=="draft";
    $("nps-result").hidden=true;
    if (data.survey.metric==="NPS") {
      try {
        const result=await api("/surveys/"+encodeURIComponent(id)+"/metrics/nps");
        const r=result.nps;
        $("nps-result").hidden=false;
        $("nps-result").textContent=r.score===null?"NPS will appear after responses are collected.":"Current NPS: "+r.score+" · "+r.responses+" responses";
      } catch(error) { notice(error.message,true); }
    }
  }
  async function refreshAll() { await loadSurveys(); await loadCases(); }
  $("connect").addEventListener("click",async()=>{
    const supplied=$("session-token").value.trim();
    if (!supplied) {status("Enter an existing IZAKHONO ID session.",true);return;}
    token=supplied;
    try {
      await refreshAll();
      $("workspace").hidden=false;
      $("session-token").value="";
      status("Connected. Access is checked by ID and FORTRESS on every request.");
      notice("Workspace loaded.");
    } catch(error) {
      token="";
      status("Connection failed: "+error.message,true);
    }
  });
  $("disconnect").addEventListener("click",()=>{
    token="";selectedSurvey="";
    $("workspace").hidden=true;$("survey-detail").hidden=true;
    $("session-token").value="";
    status("Disconnected. The in-memory session has been cleared.");
  });
  $("refresh").addEventListener("click",()=>refreshAll().catch(e=>notice(e.message,true)));
  $("refresh-cases").addEventListener("click",()=>loadCases().catch(e=>notice(e.message,true)));
  $("create-survey").addEventListener("submit",async event=>{
    event.preventDefault();
    try {
      const survey=await api("/surveys",{method:"POST",body:{name:$("survey-name").value,metric:$("survey-metric").value}});
      $("create-survey").reset();await refreshAll();await openSurvey(survey.survey.id);
      notice("Draft survey created.");
    } catch(error){notice(error.message,true);}
  });
  $("add-question").addEventListener("submit",async event=>{
    event.preventDefault();
    if (!selectedSurvey) return;
    try {
      const existing=await api("/surveys/"+encodeURIComponent(selectedSurvey));
      const position=existing.questions.length;
      const body={position,kind:$("question-kind").value,prompt:$("question-prompt").value,required:$("question-required").checked};
      await api("/surveys/"+encodeURIComponent(selectedSurvey)+"/questions",{method:"POST",body});
      $("question-prompt").value="";await openSurvey(selectedSurvey);notice("Question added.");
    } catch(error){notice(error.message,true);}
  });
  $("activate").addEventListener("click",async()=>{
    if (!selectedSurvey || !window.confirm("Activate this survey? This does not publish a public survey link.")) return;
    try { await api("/surveys/"+encodeURIComponent(selectedSurvey)+"/activate",{method:"POST",body:{}});await refreshAll();await openSurvey(selectedSurvey);notice("Survey activated."); }
    catch(error){notice(error.message,true);}
  });
})();