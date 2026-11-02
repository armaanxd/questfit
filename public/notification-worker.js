self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "schedule-reminder") return;
  const delay = Math.max(1000, data.at - Date.now());
  setTimeout(() => {
    self.registration.showNotification(data.title || "QuestFit reminder", {
      body: data.body || "Your quest is waiting.",
      tag: "questfit-daily-quest",
      icon: "./favicon.svg",
    });
  }, delay);
});
