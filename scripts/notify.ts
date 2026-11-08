// Mary Mary's garden alerts, run by GitHub twice a day (.github/workflows/notify.yml).
// Checks the forecast for the garden and sends an urgent alert to Stef's phone if
// there's frost tonight, a heatwave or a storm coming.
//
// The repo is public, so this prints nothing about where the garden is.
//
//   MARY_MARY_PUSH   the push code from Settings → Notifications (a GitHub secret)
//   TEST=yes         send a test alert instead of checking the weather

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { TEST_ALERT, notYetSent, parsePushCode, urgentAlerts } from "../src/lib/alerts";
import type { Alert } from "../src/lib/alerts";
import { londonHour, todayISO } from "../src/lib/dates";
import { forecastUrl, parseForecast } from "../src/lib/weatherApi";
import { sendPush } from "./webpush";

const STATE = ".notify-state/sent.json";

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

function readSent(): string[] {
  try {
    const s = JSON.parse(readFileSync(STATE, "utf8"));
    return Array.isArray(s) ? s.map(String) : [];
  } catch {
    return [];
  }
}

function writeSent(sent: string[]) {
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(sent));
}

async function main() {
  let code;
  try {
    code = parsePushCode(process.env.MARY_MARY_PUSH);
  } catch (e) {
    fail((e as Error).message);
  }

  const repo = process.env.GITHUB_REPOSITORY ?? "stefdicembre/mary-mary";
  const [owner, name] = repo.split("/");
  const subject = `https://${owner.toLowerCase()}.github.io/${name}/`;
  const now = new Date();
  const today = todayISO(now);
  const sent = readSent();

  let alerts: Alert[];
  if (process.env.TEST === "yes") {
    alerts = [TEST_ALERT];
  } else {
    const r = await fetch(forecastUrl(code.lat, code.lon)).catch(() => undefined);
    if (!r || !r.ok) fail(`Couldn't get the forecast (${r ? r.status : "no connection"}). It'll try again at the next check.`);
    const forecast = parseForecast(await r.json(), code.place, now);
    alerts = urgentAlerts(forecast, code.protect, today, londonHour(now));
  }

  const { send, sent: nowSent } = alerts[0]?.key === "test" ? { send: alerts, sent } : notYetSent(alerts, sent, today);
  if (!send.length) {
    console.log(alerts.length ? "Nothing new: those alerts were already sent." : "Nothing urgent in the forecast. No alert sent.");
    writeSent(nowSent);
    return;
  }

  for (const a of send) {
    const status = await sendPush(code.sub, { title: a.title, body: a.body, url: a.url, tag: a.key }, code.vapid, subject);
    if (status === 404 || status === 410)
      fail("The phone isn't taking alerts any more. In Mary Mary, go to Settings → Notifications, turn them on again and paste the new code into GitHub.");
    if (status >= 300) fail(`The alert "${a.title}" wasn't accepted (${status}). It'll try again at the next check.`);
    console.log(`Sent: ${a.title}`);
  }
  // Only remember what actually went, so a failed send is tried again next time.
  writeSent(nowSent);
}

main().catch((e) => fail(`Something went wrong: ${(e as Error).message}`));
