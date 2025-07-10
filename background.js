chrome.runtime.onInstalled.addListener(() => {
  console.log("ChronoSnap Extension Installed");

  // Clear cached tokens to ensure proper auth scopes
  chrome.identity.clearAllCachedAuthTokens(() => {
    console.log("Cleared all cached auth tokens");
  });
});

function fetchCalendarEvents(token, callback) {
  const timeMin = new Date(2000, 0, 1).toISOString();
  const timeMax = new Date(2100, 0, 1).toISOString();

  console.log("Fetching events from:", timeMin, "to", timeMax);

  fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
    headers: { Authorization: "Bearer " + token }
  })
    .then(res => res.json())
    .then(data => {
      console.log("Raw calendar events response:", data);
      const events = (data.items || []).map(evt => ({
        id: evt.id,
        summary: evt.summary || "(No Title)",
        start: evt.start.dateTime || evt.start.date,
        end: evt.end.dateTime || evt.end.date,
        type: 'event',
        description: evt.description || '',
        location: evt.location || ''
      }));
      callback(events);
    })
    .catch(err => {
      console.error("Calendar Events Fetch Error:", err);
      callback(null);
    });
}

async function fetchTasks(token, callback) {
  console.log("📝 Fetching tasks from all task lists...");

  try {
    // First, get all task lists
    const taskListsResponse = await fetch(
      'https://www.googleapis.com/tasks/v1/users/@me/lists',
      { headers: { Authorization: "Bearer " + token } }
    );

    if (!taskListsResponse.ok) {
      throw new Error(`HTTP ${taskListsResponse.status}: Failed to fetch task lists`);
    }

    const taskListsData = await taskListsResponse.json();
    console.log("📋 Task lists response:", taskListsData);

    const allTasks = [];

    // Fetch tasks from each task list
    for (const taskList of taskListsData.items || []) {
      try {
        const tasksResponse = await fetch(
          `https://www.googleapis.com/tasks/v1/lists/${taskList.id}/tasks?showCompleted=true&showHidden=true`,
          { headers: { Authorization: "Bearer " + token } }
        );

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          const tasks = (tasksData.items || []).map(task => ({
            id: task.id,
            summary: task.title || "(No Title)",
            start: task.due || task.updated || new Date().toISOString(),
            end: task.due || task.updated || new Date().toISOString(),
            type: 'task',
            description: task.notes || '',
            status: task.status || 'needsAction',
            listTitle: taskList.title,
            completed: task.completed || null,
            updated: task.updated
          }));
          allTasks.push(...tasks);
        }
      } catch (taskError) {
        console.error(`Error fetching tasks from list ${taskList.title}:`, taskError);
      }
    }

    console.log(`✅ Found ${allTasks.length} task(s) across all lists`);
    callback(allTasks);
  } catch (error) {
    console.error("❌ Error fetching tasks:", error);
    callback(null);
  }
}

async function fetchAppointments(token, callback) {
  console.log("🏥 Fetching appointments (events with specific patterns)...");

  try {
    const timeMin = new Date(2000, 0, 1).toISOString();
    const timeMax = new Date(2100, 0, 1).toISOString();

    // Fetch events and filter for appointment-like items
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: "Bearer " + token } }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch appointments`);
    }

    const data = await response.json();
    console.log("📅 Raw appointments response:", data);

    // Filter events that look like appointments
    const appointmentKeywords = [
      'appointment', 'meeting', 'consultation', 'visit', 'checkup', 
      'doctor', 'dentist', 'medical', 'therapy', 'interview', 'call'
    ];

    const appointments = (data.items || [])
      .filter(evt => {
        const title = (evt.summary || '').toLowerCase();
        const description = (evt.description || '').toLowerCase();
        return appointmentKeywords.some(keyword => 
          title.includes(keyword) || description.includes(keyword)
        );
      })
      .map(evt => ({
        id: evt.id,
        summary: evt.summary || "(No Title)",
        start: evt.start.dateTime || evt.start.date,
        end: evt.end.dateTime || evt.end.date,
        type: 'appointment',
        description: evt.description || '',
        location: evt.location || '',
        attendees: evt.attendees || []
      }));

    console.log(`✅ Found ${appointments.length} appointment(s)`);
    callback(appointments);
  } catch (error) {
    console.error("❌ Error fetching appointments:", error);
    callback(null);
  }
}

async function fetchRecentDriveFiles(token, callback) {
  console.log("📁 Fetching all non-trashed Drive files...");

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=trashed = false&orderBy=modifiedTime desc&fields=files(id,name,mimeType,createdTime,modifiedTime,webViewLink)`,
      { headers: { Authorization: "Bearer " + token } }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Detailed API error:", errorBody);
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    console.log("📦 Drive files API response:", data);

    const files = (data.files || []).map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink
    }));

    console.log(`✅ Found ${files.length} file(s)`);
    callback(files);
  } catch (error) {
    console.error("❌ Error fetching Drive files:", error);
    callback(null);
  }
}

