(function(){
  "use strict";

  var STORAGE = {
    accepted: "izakhono_business_ai_privacy_v1",
    clients: "izakhono_business_ai_clients_v1",
    docs: "izakhono_business_ai_docs_v1",
    diagnostic: "izakhono_business_ai_diagnostic_v1",
    scenarioReport: "izakhono_business_ai_scenario_report_v3",
    calibrations: "izakhono_business_ai_calibrations_v1"
  };

  var state = {
    clients: read(STORAGE.clients, []),
    docs: read(STORAGE.docs, []),
    diagnostic: read(STORAGE.diagnostic, null),
    scenarioReport: read(STORAGE.scenarioReport, null),
    calibrations: read(STORAGE.calibrations, []),
    sourcePacket: []
  };

  function el(id){ return document.getElementById(id); }
  function all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function read(key, fallback){
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(_e){ return fallback; }
  }
  function save(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(_e){}
  }
  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }
  function money(value){
    return "R" + Number(value || 0).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function uid(prefix){
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  }
  function toast(message){
    var old = document.querySelector(".app-toast");
    if(old) old.remove();
    var node = document.createElement("div");
    node.className = "app-toast";
    node.textContent = message;
    node.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:100;background:#07152d;color:white;padding:12px 16px;border-radius:12px;box-shadow:0 18px 40px rgba(7,21,45,.25);font-weight:750";
    document.body.appendChild(node);
    setTimeout(function(){ node.remove(); },2200);
  }

  function initPrivacy(){
    var accepted = read(STORAGE.accepted, false);
    if(!accepted) el("privacyBanner").classList.remove("hidden");
    el("privacyAccept").addEventListener("click", function(){
      save(STORAGE.accepted, true);
      el("privacyBanner").classList.add("hidden");
    });
    el("privacyInfo").addEventListener("click", function(){
      document.getElementById("privacy").scrollIntoView({behavior:"smooth"});
    });
  }

  function initNavigation(){
    el("menuBtn").addEventListener("click", function(){ el("siteNav").classList.toggle("open"); });
    el("shareBtn").addEventListener("click", shareProduct);
    all(".start-app").forEach(function(btn){ btn.addEventListener("click", openWorkspace); });
    el("closeWorkspace").addEventListener("click", closeWorkspace);
    all(".workspace-tab").forEach(function(btn){
      btn.addEventListener("click", function(){ switchWorkspace(btn.getAttribute("data-view")); });
    });
    all("[data-go]").forEach(function(btn){
      btn.addEventListener("click", function(){ switchWorkspace(btn.getAttribute("data-go")); });
    });
  }

  function shareProduct(){
    var payload = {title:"IZAKHONO BUSINESS AI",text:"A privacy-first business assistant for clients, quotes, invoices, diagnostics and decision rehearsal.",url:window.location.href};
    if(navigator.share){ navigator.share(payload).catch(function(){}); return; }
    if(navigator.clipboard){ navigator.clipboard.writeText(window.location.href).then(function(){ toast("Link copied."); }); return; }
    toast("Copy the page address to share.");
  }

  function openWorkspace(){
    el("workspace").classList.remove("hidden");
    el("workspace").scrollIntoView({behavior:"auto"});
    renderAll();
    checkHealth();
  }
  function closeWorkspace(){
    el("workspace").classList.add("hidden");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function switchWorkspace(view){
    var titles = {
      overview:"Business overview",
      clients:"Clients",
      documents:"Quotes & invoices",
      writer:"AI Writer",
      diagnostic:"Growth Diagnostic",
      scenario:"Decision Lab"
    };
    all(".workspace-view").forEach(function(v){ v.classList.toggle("active", v.id === "view-" + view); });
    all(".workspace-tab").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-view") === view); });
    el("workspaceTitle").textContent = titles[view] || "Business AI";
  }

  function renderAll(){
    renderMetrics();
    renderClients();
    renderDocs();
    if(state.diagnostic){
      el("diagnosticScore").textContent = state.diagnostic.score;
      el("metricScore").textContent = state.diagnostic.score;
      el("diagnosticHeadline").textContent = state.diagnostic.headline || "Latest diagnostic";
      renderDiagnosticActions(state.diagnostic.actions || []);
    }
    if(state.scenarioReport){
      renderScenarioReport(state.scenarioReport);
    }
  }

  function renderMetrics(){
    el("metricClients").textContent = state.clients.length;
    el("metricDocs").textContent = state.docs.length;
    var total = state.docs.reduce(function(sum,d){ return sum + Number(d.total || 0); },0);
    el("metricValue").textContent = money(total);
    el("metricScore").textContent = state.diagnostic ? state.diagnostic.score : "—";
  }

  function renderClients(){
    el("clientCount").textContent = state.clients.length;
    var list = el("clientList");
    if(!state.clients.length){
      list.className = "record-list empty-state";
      list.textContent = "No clients yet.";
    } else {
      list.className = "record-list";
      list.innerHTML = state.clients.map(function(c){
        return '<div class="record"><div class="record-head"><div><h4>' + escapeHtml(c.name) + '</h4><p>' + escapeHtml(c.business || "Individual client") + '</p></div><span class="count-chip">C</span></div>' +
          '<p>' + escapeHtml([c.email,c.phone].filter(Boolean).join(" • ")) + '</p>' +
          (c.notes ? '<p>' + escapeHtml(c.notes) + '</p>' : '') +
          '<div class="record-actions"><button data-email="' + escapeHtml(c.email || "") + '" data-name="' + escapeHtml(c.name) + '">Email</button><button data-delete-client="' + escapeHtml(c.id) + '">Delete</button></div></div>';
      }).join("");
    }

    var select = el("docClient");
    var current = select.value;
    select.innerHTML = '<option value="">Select a client</option>' + state.clients.map(function(c){
      return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + (c.business ? " — " + escapeHtml(c.business) : "") + '</option>';
    }).join("");
    select.value = current;

    all("[data-delete-client]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id = btn.getAttribute("data-delete-client");
        state.clients = state.clients.filter(function(c){ return c.id !== id; });
        save(STORAGE.clients,state.clients); renderAll();
      });
    });
    all("[data-email]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var email = btn.getAttribute("data-email");
        var name = btn.getAttribute("data-name");
        if(!email){ toast("This client has no email address saved."); return; }
        window.location.href = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent("Hello " + name);
      });
    });
  }

  function renderDocs(){
    el("docCount").textContent = state.docs.length;
    var list = el("docList");
    if(!state.docs.length){
      list.className = "record-list empty-state";
      list.textContent = "No documents yet.";
    } else {
      list.className = "record-list";
      list.innerHTML = state.docs.slice().reverse().map(function(d){
        var client = state.clients.find(function(c){ return c.id === d.clientId; });
        return '<div class="record" id="doc-' + escapeHtml(d.id) + '">' +
          '<div class="record-head"><div><h4>' + escapeHtml(d.type) + ' ' + escapeHtml(d.number) + '</h4><p>' + escapeHtml(client ? client.name : "Unassigned client") + '</p></div><strong>' + money(d.total) + '</strong></div>' +
          '<p><strong>' + escapeHtml(d.description) + '</strong> — ' + escapeHtml(d.qty) + ' × ' + money(d.rate) + '</p>' +
          (d.notes ? '<p>' + escapeHtml(d.notes) + '</p>' : '') +
          '<div class="record-actions"><button data-print-doc="' + escapeHtml(d.id) + '">Print / PDF</button><button data-email-doc="' + escapeHtml(d.id) + '">Email</button><button data-delete-doc="' + escapeHtml(d.id) + '">Delete</button></div></div>';
      }).join("");
    }

    all("[data-delete-doc]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id = btn.getAttribute("data-delete-doc");
        state.docs = state.docs.filter(function(d){ return d.id !== id; });
        save(STORAGE.docs,state.docs); renderAll();
      });
    });
    all("[data-print-doc]").forEach(function(btn){
      btn.addEventListener("click", function(){ printDocument(btn.getAttribute("data-print-doc")); });
    });
    all("[data-email-doc]").forEach(function(btn){
      btn.addEventListener("click", function(){ emailDocument(btn.getAttribute("data-email-doc")); });
    });
  }

  function printDocument(id){
    var d = state.docs.find(function(x){ return x.id === id; });
    if(!d) return;
    var c = state.clients.find(function(x){ return x.id === d.clientId; });
    var w = window.open("","_blank","width=860,height=720");
    if(!w){ toast("Allow pop-ups to print this document."); return; }
    var html = '<!doctype html><html><head><title>' + escapeHtml(d.type + " " + d.number) + '</title><style>body{font-family:Arial,sans-serif;color:#0b1730;padding:46px}header{display:flex;justify-content:space-between;border-bottom:3px solid #0b4fd6;padding-bottom:18px}h1{margin:0}small{color:#66758a}.box{margin:30px 0;padding:18px;background:#f4f7fb}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #dce5ef}.total{font-size:28px;font-weight:800;text-align:right;margin-top:25px}</style></head><body>' +
      '<header><div><h1>IZAKHONO BUSINESS AI</h1><small>Business document</small></div><div><strong>' + escapeHtml(d.type) + '</strong><br>' + escapeHtml(d.number) + '</div></header>' +
      '<div class="box"><strong>Client</strong><br>' + escapeHtml(c ? c.name : "Unassigned") + (c && c.business ? '<br>' + escapeHtml(c.business) : '') + '</div>' +
      '<div class="row"><span>' + escapeHtml(d.description) + '</span><span>' + escapeHtml(d.qty) + ' × ' + money(d.rate) + '</span></div>' +
      '<div class="total">Total: ' + money(d.total) + '</div>' +
      (d.notes ? '<p><strong>Notes</strong><br>' + escapeHtml(d.notes) + '</p>' : '') +
      '<p><small>Created ' + escapeHtml(d.createdAt) + '</small></p></body></html>';
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(function(){ w.print(); },250);
  }

  function emailDocument(id){
    var d = state.docs.find(function(x){ return x.id === id; });
    if(!d) return;
    var c = state.clients.find(function(x){ return x.id === d.clientId; });
    if(!c || !c.email){ toast("Save an email address for this client first."); return; }
    var subject = d.type + " " + d.number + " — " + d.description;
    var body = "Hello " + c.name + ",\n\nPlease find the details for " + d.type.toLowerCase() + " " + d.number + ".\n\n" + d.description + "\nTotal: " + money(d.total) + "\n\n" + (d.notes || "") + "\n\nRegards";
    window.location.href = "mailto:" + encodeURIComponent(c.email) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function initForms(){
    el("clientForm").addEventListener("submit", function(e){
      e.preventDefault();
      state.clients.push({
        id:uid("client"), name:el("clientName").value.trim(), business:el("clientBusiness").value.trim(),
        email:el("clientEmail").value.trim(), phone:el("clientPhone").value.trim(), notes:el("clientNotes").value.trim(),
        createdAt:new Date().toISOString()
      });
      save(STORAGE.clients,state.clients); e.target.reset(); renderAll(); toast("Client saved.");
    });

    el("docForm").addEventListener("submit", function(e){
      e.preventDefault();
      var qty = Math.max(1,Number(el("docQty").value || 1));
      var rate = Math.max(0,Number(el("docRate").value || 0));
      var prefix = el("docType").value === "Invoice" ? "INV" : "Q";
      var number = prefix + "-" + String(Date.now()).slice(-7);
      state.docs.push({
        id:uid("doc"), number:number, type:el("docType").value, clientId:el("docClient").value,
        description:el("docDescription").value.trim(), qty:qty, rate:rate, total:qty*rate,
        notes:el("docNotes").value.trim(), createdAt:new Date().toLocaleDateString("en-ZA")
      });
      save(STORAGE.docs,state.docs); e.target.reset(); el("docQty").value="1"; el("docRate").value="0"; renderAll(); toast("Document created.");
    });

    el("writerForm").addEventListener("submit", runWriter);
    el("diagnosticForm").addEventListener("submit", runDiagnostic);
    el("scenarioForm").addEventListener("submit", runScenario);
    el("scenarioFiles").addEventListener("change", loadScenarioFiles);
    el("exportScenarioReport").addEventListener("click", exportScenarioReport);
    el("askWorldForm").addEventListener("submit", askSimulatedWorld);
    el("calibrationForm").addEventListener("submit", saveCalibration);

    el("copyDraft").addEventListener("click", function(){
      var text = el("writerOutput").textContent;
      if(navigator.clipboard){ navigator.clipboard.writeText(text).then(function(){ toast("Draft copied."); }); }
      else { toast("Copy the draft manually."); }
    });
    el("backupBtn").addEventListener("click", exportBackup);
  }

  async function runWriter(e){
    e.preventDefault();
    var output = el("writerOutput");
    output.textContent = "Drafting…";
    var payload = {
      purpose:el("writerPurpose").value,
      tone:el("writerTone").value,
      context:el("writerContext").value.trim()
    };
    try {
      var res = await fetch("/api/ai/correspondence",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      var data = await res.json();
      if(!data.ok) throw new Error(data.error || "Draft failed");
      output.textContent = (data.mode === "template" ? "TEMPLATE MODE — AI adapter not connected\n\n" : "") + data.draft;
    } catch(err){
      output.textContent = "Could not reach the Business AI engine. Your information has not been sent elsewhere.\n\n" + String(err.message || err);
    }
  }

  async function runDiagnostic(e){
    e.preventDefault();
    var payload = {
      leads:Number(el("diagLeads").value),
      followup:Number(el("diagFollowup").value),
      cash:Number(el("diagCash").value),
      admin:Number(el("diagAdmin").value)
    };
    try {
      var res = await fetch("/api/diagnostic",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      var data = await res.json();
      if(!data.ok) throw new Error(data.error || "Diagnostic failed");
      state.diagnostic = data;
      save(STORAGE.diagnostic,data);
      el("diagnosticScore").textContent = data.score;
      el("diagnosticHeadline").textContent = data.headline;
      renderDiagnosticActions(data.actions || []);
      renderMetrics();
    } catch(err){ toast(String(err.message || err)); }
  }

  function renderDiagnosticActions(actions){
    el("diagnosticActions").innerHTML = actions.map(function(a){ return "<div>" + escapeHtml(a) + "</div>"; }).join("");
  }

  function decodePdfLiteral(value){
    return value
      .replace(/\\([nrtbf()\\])/g,function(_m,ch){
        var map={n:"\n",r:"\r",t:"\t",b:"\b",f:"\f","(":"(",")":")","\\":"\\"};
        return map[ch] || ch;
      })
      .replace(/\\([0-7]{1,3})/g,function(_m,oct){ return String.fromCharCode(parseInt(oct,8)); });
  }

  async function extractPdfTextBasic(file){
    var buffer = await file.arrayBuffer();
    var raw = new TextDecoder("latin1").decode(new Uint8Array(buffer));
    var blocks = raw.match(/BT[\s\S]*?ET/g) || [];
    var parts = [];
    blocks.forEach(function(block){
      var literal=/\((?:\\.|[^\\)])*\)/g, match;
      while((match=literal.exec(block))){
        var value=decodePdfLiteral(match[0].slice(1,-1)).replace(/\s+/g," ").trim();
        if(value) parts.push(value);
      }
      var hex=/<([0-9A-Fa-f]{4,})>/g, hm;
      while((hm=hex.exec(block))){
        try{
          var bytes=[];
          for(var i=0;i<hm[1].length;i+=2) bytes.push(parseInt(hm[1].slice(i,i+2),16));
          var decoded=new TextDecoder("utf-8",{fatal:false}).decode(new Uint8Array(bytes)).replace(/\0/g,"").trim();
          if(decoded && /[A-Za-z]{2}/.test(decoded)) parts.push(decoded);
        }catch(_e){}
      }
    });
    var textValue=parts.join(" ").replace(/\s+/g," ").trim();
    return {
      text:textValue,
      compressed:/\/FlateDecode/.test(raw),
      method:"local-pdf-basic"
    };
  }

  async function loadScenarioFiles(event){
    var files = Array.prototype.slice.call(event.target.files || []).slice(0,10);
    state.sourcePacket = [];
    for(var i=0;i<files.length;i++){
      var file = files[i];
      var lower = file.name.toLowerCase();
      var isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
      var sizeLimit = isPdf ? 1500000 : 300000;
      if(file.size > sizeLimit){
        toast(file.name + " is over the local file limit.");
        continue;
      }
      var allowed = isPdf || lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json");
      if(!allowed){
        toast(file.name + " is not a supported evidence source.");
        continue;
      }
      try{
        var textValue="", extraction="browser-text";
        if(isPdf){
          var pdfResult=await extractPdfTextBasic(file);
          textValue=pdfResult.text;
          extraction=pdfResult.method;
          if(textValue.length < 80){
            toast(file.name + " could not be reliably extracted locally. A complex/scanned PDF will need the owned document extractor.");
            continue;
          }
        }else{
          textValue=await file.text();
        }
        state.sourcePacket.push({
          name:file.name.slice(0,120),
          type:(file.type || (isPdf ? "application/pdf" : "text/plain")).slice(0,80),
          text:textValue.slice(0,120000),
          size:file.size,
          extraction:extraction
        });
      }catch(_e){
        toast("Could not read " + file.name);
      }
    }
    renderSourceList();
  }

  function renderSourceList(){
    var list = el("sourceList");
    el("sourceCount").textContent = state.sourcePacket.length;
    if(!state.sourcePacket.length){
      list.className = "source-list empty-state";
      list.textContent = "No source files loaded.";
      return;
    }
    list.className = "source-list";
    list.innerHTML = state.sourcePacket.map(function(source,index){
      return '<div class="source-item"><div><strong>' + escapeHtml(source.name) + '</strong><small>' +
        Math.max(1,Math.round(source.size/1024)) + ' KB • ' + escapeHtml(source.extraction || "browser-text") +
        '</small></div><button type="button" data-remove-source="' + index + '">Remove</button></div>';
    }).join("");
    all("[data-remove-source]").forEach(function(btn){
      btn.addEventListener("click",function(){
        state.sourcePacket.splice(Number(btn.getAttribute("data-remove-source")),1);
        renderSourceList();
      });
    });
  }

  function renderScenarioSummary(lines,label,scenario){
    if(!scenario) return;
    lines.push(label);
    lines.push("Population: " + scenario.population + " agents × " + scenario.trials + " repeated simulations");
    lines.push("Overall stance: " + scenario.uncertainty.direction);
    lines.push("Uncertainty: " + scenario.uncertainty.label + " • mean " + scenario.uncertainty.mean.toFixed(2) +
      " • range " + scenario.uncertainty.min.toFixed(2) + " to " + scenario.uncertainty.max.toFixed(2));
    lines.push("Cross-run alignment: " + scenario.consensus.label + " (" + scenario.consensus.score + "/100)");
    lines.push("");

    lines.push("STAKEHOLDER GROUPS");
    (scenario.groupStats || []).forEach(function(group){
      lines.push("• " + group.group + ": " + group.direction +
        " | mean " + group.mean.toFixed(2) +
        " | 10–90% " + group.p10.toFixed(2) + " to " + group.p90.toFixed(2) +
        " | supportive " + group.supportivePct + "% | resistant " + group.resistantPct + "%");
    });

    if(scenario.redTeamFindings && scenario.redTeamFindings.length){
      lines.push("");
      lines.push("RED-TEAM FINDINGS");
      scenario.redTeamFindings.forEach(function(item){
        lines.push("• " + item.domain + ": " + item.finding + " | Check: " + item.test);
      });
    }

    if(scenario.reportAgent){
      lines.push("");
      lines.push("REPORT AGENT");
      lines.push(scenario.reportAgent.summary);
      (scenario.reportAgent.keyTensions || []).forEach(function(item){ lines.push("• " + item); });
    }
    lines.push("");
  }

  function renderScenarioReport(data){
    state.scenarioReport = data;
    save(STORAGE.scenarioReport,data);
    el("exportScenarioReport").disabled = false;

    var manifest = el("scenarioManifest");
    manifest.classList.remove("hidden");
    manifest.textContent = "Run " + data.runId + " • " + data.population + " agents • " + data.trials +
      " repeated simulations • " + data.rounds + " rounds • " +
      (data.evidenceGraph ? data.evidenceGraph.nodes.length : 0) + " evidence nodes";

    var lines = [];
    lines.push("SIMULATION, NOT CERTAINTY");
    lines.push("Run: " + data.runId);
    lines.push("Horizon: " + data.horizon);
    lines.push("Engine: " + data.engine + " v" + data.version);
    lines.push("");

    if(data.evidenceGraph && data.evidenceGraph.keyTerms && data.evidenceGraph.keyTerms.length){
      lines.push("EVIDENCE GRAPH — KEY TERMS");
      data.evidenceGraph.keyTerms.forEach(function(term){
        lines.push("• " + term.term + " — " + term.count + " mentions");
      });
      lines.push("");
    }

    renderScenarioSummary(lines,"SCENARIO A",data.scenarios && data.scenarios.A);
    if(data.scenarios && data.scenarios.B){
      renderScenarioSummary(lines,"SCENARIO B",data.scenarios.B);
    }

    if(data.comparison){
      lines.push("A/B COMPARISON");
      lines.push(data.comparison.summary);
      (data.comparison.differences || []).forEach(function(item){ lines.push("• " + item); });
      lines.push("");
    }

    lines.push("NEXT REAL-WORLD TESTS");
    (data.nextTests || []).forEach(function(item){ lines.push("• " + item); });
    lines.push("");
    lines.push(data.disclaimer);

    el("scenarioOutput").textContent = lines.join("\n");
    renderCalibrationStatus();
  }

  async function runScenario(e){
    e.preventDefault();
    var output = el("scenarioOutput");
    output.textContent = "Running repeated multi-agent simulations and red-team checks…";
    el("scenarioManifest").classList.add("hidden");
    el("exportScenarioReport").disabled = true;
    el("askWorldOutput").textContent = "Simulation running…";

    var sources = state.sourcePacket.map(function(source){
      return {name:source.name,type:source.type,text:source.text,extraction:source.extraction};
    });
    var manualEvidence = el("scenarioEvidence").value.trim();
    if(manualEvidence){
      sources.push({name:"Manual evidence and assumptions",type:"text/plain",text:manualEvidence.slice(0,120000),extraction:"manual"});
    }

    var payload = {
      scenario:el("scenarioText").value.trim(),
      scenarioB:el("scenarioTextB").value.trim(),
      stakeholders:el("scenarioStakeholders").value.split(",").map(function(x){ return x.trim(); }).filter(Boolean).slice(0,12),
      horizon:el("scenarioHorizon").value,
      rounds:Number(el("scenarioRounds").value || 3),
      population:Number(el("scenarioPopulation").value || 25),
      trials:Number(el("scenarioTrials").value || 3),
      redTeam:el("scenarioRedTeam").checked,
      sources:sources
    };

    try {
      var res = await fetch("/api/decision-lab/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      var data = await res.json();
      if(!data.ok) throw new Error(data.error || "Decision Lab run failed");
      renderScenarioReport(data);
      el("askWorldOutput").textContent = "Ask a question about this run.";
    } catch(err){
      output.textContent = "Could not run Decision Lab.\n\n" + String(err.message || err);
      el("askWorldOutput").textContent = "Run a successful simulation first.";
    }
  }

  async function askSimulatedWorld(e){
    e.preventDefault();
    var question=el("askWorldQuestion").value.trim();
    if(!state.scenarioReport){ toast("Run Decision Lab first."); return; }
    if(!question){ toast("Enter a question."); return; }
    el("askWorldOutput").textContent="Interrogating the report…";
    try{
      var res=await fetch("/api/decision-lab/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({report:state.scenarioReport,question:question})});
      var data=await res.json();
      if(!data.ok) throw new Error(data.error || "Could not answer");
      el("askWorldOutput").textContent=data.answer;
    }catch(err){
      el("askWorldOutput").textContent=String(err.message || err);
    }
  }

  function renderCalibrationStatus(){
    if(!state.scenarioReport) return;
    var match=state.calibrations.slice().reverse().find(function(item){ return item.runId===state.scenarioReport.runId; });
    if(!match){
      el("calibrationOutput").textContent="No observation saved for this run.";
      return;
    }
    el("calibrationOutput").textContent="Saved " + new Date(match.recordedAt).toLocaleDateString("en-ZA") +
      " • " + match.direction + " • " + match.outcome;
  }

  function saveCalibration(e){
    e.preventDefault();
    if(!state.scenarioReport){ toast("Run Decision Lab first."); return; }
    var outcome=el("calibrationOutcome").value.trim();
    if(!outcome){ toast("Describe the observed real-world outcome."); return; }
    var record={
      runId:state.scenarioReport.runId,
      recordedAt:new Date().toISOString(),
      direction:el("calibrationDirection").value,
      outcome:outcome.slice(0,4000),
      simulatedDirection:state.scenarioReport.scenarios && state.scenarioReport.scenarios.A ?
        state.scenarioReport.scenarios.A.uncertainty.direction : "unknown"
    };
    state.calibrations.push(record);
    state.calibrations=state.calibrations.slice(-100);
    save(STORAGE.calibrations,state.calibrations);
    renderCalibrationStatus();
    toast("Real-world observation saved locally.");
  }

  function exportScenarioReport(){
    if(!state.scenarioReport){ toast("Run Decision Lab first."); return; }
    var report=JSON.parse(JSON.stringify(state.scenarioReport));
    report.localCalibration=state.calibrations.filter(function(item){ return item.runId===report.runId; });
    var blob = new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "izakhono-decision-lab-" + state.scenarioReport.runId + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup(){
    var payload = {
      product:"IZAKHONO BUSINESS AI",
      exportedAt:new Date().toISOString(),
      version:1,
      clients:state.clients,
      documents:state.docs,
      diagnostic:state.diagnostic,
      decisionLabReport:state.scenarioReport,
      decisionLabCalibrations:state.calibrations
    };
    var blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href=url; a.download="izakhono-business-ai-backup-" + new Date().toISOString().slice(0,10) + ".json";
    a.click(); URL.revokeObjectURL(url);
  }

  async function checkHealth(){
    try {
      var res = await fetch("/api/health",{cache:"no-store"});
      var data = await res.json();
      if(data.ok){
        el("engineStatus").textContent = data.aiAdapter ? "ENGINE + AI ADAPTER" : "ENGINE READY • TEMPLATE AI";
        el("engineStatus").className = "status-chip";
      } else throw new Error("not ready");
    } catch(_e){
      el("engineStatus").textContent = "ENGINE UNREACHABLE";
      el("engineStatus").className = "status-chip neutral";
    }
  }

  initPrivacy();
  initNavigation();
  initForms();
  renderAll();
})();
