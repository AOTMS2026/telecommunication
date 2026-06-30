const { google } = require('googleapis');

function getOAuth2Client(config) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (config.refreshToken) {
    client.setCredentials({ refresh_token: config.refreshToken, access_token: config.accessToken });
  }
  return client;
}

function getAuthUrl(state) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

async function exchangeCode(code) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Create a Google Meet meeting via Calendar API
async function createMeeting({ config, summary, description, startTime, endTime, attendeeEmails = [] }) {
  const auth = getOAuth2Client(config);
  const calendar = google.calendar({ version: 'v3', auth });

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date(start.getTime() + 30 * 60 * 1000); // default 30 min

  const event = {
    summary: summary || 'Meeting',
    description: description || '',
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
    attendees: attendeeEmails.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `aotms-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: event,
  });

  const meetLink = res.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;

  return {
    eventId: res.data.id,
    meetLink,
    htmlLink: res.data.htmlLink,
    start: res.data.start.dateTime,
    end: res.data.end.dateTime,
    summary: res.data.summary,
  };
}

// List upcoming meetings
async function listMeetings(config, maxResults = 20) {
  const auth = getOAuth2Client(config);
  const calendar = google.calendar({ version: 'v3', auth });

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
    q: 'meet.google.com',
  });

  return (res.data.items || []).map(e => ({
    eventId: e.id,
    summary: e.summary,
    start: e.start?.dateTime,
    end: e.end?.dateTime,
    meetLink: e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri,
    attendees: (e.attendees || []).map(a => a.email),
  }));
}

// Delete a meeting
async function deleteMeeting(config, eventId) {
  const auth = getOAuth2Client(config);
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({ calendarId: 'primary', eventId });
}

module.exports = { getAuthUrl, exchangeCode, createMeeting, listMeetings, deleteMeeting };