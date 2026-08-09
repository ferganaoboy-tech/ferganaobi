/**
 * Safe wrapper for HTML5 Vibration API (Haptic Feedback)
 * Mimics native iOS/Android system sensations on web.
 */

export const triggerHaptic = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptic feedback not supported on this hardware/browser", e);
    }
  }
};

export const haptics = {
  // Light tick for stepper clicks and minor toggle states
  light: () => triggerHaptic(8),
  
  // Normal click for navigation or secondary buttons
  medium: () => triggerHaptic(15),
  
  // Successful actions (e.g. item added to cart, order created)
  success: () => triggerHaptic([20, 50, 20]),
  
  // Warning/Error actions (e.g. stock limit exceeded, validation error)
  warning: () => triggerHaptic([50, 80, 50]),
  
  // Deleting item or resetting data
  delete: () => triggerHaptic(40)
};
