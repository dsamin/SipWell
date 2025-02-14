// Store active timers in storage
let activeTimer = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setReminder') {
    console.log('Setting reminder for', message.delay, 'minutes');
    const endTime = Date.now() + (message.delay * 60 * 1000);
    
    // Store timer info
    chrome.storage.local.set({
      'reminderType': message.type,
      'reminderEndTime': endTime
    }, () => {
      console.log('Timer info stored, creating alarm for:', new Date(endTime).toLocaleTimeString());
      // Create an alarm that will fire when the timer ends
      chrome.alarms.create('reminder', {
        when: endTime
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error creating alarm:', chrome.runtime.lastError);
        } else {
          console.log('Alarm created successfully');
        }
      });
      
      sendResponse({ 
        status: 'Reminder set for ' + message.delay + ' minutes.',
        endTime: endTime
      });
    });
    return true;
  }
  
  // Handle timer check requests
  if (message.action === 'checkTimer') {
    chrome.storage.local.get(['reminderEndTime'], (data) => {
      if (data.reminderEndTime) {
        const remainingTime = Math.max(0, data.reminderEndTime - Date.now());
        console.log('Checking timer - remaining seconds:', Math.floor(remainingTime / 1000));
        sendResponse({ 
          active: remainingTime > 0,
          remainingSeconds: Math.floor(remainingTime / 1000)
        });
      } else {
        console.log('No active timer found');
        sendResponse({ active: false });
      }
    });
    return true;
  }
});

// When the alarm fires, show a notification
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm fired:', alarm.name);
  if (alarm.name === 'reminder') {
    console.log('Reminder alarm triggered');
    // Just clear the stored end time
    chrome.storage.local.set({
      'reminderEndTime': null,
      'hasNotification': true,
      'reminderTriggeredAt': Date.now()
    }, () => {
      console.log('Reminder end time cleared');
      // Set badge to show notification
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF5252' });
    });
  }
});

// Log any alarm errors
chrome.alarms.onAlarm.addListener((alarm) => {
  if (chrome.runtime.lastError) {
    console.error('Alarm error:', chrome.runtime.lastError);
  }
});

// Keep service worker alive
chrome.runtime.onConnect.addListener(function(port) {
  port.onDisconnect.addListener(function() {
    console.log('Port disconnected, keeping service worker alive');
  });
});
  