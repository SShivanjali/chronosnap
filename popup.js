// Global variables to store all calendar items and matches
let allCalendarItems = [];
let allMatches = [];
let isDataLoaded = false;
let filteredItems = [];
let selectedItemIndex = -1;

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', function() {
  setupInitialState();
});

function setupInitialState() {
  const initialSync = document.getElementById("initialSync");
  const searchFilterSection = document.getElementById("searchFilterSection");
  const outputDiv = document.getElementById("output");
  
  // Show only sync button initially
  initialSync.style.display = "block";
  searchFilterSection.style.display = "none";
  outputDiv.innerHTML = "";
  
  // Set up event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Initial sync button
  document.getElementById("syncBtn").addEventListener("click", performInitialSync);
  
  // Search input functionality
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", handleSearchInput);
  searchInput.addEventListener("focus", showDropdown);
  searchInput.addEventListener("blur", hideDropdownDelayed);
  searchInput.addEventListener("keydown", handleKeyNavigation);
  
  // Date range filter
  document.getElementById("dateFilterBtn").addEventListener("click", performDateRangeFilter);
  
  // Action buttons
  document.getElementById("showAllBtn").addEventListener("click", showAllItems);
  document.getElementById("clearBtn").addEventListener("click", clearResults);
  document.getElementById("reSyncBtn").addEventListener("click", performReSync);
  
  // Click outside to close dropdown
  document.addEventListener("click", (e) => {
    if (!e.target.closest('.search-dropdown-container')) {
      hideDropdown();
    }
  });
}

function performInitialSync() {
  const syncStatus = document.getElementById("syncStatus");
  const outputDiv = document.getElementById("output");
  
  syncStatus.innerHTML = "Syncing calendar items and files...";
  outputDiv.innerHTML = "";
  
  chrome.runtime.sendMessage({ type: "GET_MATCHED_DATA" }, (response) => {
    if (chrome.runtime.lastError) {
      syncStatus.innerHTML = "Error: " + chrome.runtime.lastError.message;
      return;
    }

    if (!response || !response.matches) {
      syncStatus.innerHTML = "No calendar items found or authentication failed.";
      return;
    }

    // Store all data globally
    allMatches = response.matches;
    allCalendarItems = response.matches.map(match => match.item);
    filteredItems = [...allCalendarItems];
    isDataLoaded = true;
    
    // Hide initial sync section and show search/filter options
    document.getElementById("initialSync").style.display = "none";
    document.getElementById("searchFilterSection").style.display = "block";
    
    // Set default date range (last 30 days to today)
    setDefaultDateRange();
    
    // Count items by type
    const events = allCalendarItems.filter(item => item.type === 'event').length;
    const tasks = allCalendarItems.filter(item => item.type === 'task').length;
    const appointments = allCalendarItems.filter(item => item.type === 'appointment').length;
    
    // Show initial results
    displayMatches(allMatches, `Sync Complete: ${allCalendarItems.length} items loaded (${events} events, ${tasks} tasks, ${appointments} appointments)`);
    
    outputDiv.scrollTop = 0;
  });
}

function handleSearchInput(e) {
  const searchTerm = e.target.value.toLowerCase();
  
  if (!searchTerm) {
    filteredItems = [...allCalendarItems];
    selectedItemIndex = -1;
  } else {
    filteredItems = allCalendarItems.filter(item => 
      (item.summary || "").toLowerCase().includes(searchTerm) ||
      (item.description || "").toLowerCase().includes(searchTerm) ||
      (item.type || "").toLowerCase().includes(searchTerm) ||
      (item.listTitle || "").toLowerCase().includes(searchTerm) || // For tasks
      (item.status || "").toLowerCase().includes(searchTerm) // For task status
    );
    selectedItemIndex = -1;
  }
  
  updateDropdownList();
  showDropdown();
  
  // If there's a search term, perform search
  if (searchTerm) {
    performSearchWithTerm(searchTerm);
  }
}

function handleKeyNavigation(e) {
  const dropdownList = document.getElementById("dropdownList");
  const options = dropdownList.querySelectorAll('.dropdown-option');
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedItemIndex = Math.min(selectedItemIndex + 1, options.length - 1);
    updateSelectedOption();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedItemIndex = Math.max(selectedItemIndex - 1, -1);
    updateSelectedOption();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedItemIndex >= 0 && selectedItemIndex < filteredItems.length) {
      selectItem(selectedItemIndex);
    }
  } else if (e.key === 'Escape') {
    hideDropdown();
    e.target.blur();
  }
}

function updateSelectedOption() {
  const options = document.querySelectorAll('.dropdown-option');
  options.forEach((option, index) => {
    option.classList.toggle('selected', index === selectedItemIndex);
  });
}

