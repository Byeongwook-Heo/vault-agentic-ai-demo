(function setInitialTheme() {
  const storageKey = "bob-vault-demo-theme";
  let saved = null;
  try {
    saved = window.localStorage.getItem(storageKey);
  } catch {
    // Browser storage is optional; system preference remains available.
  }
  const theme =
    saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
})();
