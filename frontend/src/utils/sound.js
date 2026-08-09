export const playNotificationSound = () => {
  try {
    const audioEl = document.getElementById('notification-sound');
    if (audioEl) {
      audioEl.currentTime = 0;
      audioEl.play().catch(error => {
        console.warn("DOM Audio play blocked or failed", error);
      });
    } else {
      console.warn("Audio element not found in DOM");
    }
  } catch (error) {
    console.error("Audio play error:", error);
  }
};
