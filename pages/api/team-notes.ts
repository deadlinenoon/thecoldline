import type { NextApiRequest, NextApiResponse } from "next";
import { TEAM_NOTES } from "@/data/teamNotes";

function norm(s:string){ return (s||"").toLowerCase(); }

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  try{
    const team = String(req.query.team||"").trim();
    const opponent = String(req.query.opponent||"").trim();
    const kickoffISO = String(req.query.kickoff||"").trim();
    if(!team || !kickoffISO) return res.status(400).json({error:"Missing team or kickoff"});

    const when = new Date(kickoffISO);
    if(Number.isNaN(when.getTime())) return res.status(400).json({error:"Invalid kickoff"});

    // Gather notes for exact team plus any synthetic holiday key (e.g. Lions (THX))
    const namesToCheck = [team];
    if (team.includes("Lions")) namesToCheck.push("Detroit Lions (THX)");
    if (team.includes("Cowboys")) namesToCheck.push("Dallas Cowboys (THX)");
    if (team.includes("Ravens")) namesToCheck.push("Baltimore Ravens (THX)");
    if (team.includes("Commanders")) namesToCheck.push("Washington Commanders (XMAS)");
    if (team.includes("Vikings")) namesToCheck.push("Minnesota Vikings (XMAS)");
    if (team.includes("Chiefs")) namesToCheck.push("Kansas City Chiefs (XMAS)");

    const oppNorm = norm(opponent);
    const out: Array<{ text: string; matched?: boolean }> = [];

    for(const name of namesToCheck){
      const arr = TEAM_NOTES[name];
      if(!arr) continue;
      for(const note of arr){
        // expiry
        if (note.expiresBefore && when > new Date(note.expiresBefore + "T23:59:59Z")) continue;
        // opponent filter
        let matched = false;
        if (note.opponentIncludes) {
          matched = note.opponentIncludes.some((fragment: string) => oppNorm.includes(norm(fragment)));
          if (!matched) continue;
        }
        out.push({ text: note.text, matched });
      }
    }

    res.status(200).json({ team, opponent, notes: out });
  }catch(e:any){
    res.status(500).json({error:e?.message||"team-notes route error"});
  }
}
