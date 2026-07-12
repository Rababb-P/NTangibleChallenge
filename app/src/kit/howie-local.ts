// Local, canned Howie for the challenge kit. The real product runs a live
// model behind /howie/chat — the kit answers from the bundled season instead
// so the chat surface still feels alive without any credentials.
// Contract note: replies are plain text, never markdown.

import DATASET from "../data/dataset.json";
import type { HowieMessage, Persona } from "../api";

interface Lite {
  athletes: { id: string; name: string; clutch_score: number; alignment: number; tier: string }[];
  nterpret: Record<string, { domains: { key: string; name: string; score: number }[]; growth_areas: string[] }>;
  team: { name: string };
}
const DS = DATASET as unknown as Lite;

const harper = DS.athletes.find((a) => a.id === "ath_harper")!;
const harperDomains = [...DS.nterpret["ath_harper"].domains].sort((a, b) => b.score - a.score);
const topDomain = harperDomains[0];
const growth = DS.nterpret["ath_harper"].growth_areas[0];
const teamAvg = Math.round(DS.athletes.reduce((s, a) => s + a.clutch_score, 0) / DS.athletes.length);
const aboveLine = DS.athletes.filter((a) => a.clutch_score >= 750).length;
const outlier = DS.athletes.find((a) => a.clutch_score >= 900 && a.alignment < 60);

const KIT_NOTE = "Heads up: in this challenge kit I answer from the bundled season data with canned lines — the live product wires me to a real model. The interesting stuff is in the data folder. CHALLENGE.md has your mission.";

const ROTATIONS: Record<Persona, string[]> = {
  athlete: [
    `Harper, your Clutch Factor sits at ${harper.clutch_score} — above the 750 line. Your strongest domain right now is ${topDomain.name.toLowerCase()} at ${topDomain.score}. Keep feeding it reps.`,
    `Your growth lever is clear: ${String(growth).toLowerCase()}. Two short drills a week move that needle more than one long session.`,
    `The score is a snapshot, not a verdict. Look at your history in the app — the direction matters more than the number.`,
  ],
  parent: [
    `After a game, the first sentence matters most. Try: I loved watching you compete today. The score talk can wait for the drive home tomorrow.`,
    `Harper's profile says the edge is ${topDomain.name.toLowerCase()} and the growth area is ${String(growth).toLowerCase()}. Praise the edge, be patient with the lever.`,
    `Ask one question tonight: what was the moment you felt most locked in? Then just listen.`,
  ],
  coach: [
    `Thunder 16U averages ${teamAvg} Clutch Factor with ${aboveLine} of ${DS.athletes.length} above the 750 line. The matrix view shows who is aligned and who needs a conversation.`,
    outlier
      ? `Worth a look: ${outlier.name} scores ${outlier.clutch_score} — elite — but alignment is ${outlier.alignment}. High clutch, low buy-in is a coaching conversation, not a drill assignment.`
      : `Spread your attention across quadrants — the aligned builders often move fastest.`,
    `Before practice, pick one athlete per quadrant and plan one touchpoint each. Small, specific, weekly.`,
  ],
};

export function localHowieReply(message: string, persona: Persona, history: HowieMessage[]): string {
  const m = message.toLowerCase();
  let reply: string;
  if (m.includes("drill") || m.includes("rep")) {
    reply = "Drills are short mental reps tied to a domain. Pick the domain with the lowest score and do its drill twice this week — consistency beats intensity.";
  } else if (m.includes("matrix") || m.includes("alignment")) {
    reply = "The alignment matrix plots Clutch Factor against alignment, split at 750 and 60. Each quadrant wants a different coaching move — the labels in the app say which.";
  } else if (m.includes("score") || m.includes("clutch")) {
    reply = persona === "coach"
      ? `Team average is ${teamAvg}. The distribution chart shows the shape — the middle of the roster is where the fastest gains live.`
      : `Clutch Factor runs 0 to 1000, and 750 is the line the matrix uses. Harper is at ${harper.clutch_score} right now.`;
  } else {
    const rotation = ROTATIONS[persona];
    reply = rotation[history.filter((h) => h.role === "user").length % rotation.length];
  }
  return history.length === 0 ? `${reply}\n\n${KIT_NOTE}` : reply;
}