function updateDropdownList() {
  const dropdownList = document.getElementById("dropdownList");
  dropdownList.innerHTML = '';
  
  if (filteredItems.length === 0) {
    dropdownList.innerHTML = '<div class="dropdown-option no-results">No items found</div>';
    return;
  }
  
  filteredItems.forEach((item, index) => {
    const option = document.createElement('div');
    option.className = 'dropdown-option';
    const typeIcon = getTypeIcon(item.type);
    const typeLabel = item.type === 'task' && item.listTitle ? ` (${item.listTitle})` : '';
    const statusLabel = item.type === 'task' && item.status ? ` - ${item.status}` : '';
    option.textContent = `${typeIcon} ${item.summary || "(No Title)"}${typeLabel}${statusLabel} - ${formatItemDate(item.start)}`;
    option.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur event
      selectItem(index);
    });
    option.addEventListener('mouseenter', () => {
      selectedItemIndex = index;
      updateSelectedOption();
    });
    dropdownList.appendChild(option);
  });
}

function selectItem(index) {
  const selectedItem = filteredItems[index];
  const searchInput = document.getElementById("searchInput");
  
  // Find the original match for this item
  const originalIndex = allCalendarItems.findIndex(item => 
    item.summary === selectedItem.summary && 
    item.start === selectedItem.start &&
    item.type === selectedItem.type &&
    item.id === selectedItem.id
  );
  
  if (originalIndex >= 0) {
    const selectedMatch = allMatches[originalIndex];
    searchInput.value = selectedItem.summary || "(No Title)";
    hideDropdown();
    displayMatches([selectedMatch], `Selected ${selectedItem.type} Details`);
  }
}

function showDropdown() {
  if (!isDataLoaded) return;
  
  updateDropdownList();
  const dropdownList = document.getElementById("dropdownList");
  dropdownList.style.display = 'block';
}

function hideDropdown() {
  const dropdownList = document.getElementById("dropdownList");
  dropdownList.style.display = 'none';
  selectedItemIndex = -1;
}

function hideDropdownDelayed() {
  // Small delay to allow for option clicks
  setTimeout(hideDropdown, 150);
}

function performSearchWithTerm(searchTerm) {
  if (!isDataLoaded) return;
  
  const matchingItems = allMatches.filter(match => 
    (match.item.summary || "").toLowerCase().includes(searchTerm) ||
    (match.item.description || "").toLowerCase().includes(searchTerm) ||
    (match.item.type || "").toLowerCase().includes(searchTerm) ||
    (match.item.listTitle || "").toLowerCase().includes(searchTerm) ||
    (match.item.status || "").toLowerCase().includes(searchTerm)
  );
  
  if (matchingItems.length === 0) {
    document.getElementById("output").innerHTML = `<p>No items found matching "${searchTerm}".</p>`;
    return;
  }
  
  displayMatches(matchingItems, `Search results for "${searchTerm}"`);
}

function setDefaultDateRange() {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById("startDate").value = thirtyDaysAgo.toISOString().split('T')[0];
  document.getElementById("endDate").value = today.toISOString().split('T')[0];
}

function performDateRangeFilter() {
  if (!isDataLoaded) {
    alert("Please sync data first.");
    return;
  }
  
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const outputDiv = document.getElementById("output");
  
  if (!startDate || !endDate) {
    outputDiv.innerHTML = "<p>Please select both start and end dates.</p>";
    return;
  }
  
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate + "T23:59:59").getTime(); // Include entire end date
  
  const filteredItems = allMatches.filter(match => {
    const itemTime = new Date(match.item.start).getTime();
    return itemTime >= startTime && itemTime <= endTime;
  });
  
  if (filteredItems.length === 0) {
    outputDiv.innerHTML = `<p>No items found between ${startDate} and ${endDate}.</p>`;
    return;
  }
  
  displayMatches(filteredItems, `Items from ${startDate} to ${endDate}`);
}

function showAllItems() {
  if (!isDataLoaded) {
    alert("Please sync data first.");
    return;
  }
  
  displayMatches(allMatches, "All Calendar Items");
}

function clearResults() {
  document.getElementById("output").innerHTML = "<p>Results cleared. Use the options above to filter items.</p>";
  document.getElementById("searchInput").value = "";
  filteredItems = [...allCalendarItems];
  hideDropdown();
}

function performReSync() {
  // Reset everything and perform fresh sync
  allCalendarItems = [];
  allMatches = [];
  filteredItems = [];
  isDataLoaded = false;
  selectedItemIndex = -1;
  
  document.getElementById("initialSync").style.display = "block";
  document.getElementById("searchFilterSection").style.display = "none";
  document.getElementById("syncStatus").innerHTML = "Click 'Sync Now' to reload your calendar items and files.";
  document.getElementById("output").innerHTML = "";
}

function getTypeIcon(type) {
  switch(type) {
    case 'event': return '\u{1F4C5}';
    case 'task': return '\uD83D\uDCCB';
    case 'appointment': return '\uD83C\uDFE5';
    default: return '\uD83D\uDCDD';
  }
}

