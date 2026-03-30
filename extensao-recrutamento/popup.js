const copyBtn = document.getElementById("copy-btn");
const originalContent = copyBtn.innerHTML;

function SET_BUTTON_STATE(state, message) {
  copyBtn.className = state;
  if (state === "success") {
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> ${message}`;
  } else if (state === "error") {
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${message}`;
  }

  setTimeout(() => {
    copyBtn.className = "";
    copyBtn.innerHTML = originalContent;
  }, 3000);
}

copyBtn.addEventListener("click", () => {
  // tenta capturar o cookie de sessao ativo na aba do linkedin
  chrome.cookies.get(
    { url: "https://www.linkedin.com", name: "li_at" },
    cookie => {
      if (cookie) {
        navigator.clipboard
          .writeText(cookie.value)
          .then(() => {
            SET_BUTTON_STATE("success", "Token Copiado!");
          })
          .catch(() => {
            SET_BUTTON_STATE("error", "Falha ao gravar (Clipboard)");
          });
      } else {
        SET_BUTTON_STATE("error", "Faça login no LinkedIn antes");
      }
    }
  );
});
