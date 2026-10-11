(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("darkdownloader.v1") || "{}");
    const theme = saved.settings && saved.settings.theme;
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
})();
