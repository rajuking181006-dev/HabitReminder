document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let habits = JSON.parse(localStorage.getItem('habits')) ||[];
    let lastActiveDate = localStorage.getItem('lastActiveDate') || new Date().toDateString();
    let isDarkMode = localStorage.getItem('theme') !== 'light';

    // --- DOM Elements ---
    const habitListEl = document.getElementById('habitList');
    const emptyStateEl = document.getElementById('emptyState');
    const fab = document.getElementById('fab');
    const habitModal = document.getElementById('habitModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const habitForm = document.getElementById('habitForm');
    const habitNameInput = document.getElementById('habitName');
    const habitTimeInput = document.getElementById('habitTime');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const themeToggle = document.getElementById('themeToggle');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    const notificationBanner = document.getElementById('notificationBanner');
    const enableNotifBtn = document.getElementById('enableNotifBtn');

    // Stats Elements
    const completedCountEl = document.getElementById('completedCount');
    const completionPercentEl = document.getElementById('completionPercent');
    const bestStreakOverallEl = document.getElementById('bestStreakOverall');
    const progressBar = document.getElementById('progressBar');

    // --- Initialization ---
    initApp();

    function initApp() {
        applyTheme();
        checkDailyReset();
        renderHabits();
        updateStats();
        setupNotifications();
        
        // Start 1-minute interval for smart reminders and date crossing
        setInterval(() => {
            checkDailyReset();
            checkReminders();
        }, 60000);
    }

    // --- Core Logic ---

    // Automatically reset completion status if a new day has started
    function checkDailyReset() {
        const today = new Date().toDateString();
        if (today !== lastActiveDate) {
            habits.forEach(habit => {
                // If habit was not completed yesterday, streak is broken
                if (!habit.completed) {
                    habit.currentStreak = 0;
                }
                habit.completed = false;
                habit.notifiedToday = false; // reset notification flag
            });
            lastActiveDate = today;
            saveData();
            renderHabits();
            updateStats();
        }
    }

    function saveData() {
        localStorage.setItem('habits', JSON.stringify(habits));
        localStorage.setItem('lastActiveDate', lastActiveDate);
    }

    function addHabit(name, time) {
        // Prevent duplicate names
        if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
            speakFeedback("Habit already exists.");
            return false;
        }

        const newHabit = {
            id: Date.now().toString(),
            name: name,
            time: time || '',
            completed: false,
            currentStreak: 0,
            bestStreak: 0,
            notifiedToday: false
        };

        habits.push(newHabit);
        saveData();
        renderHabits();
        updateStats();
        speakFeedback(`Habit ${name} added successfully.`);
        return true;
    }

    function toggleHabit(id) {
        const habit = habits.find(h => h.id === id);
        if (habit) {
            habit.completed = !habit.completed;
            
            if (habit.completed) {
                habit.currentStreak++;
                if (habit.currentStreak > habit.bestStreak) {
                    habit.bestStreak = habit.currentStreak;
                }
                speakFeedback("Great job!");
            } else {
                habit.currentStreak = Math.max(0, habit.currentStreak - 1);
            }
            
            saveData();
            renderHabits();
            updateStats();
        }
    }

    function deleteHabit(id) {
        if(confirm("Delete this habit?")) {
            habits = habits.filter(h => h.id !== id);
            saveData();
            renderHabits();
            updateStats();
        }
    }

    // --- UI Rendering ---

    function renderHabits() {
        habitListEl.innerHTML = '';
        if (habits.length === 0) {
            habitListEl.appendChild(emptyStateEl);
            emptyStateEl.style.display = 'block';
            return;
        }
        emptyStateEl.style.display = 'none';

        // Sort: uncompleted first
        const sortedHabits = [...habits].sort((a, b) => a.completed - b.completed);

        sortedHabits.forEach(habit => {
            const card = document.createElement('div');
            card.className = `habit-card ${habit.completed ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="habit-info">
                    <div class="habit-name">${habit.name}</div>
                    <div class="habit-meta">
                        <span>${habit.time ? '⏰ ' + formatTime(habit.time) : ''}</span>
                        <span>🔥 Streak: ${habit.currentStreak} (Best: ${habit.bestStreak})</span>
                    </div>
                </div>
                <div class="habit-actions">
                    <button class="btn-toggle" onclick="window.toggleHabit('${habit.id}')" title="Mark Complete">
                        ${habit.completed ? '✔' : ''}
                    </button>
                    <button class="btn-delete" onclick="window.deleteHabit('${habit.id}')" title="Delete">🗑</button>
                </div>
            `;
            habitListEl.appendChild(card);
        });
    }

    function updateStats() {
        const total = habits.length;
        const completed = habits.filter(h => h.completed).length;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        
        let bestOverall = 0;
        habits.forEach(h => {
            if (h.bestStreak > bestOverall) bestOverall = h.bestStreak;
        });

        completedCountEl.textContent = `${completed}/${total}`;
        completionPercentEl.textContent = `${percent}%`;
        bestStreakOverallEl.textContent = bestOverall;
        progressBar.style.width = `${percent}%`;
    }

    // Expose functions to global scope for inline onclick handlers
    window.toggleHabit = toggleHabit;
    window.deleteHabit = deleteHabit;

    // --- Event Listeners ---

    fab.addEventListener('click', () => {
        habitModal.classList.remove('hidden');
        habitNameInput.focus();
    });

    closeModalBtn.addEventListener('click', () => {
        habitModal.classList.add('hidden');
        habitForm.reset();
        voiceStatus.textContent = '';
    });

    habitModal.addEventListener('click', (e) => {
        if (e.target === habitModal) {
            habitModal.classList.add('hidden');
            habitForm.reset();
        }
    });

    habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = habitNameInput.value.trim();
        const time = habitTimeInput.value;
        
        if (name) {
            if(addHabit(name, time)) {
                habitModal.classList.add('hidden');
                habitForm.reset();
            }
        }
    });

    clearAllBtn.addEventListener('click', () => {
        if(habits.length > 0 && confirm("Are you sure you want to delete ALL habits and history?")) {
            habits =[];
            saveData();
            renderHabits();
            updateStats();
        }
    });

    // --- Theming ---
    function applyTheme() {
        if (!isDarkMode) {
            document.body.setAttribute('data-theme', 'light');
            themeToggle.textContent = '🌙';
        } else {
            document.body.removeAttribute('data-theme');
            themeToggle.textContent = '☀️';
        }
    }

    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        applyTheme();
    });

    // --- Voice Input (SpeechRecognition API) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            voiceInputBtn.classList.add('listening');
            voiceStatus.textContent = "Listening... Try 'Read a book at 8 PM'";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            parseVoiceCommand(transcript);
        };

        recognition.onerror = (event) => {
            voiceStatus.textContent = "Error listening. Please try typing.";
            voiceInputBtn.classList.remove('listening');
        };

        recognition.onend = () => {
            voiceInputBtn.classList.remove('listening');
            setTimeout(() => { if(voiceStatus.textContent.includes('Listening')) voiceStatus.textContent=''; }, 1000);
        };

        voiceInputBtn.addEventListener('click', () => {
            try {
                recognition.start();
            } catch (e) {
                recognition.stop();
            }
        });
    } else {
        voiceInputBtn.style.display = 'none'; // Hide if not supported
    }

    function parseVoiceCommand(text) {
        // Simple NLP: Remove "add habit" if user said it
        let cleanedText = text.toLowerCase().replace(/^add habit\s+/, '').trim();
        
        // Regex to extract time like "at 7 pm", "at 14:00"
        const timeMatch = cleanedText.match(/ at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        
        let timeVal = "";
        if (timeMatch) {
            cleanedText = cleanedText.replace(timeMatch[0], '').trim();
            let hour = parseInt(timeMatch[1]);
            let minute = timeMatch[2] || "00";
            let ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
            
            if (ampm === "pm" && hour < 12) hour += 12;
            if (ampm === "am" && hour === 12) hour = 0;
            
            timeVal = `${hour.toString().padStart(2, '0')}:${minute}`;
        }

        // Capitalize first letter
        const finalName = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
        
        habitNameInput.value = finalName;
        if(timeVal) {
            habitTimeInput.value = timeVal;
            voiceStatus.textContent = `Parsed: ${finalName} at ${formatTime(timeVal)}`;
        } else {
            voiceStatus.textContent = `Parsed: ${finalName}`;
        }
    }

    // --- Speech Synthesis (Feedback) ---
    function speakFeedback(message) {
        if ('speechSynthesis' in window) {
            // Cancel previous speech to prevent overlapping
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 1;
            utterance.pitch = 1;
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- Smart Reminders (Notifications) ---
    function setupNotifications() {
        if (!("Notification" in window)) return;
        
        if (Notification.permission === "default") {
            notificationBanner.classList.remove('hidden');
        }

        enableNotifBtn.addEventListener('click', () => {
            Notification.requestPermission().then(permission => {
                notificationBanner.classList.add('hidden');
                if (permission === 'granted') {
                    speakFeedback("Notifications enabled.");
                }
            });
        });
    }

    function checkReminders() {
        if (!("Notification" in window) || Notification.permission !== "granted") return;

        const now = new Date();
        const currentHourMin = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        habits.forEach(habit => {
            if (habit.time === currentHourMin && !habit.completed && !habit.notifiedToday) {
                // Send Notification
                new Notification("Habit Reminder! ⏰", {
                    body: `It's time to: ${habit.name}`,
                    icon: "https://cdn-icons-png.flaticon.com/512/3233/3233496.png" // generic bell icon
                });
                
                // Speak reminder
                speakFeedback(`Reminder: It is time to ${habit.name}`);
                
                // Mark as notified for today
                habit.notifiedToday = true;
                saveData();
            }
        });
    }

    // --- Helper ---
    function formatTime(time24) {
        const [hourStr, minStr] = time24.split(':');
        let hour = parseInt(hourStr);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        return `${hour}:${minStr} ${ampm}`;
    }
});