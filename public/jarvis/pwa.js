(()=>{"use strict";
const connection=document.getElementById("connection");
const message=document.getElementById("message");
function showOffline(){
  if(connection){connection.textContent="● OFFLINE · LOCAL APP SHELL";connection.style.color="var(--gold)";}
  if(message)message.textContent="Offline mode: the application shell is available. Live records, cloud connectors and remote workforce are unavailable; offline data storage is not enabled yet.";
}
function showOnline(){
  if(connection&&connection.textContent.includes("OFFLINE")){
    connection.textContent="● ONLINE · RECONNECTING";
    connection.style.color="var(--gold)";
  }
  const refresh=document.getElementById("refresh");
  if(refresh)refresh.click();
}
if(!navigator.onLine)showOffline();
window.addEventListener("offline",showOffline);
window.addEventListener("online",showOnline);
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("/jarvis/sw.js",{scope:"/jarvis/"}).catch(()=>{
      if(message)message.textContent="App shell caching could not be enabled on this browser.";
    });
  });
}
})();
