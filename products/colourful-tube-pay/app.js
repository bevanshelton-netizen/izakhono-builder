const pages = {
 overview: ["Creator finance overview","A clear view of platform revenue, creator earnings and payout operations."],
 earnings: ["Creator earnings","Track gross revenue, approved allocations, adjustments and creator balances."],
 wallets: ["Creator wallets","View the creator earnings ledger. Wallet balances are accounting records, not bank deposits."],
 payouts: ["Payout operations","Review withdrawal requests, verification status and payout approvals."],
 revenue: ["Revenue sources","Understand advertising, memberships, viewer support, licensing and campaign income."],
 reconciliation: ["Reconciliation","Match provider collection records, platform allocations and payout confirmations."],
 creators: ["Creator accounts","Manage creator finance profiles and verification workflow."],
 reports: ["Financial reports","Export period-based earnings, allocation and reconciliation reports."],
 settings: ["Workspace settings","Configure revenue policies, providers, access controls and operating rules."]
};
const toast = document.getElementById("toast");
let toastTimer;
function notify(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),3200)}
function setPage(page){const item=pages[page]?page:"overview";document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===item));document.getElementById("page-title").textContent=pages[item][0];document.getElementById("page-subtitle").textContent=pages[item][1];document.getElementById("crumb").textContent=pages[item][0];if(item!=="overview")notify(pages[item][0]+" — preview section; live data is not connected.");}
document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>setPage(el.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(el=>el.addEventListener("click",()=>setPage(el.dataset.goto)));
document.getElementById("period-select").addEventListener("change",e=>{const n=Number(e.target.value);const d=n===3?"M0 166 C45 158 75 125 160 135 S255 85 320 100 S410 50 480 65 S550 30 600 42":"M0 166 C45 158 55 130 120 142 S195 116 240 125 S320 90 360 108 S430 65 480 83 S550 30 600 42";document.getElementById("chart-line").setAttribute("d",d);document.getElementById("chart-area").setAttribute("d",d+" L600 220 L0 220Z");});
document.getElementById("export-btn").addEventListener("click",()=>{const rows=[["Reference","Activity","Creator","Date","Amount","Status"],["CTP-DEMO-1048","Membership revenue","Creator Alpha","20 Nov 2026","2450.00","Allocated"],["CTP-DEMO-1047","Viewer support","Creator Beta","19 Nov 2026","850.00","Allocated"],["CTP-DEMO-1046","Advertising share","Creator Gamma","19 Nov 2026","5120.00","Pending review"],["CTP-DEMO-1045","Content licence","Creator Alpha","18 Nov 2026","1800.00","Allocated"]];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="colourful-tube-pay-demo-report.csv";a.click();URL.revokeObjectURL(url);notify("Demo report exported. It contains illustrative data only.");});
