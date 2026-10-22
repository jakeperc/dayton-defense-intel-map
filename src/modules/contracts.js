// SEC 04 — opportunity radar, award ledger, buying offices (data/contracts.json),
// and the optional live pull from the public USASpending API.
import { CONTRACTS } from '../lib/data.js';

export function buildContracts() {
  const radar = document.getElementById('radar-list');
  for (const r of CONTRACTS.radar) {
    const d = document.createElement('div');
    d.className = 'radar-card ' + r.status;
    d.innerHTML =
      '<div class="rc-top"><div><h3>' + r.title + '</h3><div class="rc-sub">' + r.sub + '</div></div><span class="rc-chip">' + r.chip + '</span></div>' +
      '<div class="rc-grid">' +
      r.cells.map((c) => '<div class="rc-cell' + (c.kind === 'outlook' ? ' move' : '') + '"><span class="ck">' + c.label + '</span>' + c.html + '</div>').join('') +
      '</div>' +
      '<div class="rc-src"><span class="badge ' + r.grade + '">[' + r.grade + ']</span> ' + r.sources + '</div>';
    radar.appendChild(d);
  }

  // NASIC A&AS ordering runs through Jun 30 2034: show the runway left today.
  const months = document.getElementById('nasic-months');
  if (months) months.textContent = '~' + Math.max(0, Math.round((new Date('2034-06-30') - new Date()) / 2629800000));

  document.getElementById('ledger-table').innerHTML =
    '<thead><tr><th>Vehicle / award</th><th>Prime(s)</th><th>Amount</th><th>Date</th><th>Notes</th><th>Grade</th></tr></thead><tbody>' +
    CONTRACTS.ledger
      .map((r) =>
        '<tr><td><b>' + r.vehicle + '</b></td><td>' + r.primes + '</td><td class="amt">' + r.amount + '</td><td>' + r.date + '</td><td>' + r.notes +
        '</td><td><span class="badge ' + r.grade + '">[' + r.grade + ']</span></td></tr>')
      .join('') +
    '</tbody>';

  const doors = document.getElementById('doors-list');
  for (const o of CONTRACTS.doors) {
    const d = document.createElement('div');
    d.className = 'door';
    d.innerHTML =
      '<span class="dk">' + o.key + '</span><h4>' + o.name + '</h4><p>' + o.body + '</p>' +
      '<p style="margin-top:7px"><a href="' + o.link + '" target="_blank" rel="noopener">' + o.link_text + '</a></p>';
    doors.appendChild(d);
  }

  document.getElementById('live-awards-btn')?.addEventListener('click', pullLiveAwards);
  document.getElementById('live-recip-btn')?.addEventListener('click', pullLiveRecipients);
}

/* ---- live USASpending pulls (browser-side; fail gracefully, the snapshot stands) ---- */
const API = 'https://api.usaspending.gov/api/v2/search/';

function liveStatus(msg, cls) {
  const s = document.getElementById('live-status');
  s.textContent = msg;
  s.className = 'live-status' + (cls ? ' ' + cls : '');
}

function fmtUSD(x) {
  if (x == null || isNaN(x)) return '—';
  if (x >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return '$' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return '$' + (x / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(x);
}

function liveFail(err) {
  liveStatus(
    'Live pull failed (' + (err && err.message ? err.message : 'network unavailable') +
      '). Expected offline — the curated snapshot stands; or run the query via the USASpending link in The Doors.',
    'err',
  );
}

async function post(path, body) {
  const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).results || [];
}

async function pullLiveAwards() {
  const btn = document.getElementById('live-awards-btn');
  btn.disabled = true;
  liveStatus('Querying api.usaspending.gov …');
  try {
    const rows = await post('spending_by_award/', {
      filters: CONTRACTS.usaspending_filters,
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Description', 'Start Date', 'End Date', 'Awarding Sub Agency'],
      sort: 'Award Amount', order: 'desc', limit: 15, page: 1,
    });
    if (!rows.length) {
      liveStatus('Query succeeded but returned no rows — try widening the city list or dates.', 'err');
    } else {
      document.getElementById('live-out').innerHTML =
        '<div class="ledger-wrap"><table class="ledger"><thead><tr><th>Recipient</th><th>Amount</th><th>Sub-agency</th><th>Dates</th><th>Description</th></tr></thead><tbody>' +
        rows.map((r) =>
          '<tr><td><b>' + (r['Recipient Name'] || '—') + '</b></td><td class="amt">' + fmtUSD(r['Award Amount']) + '</td><td>' +
          (r['Awarding Sub Agency'] || '—') + '</td><td>' + (r['Start Date'] || '') + ' → ' + (r['End Date'] || '') + '</td><td>' +
          String(r['Description'] || '—').slice(0, 140) + '</td></tr>').join('') +
        '</tbody></table></div>';
      liveStatus('Live: top ' + rows.length + ' DoD awards, place of performance Dayton/Beavercreek/Fairborn/WPAFB, FY24–26. ~90-day reporting lag applies; classified work not shown.', 'ok');
    }
  } catch (e) {
    liveFail(e);
  }
  btn.disabled = false;
}

async function pullLiveRecipients() {
  const btn = document.getElementById('live-recip-btn');
  btn.disabled = true;
  liveStatus('Querying api.usaspending.gov …');
  try {
    const rows = await post('spending_by_category/recipient/', { filters: CONTRACTS.usaspending_filters, limit: 10, page: 1 });
    if (!rows.length) {
      liveStatus('Query succeeded but returned no rows.', 'err');
    } else {
      document.getElementById('live-out').innerHTML =
        '<div class="ledger-wrap"><table class="ledger"><thead><tr><th>#</th><th>Recipient</th><th>Obligations (filtered set)</th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + (r.name || '—') + '</b></td><td class="amt">' + fmtUSD(r.amount) + '</td></tr>').join('') +
        '</tbody></table></div>';
      liveStatus('Live: top recipients by obligation, same filter set — the empirical answer to "who actually performs here."', 'ok');
    }
  } catch (e) {
    liveFail(e);
  }
  btn.disabled = false;
}
