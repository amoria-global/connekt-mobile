/**
 * Hybrid Booking Local Prototype Relay Server
 * Lightweight zero-dependency bridge running on 127.0.0.1:8082.
 * Allows Simulator 1 (Photographer) and Simulator 2 (Client) to seamlessly exchange
 * real-time shoot briefs, incoming call ringing alerts, approvals, and candidate shortlists
 * whenever the remote backend hybrid endpoints are pending deployment.
 */
const http = require('http');

const PORT = 8082;
let opportunities = [];
let approvedCandidates = {};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let parsedBody = {};
    if (body) {
      try { parsedBody = JSON.parse(body); } catch {}
    }

    // Health
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', opportunities: opportunities.length }));
      return;
    }

    // List opportunities (Photographer)
    if (req.method === 'GET' && pathname === '/opportunities') {
      const active = opportunities.filter((o) => o.status !== 'REJECTED');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ action: 1, data: active }));
      return;
    }

    // Create opportunity (Client posts match request)
    if (req.method === 'POST' && pathname === '/opportunities') {
      const opp = {
        candidateId: 'cand-' + Date.now(),
        matchRequestId: 'mr-' + Date.now(),
        eventId: parsedBody.eventId || 'evt-' + Date.now(),
        eventTitle: parsedBody.title || 'Sarah\'s Celebration',
        eventType: parsedBody.category || 'Celebration',
        eventDate: parsedBody.eventDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        startTime: parsedBody.startTime || '18:00:00',
        endTime: parsedBody.endTime || '22:00:00',
        durationHours: 4,
        city: parsedBody.city || 'Kigali',
        venue: parsedBody.venue || 'Convention Center',
        distanceKm: 2.8,
        minBudget: parsedBody.minBudget || 100000,
        maxBudget: parsedBody.maxBudget || 200000,
        currency: parsedBody.currency || 'RWF',
        matchReasons: [
          'Available on event date',
          'Freelancer profile matched',
          '5.0 rating · 187 bookings',
          'Instagram profile verified',
        ],
        status: 'INVITED',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };

      // Add to front of opportunities list
      opportunities = [opp, ...opportunities.filter((o) => o.eventId !== opp.eventId)];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ action: 1, data: opp }));
      return;
    }

    // Photographer approves opportunity
    const approveMatch = pathname.match(/^\/opportunities\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
      const candId = approveMatch[1];
      const opp = opportunities.find((o) => o.candidateId === candId);
      if (opp) {
        opp.status = 'APPROVED';
        if (!approvedCandidates[opp.eventId]) approvedCandidates[opp.eventId] = [];
        approvedCandidates[opp.eventId].push({
          candidateId: opp.candidateId,
          photographerId: 'photog-joseph-1',
          name: 'Joseph Maranatha',
          avatar: 'https://backend.connekyt.com/uploads/photographer/profile/images/1779185081014images.png',
          photographerType: 'FREELANCER',
          recommendationTier: 'HIGH',
          compositeScore: 96,
          distanceKm: 2.8,
          reviewCount: 38,
          rating: 5.0,
          typicalPriceRange: '100,000 – 160,000 RWF',
          instagram: {
            handle: 'joseph_maranatha',
            followersCount: 14200,
            profilePicUrl: 'https://backend.connekyt.com/uploads/photographer/profile/images/1779185081014images.png',
          },
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ action: 1, message: 'Approved successfully' }));
      return;
    }

    // Photographer declines opportunity
    const rejectMatch = pathname.match(/^\/opportunities\/([^/]+)\/reject$/);
    if (req.method === 'POST' && rejectMatch) {
      const candId = rejectMatch[1];
      const opp = opportunities.find((o) => o.candidateId === candId);
      if (opp) opp.status = 'REJECTED';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ action: 1, message: 'Declined' }));
      return;
    }

    // Client lists approved candidates for event
    const candMatch = pathname.match(/^\/events\/([^/]+)\/candidates$/);
    if (req.method === 'GET' && candMatch) {
      const eventId = candMatch[1];
      const candidates = approvedCandidates[eventId] || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        action: 1,
        data: {
          eventId,
          status: candidates.length > 0 ? 'CANDIDATES_AVAILABLE' : 'MATCHING',
          totalApproved: candidates.length,
          candidates,
        },
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ action: 0, message: 'Not found' }));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HybridRelay] Running on http://127.0.0.1:${PORT}`);
});