function isFileWithinTimeRange(fileTime, itemStart, itemEnd) {
  const fTime = new Date(fileTime).getTime();
  const iStart = new Date(itemStart).getTime();
  const iEnd = new Date(itemEnd).getTime();
  
  // For tasks without specific times, use a wider time window
  const timeWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  return (fTime >= iStart && fTime <= iEnd) || 
         (Math.abs(fTime - iStart) <= timeWindow);
}

function matchFilesWithCalendarItems(allCalendarItems, files) {
  const allMatches = [];

  allCalendarItems.forEach(item => {
    const relatedFiles = files.filter(file =>
      isFileWithinTimeRange(file.modifiedTime, item.start, item.end) ||
      isFileWithinTimeRange(file.createdTime, item.start, item.end)
    );

    // Always include the item, even if it has no files
    allMatches.push({
      item,
      files: relatedFiles // This will be an empty array if no files match
    });
  });

  return allMatches;
}

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_MATCHED_DATA") {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("Auth Error:", chrome.runtime.lastError);
        sendResponse({ matches: null });
        return;
      }

      console.log("🔐 Auth successful. Fetching all calendar items and files...");

      let allCalendarItems = [];
      let completedRequests = 0;
      const totalRequests = 3; // events, tasks, appointments

      const checkComplete = () => {
        completedRequests++;
        if (completedRequests === totalRequests) {
          // Sort all items by start time
          allCalendarItems.sort((a, b) => new Date(a.start) - new Date(b.start));
          
          fetchRecentDriveFiles(token, (files) => {
            if (!files) return sendResponse({ matches: null });

            const matches = matchFilesWithCalendarItems(allCalendarItems, files);
            console.log("✅ Final matched pairs (all calendar items):", matches);
            console.log(`📊 Total items: ${matches.length} (${allCalendarItems.filter(i => i.type === 'event').length} events, ${allCalendarItems.filter(i => i.type === 'task').length} tasks, ${allCalendarItems.filter(i => i.type === 'appointment').length} appointments)`);
            console.log(`📁 Items with files: ${matches.filter(m => m.files.length > 0).length}`);
            sendResponse({ matches });
          });
        }
      };

      // Fetch events
      fetchCalendarEvents(token, (events) => {
        if (events) {
          allCalendarItems.push(...events);
        }
        checkComplete();
      });

      // Fetch tasks
      fetchTasks(token, (tasks) => {
        if (tasks) {
          allCalendarItems.push(...tasks);
        }
        checkComplete();
      });

      // Fetch appointments
      fetchAppointments(token, (appointments) => {
        if (appointments) {
          allCalendarItems.push(...appointments);
        }
        checkComplete();
      });
    });

    return true; // Keep message channel open for async
  }

  if (message.type === "CLEAR_TOKENS") {
    chrome.identity.clearAllCachedAuthTokens(() => {
      console.log("✅ Manually cleared tokens");
      sendResponse({ success: true });
    });
    return true;
  }
});