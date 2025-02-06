// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setReminder') {
      // Create an alarm with the specified delay (in minutes)
      chrome.alarms.create('reminder', { delayInMinutes: message.delay });
      sendResponse({ status: 'Reminder set for ' + message.delay + ' minutes.' });
    }
  });
  
  // When the alarm fires, show a notification
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'reminder') {
      chrome.notifications.create('', {
        title: 'Time for a Break!',
        message: `Time for your ${alarm.type || 'wellness'} break.`,
        iconUrl: 'images/icon48.png',
        type: 'basic'
      });
    }
  });
  