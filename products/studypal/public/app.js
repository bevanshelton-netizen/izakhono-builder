document.querySelectorAll(".quick-grid button").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(".ask-box input");
    if (input) {
      input.value = button.textContent.trim() + ": ";
      input.focus();
    }
  });
});

document.querySelector(".ask-box button")?.addEventListener("click", () => {
  const input = document.querySelector(".ask-box input");
  if (!input || !input.value.trim()) return;
  alert("StudyPal classroom UI is ready. The live AI tutor adapter is the next backend integration.");
});
