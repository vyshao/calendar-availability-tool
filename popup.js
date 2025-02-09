document.addEventListener('DOMContentLoaded', function() {
    function getTimezoneInfo(timeZone) {
      try {
        const date = new Date();
        
        // Get timezone abbreviation (PST, EST, etc.)
        const formatter = new Intl.DateTimeFormat('en', {
          timeZone,
          timeZoneName: 'short'
        });
        const abbr = formatter.formatToParts(date)
          .find(part => part.type === 'timeZoneName').value;
        
        // Get GMT offset for the specific timezone
        const timezoneParts = date.toLocaleString('en-US', {
          timeZone,
          timeZoneName: 'longOffset'
        }).split(' ');
        
        const gmtOffset = timezoneParts[timezoneParts.length - 1].replace('GMT', '');
        
        return `${timeZone} (${abbr}, GMT${gmtOffset})`;
      } catch (e) {
        console.error('Error formatting timezone:', e);
        return timeZone;
      }
    }
  
    // Populate both timezone dropdowns
    const availabilityTimezoneSelect = document.getElementById('availabilityTimezone');
    const displayTimezoneSelect = document.getElementById('displayTimezone');
    const timeZones = Intl.supportedValuesOf('timeZone');
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    timeZones.forEach(zone => {
      const zoneInfo = getTimezoneInfo(zone);
      
      // Availability timezone dropdown
      const availOption = document.createElement('option');
      availOption.value = zone;
      availOption.text = zoneInfo;
      if (zone === userTimezone) {
        availOption.selected = true;
      }
      availabilityTimezoneSelect.appendChild(availOption);
      
      // Display timezone dropdown
      const displayOption = document.createElement('option');
      displayOption.value = zone;
      displayOption.text = zoneInfo;
      if (zone === userTimezone) {
        displayOption.selected = true;
      }
      displayTimezoneSelect.appendChild(displayOption);
    });
  
    // Load saved preferences
    chrome.storage.sync.get([
      'startTime', 
      'endTime', 
      'availabilityTimezone',
      'displayTimezone',
      'includeWeekends'
    ], function(items) {
      if (items.startTime) document.getElementById('startTime').value = items.startTime;
      if (items.endTime) document.getElementById('endTime').value = items.endTime;
      if (items.availabilityTimezone) document.getElementById('availabilityTimezone').value = items.availabilityTimezone;
      if (items.displayTimezone) document.getElementById('displayTimezone').value = items.displayTimezone;
      if (items.includeWeekends !== undefined) {
        document.getElementById('includeWeekends').checked = items.includeWeekends;
      } else {
        document.getElementById('includeWeekends').checked = false;
      }
    });
  
    document.getElementById('generate').addEventListener('click', generateAvailability);
  });
  
  function getTimezoneAbbreviation(timezone) {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    return formatter.formatToParts(date)
      .find(part => part.type === 'timeZoneName').value;
  }
  
  async function getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  }
  
  async function fetchCalendarEvents(token) {
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now.toISOString()}&` +
      `timeMax=${twoWeeksFromNow.toISOString()}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  
    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }
  
    const data = await response.json();
    return data.items;
  }
  
  function generateAvailabilityText(events, preferredStartTime, preferredEndTime, availabilityTimezone, displayTimezone, includeWeekends) {
    const timezoneAbbr = getTimezoneAbbreviation(displayTimezone);
    let availabilityText = `Times that work in ${timezoneAbbr}:\n\n`;
    
    const availabilityByDay = {};
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
  
    // Use availability timezone for date keys
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
      timeZone: displayTimezone
    });
  
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: displayTimezone
    });
  
    // Initialize availability for each day
    for (let d = new Date(now); d <= twoWeeksFromNow; d.setDate(d.getDate() + 1)) {
      const tzDate = new Date(d.toLocaleString('en-US', { timeZone: availabilityTimezone }));
      const dateKey = tzDate.toLocaleDateString('en-US', { timeZone: availabilityTimezone });
      availabilityByDay[dateKey] = [];
    }
  
    // Process events
    events.forEach(event => {
      if (event.status === 'cancelled') return;
  
      // Convert event times to availability timezone
      const startInTz = new Date(event.start.dateTime || event.start.date)
        .toLocaleString('en-US', { timeZone: availabilityTimezone });
      const endInTz = new Date(event.end.dateTime || event.end.date)
        .toLocaleString('en-US', { timeZone: availabilityTimezone });
      const dateKey = new Date(startInTz)
        .toLocaleDateString('en-US', { timeZone: availabilityTimezone });
  
      if (availabilityByDay[dateKey]) {
        availabilityByDay[dateKey].push({
          start: new Date(startInTz),
          end: new Date(endInTz)
        });
      }
    });
  
    Object.entries(availabilityByDay).forEach(([dateKey, dayEvents]) => {
      const date = new Date(dateKey);
      if (date < now) return;
  
      // Skip weekends unless includeWeekends is checked
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend && !includeWeekends) return;
  
      // Convert preferred times to minutes
      const [preferredStartHour, preferredStartMinute] = preferredStartTime.split(':');
      const [preferredEndHour, preferredEndMinute] = preferredEndTime.split(':');
      const preferredStartMinutes = parseInt(preferredStartHour) * 60 + parseInt(preferredStartMinute);
      const preferredEndMinutes = parseInt(preferredEndHour) * 60 + parseInt(preferredEndMinute);
  
      // Sort events chronologically
      dayEvents.sort((a, b) => a.start - b.start);
  
      // Find available time slots
      let availableSlots = [];
      let currentTime = preferredStartMinutes;
  
      dayEvents.forEach(event => {
        const eventStart = event.start.getHours() * 60 + event.start.getMinutes();
        const eventEnd = event.end.getHours() * 60 + event.end.getMinutes();
  
        if (currentTime < eventStart && currentTime < preferredEndMinutes) {
          availableSlots.push({
            start: currentTime,
            end: Math.min(eventStart, preferredEndMinutes)
          });
        }
        currentTime = Math.max(currentTime, eventEnd);
      });
  
      // Add final slot if there's time remaining
      if (currentTime < preferredEndMinutes) {
        availableSlots.push({
          start: currentTime,
          end: preferredEndMinutes
        });
      }
  
      // Format availability text for the day
      if (availableSlots.length > 0) {
        const formattedDate = dateFormatter.format(date);
        const slotTexts = availableSlots.map(slot => {
          const startDate = new Date(date);
          startDate.setHours(Math.floor(slot.start / 60));
          startDate.setMinutes(slot.start % 60);
  
          const endDate = new Date(date);
          endDate.setHours(Math.floor(slot.end / 60));
          endDate.setMinutes(slot.end % 60);
  
          if (slot.end === preferredEndMinutes) {
            return `${timeFormatter.format(startDate)} onward`;
          }
          return `${timeFormatter.format(startDate)}-${timeFormatter.format(endDate)}`;
        });
  
        availabilityText += `${formattedDate} - ${slotTexts.join(', ')}\n`;
      }
    });
  
    return availabilityText;
  }
  
  async function generateAvailability() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const availabilityTimezone = document.getElementById('availabilityTimezone').value;
    const displayTimezone = document.getElementById('displayTimezone').value;
    const includeWeekends = document.getElementById('includeWeekends').checked;
  
    // Save preferences
    chrome.storage.sync.set({
      startTime,
      endTime,
      availabilityTimezone,
      displayTimezone,
      includeWeekends
    });
  
    try {
      const token = await getAuthToken();
      const events = await fetchCalendarEvents(token);
      const availability = generateAvailabilityText(
        events, 
        startTime, 
        endTime, 
        availabilityTimezone,
        displayTimezone,
        includeWeekends
      );
      document.getElementById('output').textContent = availability;

          // Add clipboard functionality
    try {
      await navigator.clipboard.writeText(availability);
      const originalButtonText = document.getElementById('generate').textContent;
      document.getElementById('generate').textContent = 'Copied to clipboard!';
      setTimeout(() => {
        document.getElementById('generate').textContent = originalButtonText;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
    }
  } catch (error) {
    document.getElementById('output').textContent = 'Error: ' + error.message;
  }
  }