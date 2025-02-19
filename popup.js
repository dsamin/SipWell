document.addEventListener('DOMContentLoaded', function() {
    // Clear badge when popup opens
    chrome.action.setBadgeText({ text: '' });
  
    // ----- Settings & Beverage List Management -----
    const defaultBeverages = ["Water", "Coffee", "Soda"];
  
    // Add unit preference handling
    let preferredUnit = localStorage.getItem('preferredUnit') || 'ml';
  
    // Retrieve or initialize beverage list from localStorage
    const getBeverages = () => {
      let beverages = localStorage.getItem('beverages');
      if (beverages) {
        return JSON.parse(beverages);
      } else {
        localStorage.setItem('beverages', JSON.stringify(defaultBeverages));
        return defaultBeverages;
      }
    };
  
    // Retrieve daily target or default to 2000 ml
    const getDailyTarget = () => {
      let target = localStorage.getItem('dailyTarget');
      return target ? parseInt(target) : 2000;
    };
  
    // Populate the beverage dropdown in the hydration tracker
    function populateBeverageDropdown() {
      const beverageSelect = document.getElementById('beverage-select');
      beverageSelect.innerHTML = "";
      const beverages = getBeverages();
      beverages.forEach(beverage => {
        let option = document.createElement('option');
        option.value = beverage;
        option.textContent = beverage;
        beverageSelect.appendChild(option);
      });
    }
  
    // Populate the beverage list in the settings modal
    function populateBeverageList() {
      const beverageList = document.getElementById('beverage-list');
      beverageList.innerHTML = "";
      const beverages = getBeverages();
      beverages.forEach(beverage => {
        let li = document.createElement('li');
        li.innerHTML = `
          <span>${beverage}</span>
          ${beverage !== 'Water' ? `<button class="delete-beverage" data-beverage="${beverage}">×</button>` : ''}
        `;
        beverageList.appendChild(li);
      });

      // Add delete event listeners
      document.querySelectorAll('.delete-beverage').forEach(button => {
        button.addEventListener('click', (e) => {
          const beverageToDelete = e.target.dataset.beverage;
          let beverages = getBeverages();
          beverages = beverages.filter(b => b !== beverageToDelete);
          localStorage.setItem('beverages', JSON.stringify(beverages));
          populateBeverageList();
          populateBeverageDropdown();
        });
      });
    }
  
    // Load settings values
    document.getElementById('daily-target').value = getDailyTarget();
    populateBeverageDropdown();
    populateBeverageList();
  
    // ----- Settings Modal Functionality -----
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
  
    settingsButton.addEventListener('click', () => {
      settingsModal.style.display = "block";
    });
  
    closeSettings.addEventListener('click', () => {
      settingsModal.style.display = "none";
    });
  
    window.addEventListener('click', (event) => {
      if (event.target == settingsModal) {
        settingsModal.style.display = "none";
      }
    });
  
    // Add new beverage option
    document.getElementById('add-beverage').addEventListener('click', () => {
      const newBeverageInput = document.getElementById('new-beverage');
      let newBeverage = newBeverageInput.value.trim();
      if (newBeverage !== "") {
        let beverages = getBeverages();
        if (!beverages.includes(newBeverage)) {
          beverages.push(newBeverage);
          localStorage.setItem('beverages', JSON.stringify(beverages));
          populateBeverageDropdown();
          populateBeverageList();
        }
        newBeverageInput.value = "";
      }
    });
  
    // Save settings from the modal
    document.getElementById('save-settings').addEventListener('click', () => {
      const dailyTargetValue = document.getElementById('daily-target').value;
      if (dailyTargetValue && parseInt(dailyTargetValue) > 0) {
        localStorage.setItem('dailyTarget', dailyTargetValue);
        updateProgress();
      }
      settingsModal.style.display = "none";
    });
  
    // ----- Navigation & Page State -----
    const pages = {
      home: document.getElementById('home'),
      hydration: document.getElementById('hydration'),
      reminder: document.getElementById('reminder')
    };

    function showPage(pageId) {
      Object.values(pages).forEach(page => {
        page.style.display = 'none';
      });
      pages[pageId].style.display = 'block';
      localStorage.setItem('lastPage', pageId);
      // Initialize chart when showing hydration page
      if (pageId === 'hydration') {
        requestAnimationFrame(() => {
          tryInitializeChart();
        });
      }
    }
  
    let lastPage = localStorage.getItem('lastPage') || 'home';
    showPage(lastPage);
  
    document.getElementById('nav-home').addEventListener('click', () => showPage('home'));
    document.getElementById('nav-hydration').addEventListener('click', () => {
      showPage('hydration');
    });
    document.getElementById('nav-reminder').addEventListener('click', () => showPage('reminder'));
  
    document.getElementById('go-hydration').addEventListener('click', () => {
      showPage('hydration');
      requestAnimationFrame(() => {
        tryInitializeChart();
      });
    });
    document.getElementById('go-reminder').addEventListener('click', () => showPage('reminder'));
  
    // ----- Hydration Tracker -----
    let totalIntake = 0;
    const progressText = document.getElementById('progress-text');
    const waterFill = document.querySelector('.water-fill');
    const drinkLogList = document.getElementById('drink-log');
  
    // Initially hide the logs container (which should wrap both the logs list and the reset button)
    const logsContainer = document.getElementById('logs-container');
    if (logsContainer) {
      logsContainer.style.display = "none";
    }
    // Set up the toggle log button to show/hide logs
    const toggleLogButton = document.getElementById('toggle-log');
    if (toggleLogButton && logsContainer) {
      toggleLogButton.addEventListener('click', () => {
        if (logsContainer.style.display === "none" || logsContainer.style.display === "") {
          logsContainer.style.display = "block";
          toggleLogButton.textContent = "Hide Logs";
        } else {
          logsContainer.style.display = "none";
          toggleLogButton.textContent = "Show Logs";
        }
      });
    }
  
    // Load saved drink log (if any)
    if (localStorage.getItem('drinkLog')) {
      let log = JSON.parse(localStorage.getItem('drinkLog'));
      log.forEach(entry => {
        // Handle both the new "beverage" property and legacy "drink" property
        let beverageName = entry.beverage || entry.drink || "Unknown Beverage";
        addDrinkToLog(beverageName, entry.amount, false);
        totalIntake += parseInt(entry.amount);
      });
      updateProgress();
    }
  
    document.getElementById('add-drink').addEventListener('click', () => {
      const beverageSelect = document.getElementById('beverage-select');
      const selectedBeverage = beverageSelect.value;
      let drinkAmount = document.getElementById('drink-amount').value;
      // Set default amount to 1000 ml if no value is entered
      if (!drinkAmount || drinkAmount.trim() === "") {
        drinkAmount = "1000";
      }
      if (selectedBeverage && drinkAmount) {
        addDrinkToLog(selectedBeverage, drinkAmount, true);
        totalIntake += parseInt(drinkAmount);
        updateProgress();
        document.getElementById('drink-amount').value = "";
      }
    });
  
    document.getElementById('reset-log').addEventListener('click', () => {
      totalIntake = 0;
      drinkLogList.innerHTML = "";
      updateProgress();
      localStorage.removeItem('drinkLog');
    });
  
    function getWaterIntake() {
      const log = localStorage.getItem('drinkLog') ? JSON.parse(localStorage.getItem('drinkLog')) : [];
      return log
        .filter(entry => entry.beverage === 'Water')
        .reduce((total, entry) => total + parseInt(entry.amount), 0);
    }

    function getCoffeeIntake() {
      const log = localStorage.getItem('drinkLog') ? JSON.parse(localStorage.getItem('drinkLog')) : [];
      return log
        .filter(entry => entry.beverage === 'Coffee')
        .reduce((total, entry) => total + parseInt(entry.amount), 0);
    }

    // Conversion functions
    function mlToOz(ml) {
      return Math.round(ml * 0.033814);
    }

    function ozToMl(oz) {
      return Math.round(oz * 29.5735);
    }

    // Unit toggle handlers
    const toggleMl = document.getElementById('toggle-ml');
    const toggleOz = document.getElementById('toggle-oz');
    
    function updateUnitDisplay() {
      const dailyTargetLabel = document.querySelector('label[for="daily-target"]');
      const drinkAmountLabel = document.querySelector('label[for="drink-amount"]');
      const dailyTarget = document.getElementById('daily-target');
      const drinkAmount = document.getElementById('drink-amount');
      
      const currentValue = parseInt(dailyTarget.value) || 2000;
      
      if (preferredUnit === 'oz') {
        dailyTargetLabel.textContent = 'Daily Hydration Target (oz):';
        drinkAmountLabel.textContent = 'Amount (oz):';
        if (localStorage.getItem('preferredUnit') === 'ml') {
          dailyTarget.value = mlToOz(currentValue);
        }
        drinkAmount.placeholder = '32 oz';
        toggleOz.classList.add('active');
        toggleMl.classList.remove('active');
      } else {
        dailyTargetLabel.textContent = 'Daily Hydration Target (ml):';
        drinkAmountLabel.textContent = 'Amount (ml):';
        if (localStorage.getItem('preferredUnit') === 'oz') {
          dailyTarget.value = ozToMl(currentValue);
        }
        drinkAmount.placeholder = '1000 ml';
        toggleMl.classList.add('active');
        toggleOz.classList.remove('active');
      }
      localStorage.setItem('preferredUnit', preferredUnit);
    }

    toggleMl.addEventListener('click', () => {
      if (preferredUnit === 'ml') return;
      preferredUnit = 'ml';
      updateUnitDisplay();
      updateProgress();
    });

    toggleOz.addEventListener('click', () => {
      if (preferredUnit === 'oz') return;
      preferredUnit = 'oz';
      updateUnitDisplay();
      updateProgress();
    });

    function updateProgress() {
      const target = getDailyTarget();
      const displayTotal = preferredUnit === 'oz' ? mlToOz(totalIntake) : totalIntake;
      const displayTarget = preferredUnit === 'oz' ? mlToOz(target) : target;
      const unit = preferredUnit === 'oz' ? 'oz' : 'ml';
      
      progressText.textContent = `${displayTotal} / ${displayTarget} ${unit}`;
      let percentage = Math.min((totalIntake / target) * 100, 100);
      waterFill.style.height = `${percentage}%`;
      
      // Store daily total and update chart if it exists
      storeDailyTotal();
      if (window.myChart) {
        window.myChart.data.datasets[0].data = getWeeklyData();
        window.myChart.update();
      }
      
      // Check if goal is reached
      if (percentage >= 100 && !localStorage.getItem('goalReachedToday')) {
        showGoalCompletionMessage();
        localStorage.setItem('goalReachedToday', 'true');
      }
      
      // Update individual stats
      const waterStat = document.getElementById('water-stat');
      const coffeeStat = document.getElementById('coffee-stat');
      if (waterStat && coffeeStat) {
        const waterAmount = preferredUnit === 'oz' ? mlToOz(getWaterIntake()) : getWaterIntake();
        const coffeeAmount = preferredUnit === 'oz' ? mlToOz(getCoffeeIntake()) : getCoffeeIntake();
        waterStat.textContent = `${waterAmount} ${unit}`;
        coffeeStat.textContent = `${coffeeAmount} ${unit}`;
      }
    }

    function addDrinkToLog(beverage, amount, save) {
      if (!beverage || !amount) return;
      
      // Convert amount to ml for storage if needed
      const amountInMl = preferredUnit === 'oz' ? ozToMl(parseInt(amount)) : parseInt(amount);
      const displayAmount = preferredUnit === 'oz' ? amount : amountInMl;
      const unit = preferredUnit === 'oz' ? 'oz' : 'ml';
      
      const li = document.createElement('li');
      li.innerHTML = `<span>${beverage}: ${displayAmount} ${unit}</span>`;
      
      if (save) {
        const log = JSON.parse(localStorage.getItem('drinkLog') || '[]');
        log.push({ beverage, amount: amountInMl.toString() }); // Always store in ml
        localStorage.setItem('drinkLog', JSON.stringify(log));
      }
    }

    // Initialize unit display on load
    updateUnitDisplay();
  
    function showGoalCompletionMessage() {
      const modal = document.createElement('div');
      modal.className = 'celebration-modal';
      modal.innerHTML = `
        <div class="celebration-content">
          <h3>🎉 Daily Goal Reached! 🎉</h3>
          <p>Great job staying hydrated today!</p>
          <button class="close-celebration">Close</button>
        </div>
      `;
      
      // Add event listener for close button
      const closeButton = modal.querySelector('.close-celebration');
      closeButton.addEventListener('click', () => {
        modal.remove();
      });
      
      document.body.appendChild(modal);
    }
  
    // ----- Wellness Reminder -----
    const countdownElem = document.getElementById('countdown');
    let reminderInterval;
  
    // Check for active timer when popup opens
    function checkActiveTimer() {
      chrome.runtime.sendMessage({ action: 'checkTimer' }, (response) => {
        if (response && response.active) {
          startCountdown(response.remainingSeconds);
        }
      });
    }
  
    // Call this function when the popup loads
    checkActiveTimer();
  
    document.getElementById('set-reminder').addEventListener('click', () => {
      const timerMinutes = parseInt(document.getElementById('reminder-timer').value);
      const reminderType = document.getElementById('reminder-type').value || 'Break';
      if (isNaN(timerMinutes) || timerMinutes <= 0) {
        alert('Please enter a valid timer in minutes.');
        return;
      }
      
      // Clear any existing alarms
      chrome.alarms.clearAll();
      
      // Send a message to the background script to set a reminder
      chrome.runtime.sendMessage({ 
        action: 'setReminder', 
        delay: timerMinutes,
        type: reminderType 
      }, (response) => {
        if (response && response.status) {
          console.log(response.status);
          // Update UI to show reminder is active
          countdownElem.style.color = 'var(--primary-color)';
          startCountdown(timerMinutes * 60); // Start countdown immediately
        }
      });
    });
  
    function startCountdown(seconds) {
      clearInterval(reminderInterval);
      updateCountdownDisplay(seconds);
      reminderInterval = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(reminderInterval);
          showTimerNotification();
        } else {
          updateCountdownDisplay(seconds);
        }
      }, 1000);
    }
  
    function updateCountdownDisplay(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      countdownElem.textContent = `${mins}m ${secs}s remaining`;
    }

    function showTimerNotification() {
      const reminderType = document.getElementById('reminder-type').value || 'Break';
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.innerHTML = `
        <span class="notification-message">Time for your ${reminderType} break!</span>
        <button class="notification-close">×</button>
      `;
      
      // Add event listener for close button
      const closeButton = notification.querySelector('.notification-close');
      closeButton.addEventListener('click', () => {
        notification.remove();
      });
      
      // Insert at the top of the reminder section
      const reminderSection = document.getElementById('reminder');
      reminderSection.insertBefore(notification, reminderSection.firstChild);
      
      // Update countdown text
      countdownElem.textContent = 'Timer completed';
      countdownElem.style.color = 'var(--error)';
    }

    function initializeUI() {
      // Handle active nav button states
      const navButtons = document.querySelectorAll('nav button');
      navButtons.forEach(button => {
        button.addEventListener('click', () => {
          navButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
        });
      });

      // Add smooth transitions for water fill
      const waterFill = document.querySelector('.water-fill');
      if (waterFill) {
        waterFill.style.transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    }

    // Call this function when the popup loads
    initializeUI();

    // Add this after the existing helper functions
    function checkAndResetDaily() {
      const lastResetDate = localStorage.getItem('lastResetDate');
      const today = new Date().toDateString();
      
      if (lastResetDate !== today) {
        // Reset daily stats
        totalIntake = 0;
        drinkLogList.innerHTML = "";
        localStorage.removeItem('drinkLog');
        localStorage.setItem('lastResetDate', today);
        updateProgress();
      }
    }

    // Add this to your DOMContentLoaded event listener
    checkAndResetDaily();

    // Replace the existing initializeChart function with this corrected version
    function initializeChart() {
      // Check if Chart is available
      if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        return;
      }

      const canvas = document.getElementById('weekly-chart');
      if (!canvas) {
        console.error('Canvas element not found');
        return;
      }

      // Make sure the canvas is visible before initializing
      if (canvas.offsetParent === null) {
        console.error('Canvas is not visible');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return;
      }

      try {
        // Destroy existing chart if it exists
        if (window.myChart) {
          window.myChart.destroy();
        }

        // Set canvas dimensions
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        window.myChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
              label: 'Daily Intake (ml)',
              data: getWeeklyData(),
              backgroundColor: '#1E88E5',    // primary-color
              borderColor: '#1565C0',        // secondary-color
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 750,
              easing: 'easeOutQuart'
            },
            plugins: {
              legend: {
                labels: {
                  color: '#2C3E50'  // text-primary
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Milliliters (ml)',
                  color: '#607D8B'  // text-secondary
                },
                grid: {
                  color: 'rgba(96, 125, 139, 0.1)'  // text-secondary with opacity
                },
                ticks: {
                  color: '#607D8B'  // text-secondary
                }
              },
              x: {
                grid: {
                  color: 'rgba(96, 125, 139, 0.1)'  // text-secondary with opacity
                },
                ticks: {
                  color: '#607D8B'  // text-secondary
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Error initializing chart:', error);
      }
    }

    // Wrap chart initialization in a function that checks for Chart.js
    function tryInitializeChart() {
      if (typeof Chart === 'undefined') {
        console.log('Waiting for Chart.js to load...');
        setTimeout(tryInitializeChart, 100);
        return;
      }
      initializeChart();
    }

    function getWeeklyData() {
      const weeklyData = JSON.parse(localStorage.getItem('weeklyData') || '[]');
      if (!weeklyData.length) {
        return Array(7).fill(0);
      }
      
      // Reorder array to start from Monday
      const mondayFirst = [...weeklyData.slice(1), weeklyData[0]];
      return mondayFirst;
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'w':
            e.preventDefault();
            quickAddWater();
            break;
          case 'c':
            e.preventDefault();
            quickAddCoffee();
            break;
        }
      }
    });

    function quickAddWater() {
      addDrinkToLog('Water', '250', true);
      totalIntake += 250;
      updateProgress();
    }

    function quickAddCoffee() {
      addDrinkToLog('Coffee', '250', true);
      totalIntake += 250;
      updateProgress();
    }

    // Add this function to store daily totals
    function storeDailyTotal() {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const weeklyData = JSON.parse(localStorage.getItem('weeklyData') || '[]');
      
      // Initialize array if empty
      if (!weeklyData.length) {
        weeklyData.length = 7;
        weeklyData.fill(0);
      }
      
      // Update today's total
      weeklyData[dayOfWeek] = totalIntake;
      localStorage.setItem('weeklyData', JSON.stringify(weeklyData));
    }

    // Check for pending notifications
    function checkPendingNotifications() {
      chrome.storage.local.get(['hasNotification', 'reminderType'], (data) => {
        if (data.hasNotification) {
          showTimerNotification();
          chrome.storage.local.remove('hasNotification');
        }
      });
    }

    // Call when popup opens
    checkPendingNotifications();
  });
  