function getTypeColor(type) {
  switch(type) {
    case 'event': return '#4CAF50';
    case 'task': return '#2196F3';
    case 'appointment': return '#FF5722';
    default: return '#9E9E9E';
  }
}

function displayMatches(matches, title) {
  const outputDiv = document.getElementById("output");
  
  if (matches.length === 0) {
    outputDiv.innerHTML = `<p><strong>${title}:</strong> No matching items found.</p>`;
    return;
  }
  
  let html = `<div class="results-header"><strong>${title}</strong></div>`;
  let totalFilesDisplayed = 0;
  let itemsWithFiles = 0;
  
  // Group by type for better organization
  const groupedMatches = {
    event: matches.filter(m => m.item.type === 'event'),
    task: matches.filter(m => m.item.type === 'task'),
    appointment: matches.filter(m => m.item.type === 'appointment')
  };
  
  Object.entries(groupedMatches).forEach(([type, typeMatches]) => {
    if (typeMatches.length === 0) return;
    
    html += `<div class="type-section-header">${getTypeIcon(type)} ${type.charAt(0).toUpperCase() + type.slice(1)}s (${typeMatches.length})</div>`;
    
    typeMatches.forEach((match, matchIndex) => {
      const { item, files } = match;
      const typeColor = getTypeColor(item.type);
      
      if (files.length === 0) {
        // Item without files
        html += `
          <div class="item-no-files" style="border-left-color: ${typeColor}">
            <div class="item-header">
              <div class="item-title">${getTypeIcon(item.type)} ${item.summary || "(No Title)"}</div>
              <div class="item-time">\u{1F552} ${formatItemDate(item.start)}</div>
              ${item.type === 'task' && item.status ? `<div class="task-status">Status: ${item.status}</div>` : ''}
              ${item.type === 'task' && item.listTitle ? `<div class="task-list">List: ${item.listTitle}</div>` : ''}
              ${item.type === 'task' && item.completed ? `<div class="task-completed">Completed: ${formatItemDate(item.completed)}</div>` : ''}
              ${item.location ? `<div class="item-location">📍 ${item.location}</div>` : ''}
              ${item.attendees && item.attendees.length > 0 ? `<div class="item-attendees">👥 ${item.attendees.length} attendee(s)</div>` : ''}
              ${item.description ? `<div class="item-description">${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</div>` : ''}
            </div>
            <div class="no-files-msg">No files found for this ${item.type}</div>
          </div>
        `;
      } else {
        // Item with files
        itemsWithFiles++;
        html += `
          <div class="item-header" style="border-left-color: ${typeColor}">
            <div class="item-title">${getTypeIcon(item.type)} ${item.summary || "(No Title)"}</div>
            <div class="item-time">\u{1F552} ${formatItemDate(item.start)} (${files.length} file${files.length !== 1 ? 's' : ''})</div>
            ${item.type === 'task' && item.status ? `<div class="task-status">Status: ${item.status}</div>` : ''}
            ${item.type === 'task' && item.listTitle ? `<div class="task-list">List: ${item.listTitle}</div>` : ''}
            ${item.type === 'task' && item.completed ? `<div class="task-completed">Completed: ${formatItemDate(item.completed)}</div>` : ''}
            ${item.location ? `<div class="item-location">📍 ${item.location}</div>` : ''}
            ${item.attendees && item.attendees.length > 0 ? `<div class="item-attendees">👥 ${item.attendees.length} attendee(s)</div>` : ''}
            ${item.description ? `<div class="item-description">${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</div>` : ''}
          </div>
        `;
        
        files.forEach(file => {
          totalFilesDisplayed++;
          html += `
            <div class="file">
              <a href="${file.webViewLink || '#'}" target="_blank" class="file-link">
                \u{1F4C4} ${file.name || "Unknown File"}
              </a>
              <div class="file-info">
                <div>Type: ${file.mimeType || "Unknown"}</div>
                <div>Modified: ${formatFileDate(file.modifiedTime)}</div>
                <div>Created: ${formatFileDate(file.createdTime)}</div>
              </div>
            </div>
          `;
        });
      }
    });
  });
  
  // Add summary
  const events = matches.filter(m => m.item.type === 'event').length;
  const tasks = matches.filter(m => m.item.type === 'task').length;
  const appointments = matches.filter(m => m.item.type === 'appointment').length;
  
  html += `
    <div class="summary">
      \u{1F4CA} Summary: ${matches.length} item(s) (${events} events, ${tasks} tasks, ${appointments} appointments) | ${itemsWithFiles} with files | ${totalFilesDisplayed} total file(s)
    </div>
  `;
  
  outputDiv.innerHTML = html;
  outputDiv.scrollTop = 0;
}

// Helper functions
function formatItemDate(dateString) {
  if (!dateString) return "Unknown Time";
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (e) {
    return dateString.replace("T", " ").replace("Z", "");
  }
}

function formatFileDate(dateString) {
  if (!dateString) return "Unknown";
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (e) {
    return dateString.replace("T", " ").replace("Z", "");
  }
}