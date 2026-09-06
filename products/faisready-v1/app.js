(function(){
  "use strict";

  var STORAGE = {
    course: "faisready.course",
    attempts: "faisready.attempts",
    leads: "faisready.leads"
  };

  var BANK = {
    RE1: [
      {q:"Which study habit best supports exam preparation?", a:["Cramming only the night before","Short, repeated revision with practice questions","Skipping weak topics","Memorising answers without understanding"], c:1},
      {q:"When a mock answer is wrong, what should you do next?", a:["Ignore it","Review the topic and retry later","Change the score manually","Stop studying"], c:1},
      {q:"What does a readiness score on FAISReady represent?", a:["A guaranteed pass","A learning-progress indicator from local mock results","FSCA approval","A live exam booking"], c:1}
    ],
    RE3: [
      {q:"What is the purpose of a preparation checkpoint?", a:["To replace the official exam","To identify areas that need more revision","To guarantee a result","To process a payment"], c:1},
      {q:"A useful revision plan should be:", a:["Specific and scheduled","Random","Only one long session","Based only on confidence"], c:0},
      {q:"What should a learner do with repeated weak scores?", a:["Focus targeted revision on that topic","Hide the result","Skip the topic","Assume the mock is wrong"], c:0}
    ],
    RE4: [
      {q:"Why record mock attempts?", a:["To track improvement over time","To create an FSCA record","To charge the learner","To replace study notes"], c:0},
      {q:"Which score is most useful for planning next study steps?", a:["A random score","The latest and best scores together","No score at all","Only a friend’s score"], c:1},
      {q:"What is the role of practice questions?", a:["They are the official exam","They help test understanding and recall","They guarantee a pass","They activate payment"], c:1}
    ],
    RE5: [
      {q:"What is a sensible response to a low first mock score?", a:["Use it as a baseline and revise","Quit immediately","Assume failure is certain","Pay again"], c:0},
      {q:"A preparation dashboard is most useful when it:", a:["Shows progress clearly","Hides weak areas","Guarantees results","Books the official exam automatically"], c:0},
      {q:"What should happen before payment activation?", a:["Nothing","Merchant setup and reconciliation controls should be verified","Only the colour scheme should be checked","A pass guarantee should be added"], c:1}
    ]
  };

  function loadRainbowGraphic(){
    var image = qs("rainbowImage");
    if(!image) return;
    var pieces = [0,1,2,3,4].map(function(i){
      return fetch("assets/rainbow-" + i + ".b64").then(function(response){
        if(!response.ok) throw new Error("rainbow_asset_" + i + "_failed");
        return response.text();
      });
    });
    Promise.all(pieces).then(function(parts){
      image.src = "data:image/webp;base64," + parts.join("").replace(/\s+/g,"");
    }).catch(function(){
      image.style.display = "none";
      var frame = document.querySelector(".rainbow-frame");
      if(frame) frame.classList.add("asset-failed");
    });
  }

  function readJson(key, fallback){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }

  function writeJson(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function qs(id){ return document.getElementById(id); }

  function toast(message){
    var el = qs("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function(){ el.classList.remove("show"); }, 2600);
  }

  function attempts(){
    return readJson(STORAGE.attempts, []);
  }

  function leads(){
    return readJson(STORAGE.leads, []);
  }

  function selectedCourse(){
    return localStorage.getItem(STORAGE.course) || "";
  }

  function setCourse(course){
    localStorage.setItem(STORAGE.course, course);
    var cards = document.querySelectorAll(".course-card");
    Array.prototype.forEach.call(cards, function(card){
      card.classList.toggle("active", card.getAttribute("data-course") === course);
    });
    qs("quizCourse").value = course;
    renderDashboard();
    toast(course + " preparation selected");
  }

  function scoreStats(){
    var data = attempts();
    var latest = data.length ? data[data.length - 1].score : 0;
    var best = 0;
    data.forEach(function(item){ if(item.score > best) best = item.score; });
    return {latest:latest,best:best,count:data.length};
  }

  function readiness(score){
    if(score <= 0) return {label:"Not started", advice:"Complete a mock quiz to unlock guidance."};
    if(score < 50) return {label:"Foundation", advice:"Review the weak topics and retry after revision."};
    if(score < 75) return {label:"Developing", advice:"You are improving. Focus on the questions you missed."};
    if(score < 90) return {label:"Strong", advice:"Keep practising and close the remaining gaps."};
    return {label:"High readiness", advice:"Maintain revision and test consistency before the official exam."};
  }

  function renderDashboard(){
    var stats = scoreStats();
    var course = selectedCourse();
    var ready = readiness(stats.latest);
    qs("selectedCourse").textContent = course || "Not selected";
    qs("latestScore").textContent = stats.latest + "%";
    qs("dashboardBest").textContent = stats.best + "%";
    qs("readinessLabel").textContent = ready.label;
    qs("readinessAdvice").textContent = ready.advice;
    qs("progressBar").style.width = stats.latest + "%";
    qs("heroProgress").textContent = stats.latest + "%";
    qs("heroStatus").textContent = stats.count ? ready.advice : "Choose a course and complete a mock quiz to begin tracking your progress.";
    qs("attemptCount").textContent = String(stats.count);
    qs("bestScore").textContent = stats.best + "%";
    qs("leadCount").textContent = String(leads().length);
    var degrees = Math.round(stats.latest * 3.6);
    document.querySelector(".score-ring").style.background = "conic-gradient(var(--gold) " + degrees + "deg,#e7edf5 " + degrees + "deg)";
  }

  function renderQuiz(course){
    var bank = BANK[course] || BANK.RE1;
    var index = 0;
    var correct = 0;
    var locked = false;
    var card = qs("quizCard");

    function draw(){
      var item = bank[index];
      card.innerHTML =
        '<div class="quiz-top"><strong>' + course + ' mock</strong><span>Question ' + (index + 1) + ' of ' + bank.length + '</span></div>' +
        '<div class="quiz-question">' + item.q + '</div>' +
        '<div class="options"></div>' +
        '<button class="btn primary" id="nextQuestion" disabled>' + (index === bank.length - 1 ? 'Finish quiz' : 'Next question') + '</button>';
      var options = card.querySelector(".options");
      item.a.forEach(function(label, optionIndex){
        var b = document.createElement("button");
        b.className = "option";
        b.textContent = label;
        b.addEventListener("click", function(){
          if(locked) return;
          locked = true;
          var all = card.querySelectorAll(".option");
          Array.prototype.forEach.call(all, function(node, i){
            if(i === item.c) node.classList.add("correct");
            else if(i === optionIndex) node.classList.add("wrong");
            node.disabled = true;
          });
          if(optionIndex === item.c) correct += 1;
          qs("nextQuestion").disabled = false;
        });
        options.appendChild(b);
      });
      qs("nextQuestion").addEventListener("click", function(){
        index += 1;
        locked = false;
        if(index < bank.length){
          draw();
        }else{
          finish();
        }
      });
    }

    function finish(){
      var score = Math.round((correct / bank.length) * 100);
      var data = attempts();
      data.push({course:course,score:score,correct:correct,total:bank.length,at:new Date().toISOString()});
      writeJson(STORAGE.attempts, data.slice(-50));
      var ready = readiness(score);
      card.innerHTML =
        '<div class="quiz-result"><span class="eyebrow">MOCK COMPLETE</span><h2>' + score + '%</h2>' +
        '<p><strong>' + ready.label + '</strong> — ' + ready.advice + '</p>' +
        '<button class="btn primary" id="retryQuiz">Try another mock</button></div>';
      qs("retryQuiz").addEventListener("click", function(){ renderQuiz(course); });
      renderDashboard();
      toast("Mock result saved locally");
    }

    draw();
  }

  function serializeForm(form){
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function(value, key){ data[key] = String(value); });
    return data;
  }

  function saveLead(kind, data){
    var list = leads();
    list.push({
      kind: kind,
      createdAt: new Date().toISOString(),
      data: data
    });
    writeJson(STORAGE.leads, list.slice(-500));
    renderDashboard();
  }

  function csvCell(value){
    var text = String(value == null ? "" : value).replace(/"/g, '""');
    return '"' + text + '"';
  }

  function exportLeads(){
    var list = leads();
    if(!list.length){
      toast("No saved leads to export yet");
      return;
    }
    var rows = [["type","created_at","name_or_org","contact","mobile","email","course_or_enquiry","learners"]];
    list.forEach(function(item){
      var d = item.data || {};
      rows.push([
        item.kind,
        item.createdAt,
        d.name || d.organisation || "",
        d.contact || d.name || "",
        d.mobile || "",
        d.email || "",
        d.course || d.type || "",
        d.learners || ""
      ]);
    });
    var csv = rows.map(function(row){ return row.map(csvCell).join(","); }).join("\r\n");
    var blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "faisready-leads-" + new Date().toISOString().slice(0,10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("CSV export created");
  }

  document.addEventListener("DOMContentLoaded", function(){
    loadRainbowGraphic();
    var course = selectedCourse();
    if(course) setCourse(course);

    Array.prototype.forEach.call(document.querySelectorAll(".course-btn"), function(button){
      button.addEventListener("click", function(){
        var chosen = button.getAttribute("data-course");
        setCourse(chosen);
        document.getElementById("mock").scrollIntoView({behavior:"smooth"});
      });
    });

    qs("startQuiz").addEventListener("click", function(){
      var chosen = qs("quizCourse").value;
      setCourse(chosen);
      renderQuiz(chosen);
    });

    qs("learnerForm").addEventListener("submit", function(event){
      event.preventDefault();
      var data = serializeForm(event.currentTarget);
      saveLead("learner", data);
      event.currentTarget.reset();
      toast("Launch-list interest saved locally");
    });

    qs("businessForm").addEventListener("submit", function(event){
      event.preventDefault();
      var data = serializeForm(event.currentTarget);
      saveLead("business", data);
      event.currentTarget.reset();
      toast("Business enquiry saved locally");
    });

    qs("exportLeads").addEventListener("click", exportLeads);
    renderDashboard();
  });
})();