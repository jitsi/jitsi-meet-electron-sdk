// Example renderer usage with context isolation and preload.js
// This code runs in the renderer process (web context)

// Start screen sharing
window.jitsiSDK.startScreenShare({ audio: true }).then(result => {
  if (result.success) {
    console.log('Screen sharing started!');
  } else {
    console.error('Failed to start screen sharing');
  }
});

// Listen for screen share events
window.jitsiSDK.onScreenShareEvent((data) => {
  console.log('Screen share event:', data);
});

// Enable remote control
window.jitsiSDK.enableRemoteControl({}).then(result => {
  if (result.success) {
    console.log('Remote control enabled!');
  }
});

// Listen for remote control events
window.jitsiSDK.onRemoteControlEvent((data) => {
  console.log('Remote control event:', data);
});
