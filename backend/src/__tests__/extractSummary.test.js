function extractSummary(entries) {
    if (!entries || entries.length === 0) {
        return { executiveSummary: 'Not enough transcript data to generate a summary.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    const seen = new Set();
    const unique = [];
    entries.forEach(e => {
        const key = (e.text || '').toLowerCase().slice(0, 60);
        if (!seen.has(key)) { seen.add(key); unique.push({ speaker: e.speaker || 'Speaker', text: e.text, ts: e.timestamp || 0 }); }
    });

    if (unique.length === 0) {
        return { executiveSummary: 'All transcript entries were duplicates. No unique content to summarize.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    const allSentences = [];
    unique.forEach(e => {
        (e.text.match(/[^.!?]+[.!?]+/g) || [e.text]).forEach(s => {
            const t = s.trim();
            if (t.length > 15) allSentences.push({ text: t, speaker: e.speaker });
        });
    });

    if (allSentences.length === 0) {
        return { executiveSummary: 'No meaningful sentences found in transcript.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','must','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','these','those','it','its','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom','about','also','well','like','really','actually','basically','okay','yeah','yes','no','oh','uh','um','ah','sort','kind','bit','lot','thing','stuff','maybe','probably','anyway','right','alright','ok','hello','hi','hey','thanks','thank','welcome','please','sure','great','good','nice','quite','pretty']);

    const wordInDocs = {};
    allSentences.forEach(s => {
        const words = new Set(s.text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)));
        words.forEach(w => { wordInDocs[w] = (wordInDocs[w] || 0) + 1; });
    });

    const totalSent = allSentences.length;
    const decisionRe = /\b(decided|agreed|approved|confirmed|finalized|consensus|voted|settled|concluded|resolved|committed|selected|chosen|aligned|on the same page|we('ll| are) going with|let'?s go with|we landed on)\b/i;
    const taskRe = /\b(will|going to|plan to|need to|has to|must|should|responsible for|assigned to|tasked with|owner|action item|follow up|to-do|todo|take care of|handle|work on|look into|investigate|prepare|create|set up|schedule|send|share|draft|write|update|fix|implement|build|develop|test|deploy|release|submit|review|approve|reach out|coordinate|organize|lead)\b/i;
    const riskRe = /\b(risk|concern|issue|problem|blocker|challenge|difficulty|worry|caution|caveat|downside|drawback|limitation|constraint|bottleneck|delays|uncertainty|dependenc|open question|open item)\b/i;
    const closingRe = /\b(conclude|summary|wrap up|key takeaway|next step|moving forward|going forward|upcoming|follow-up)\b/i;

    const scored = allSentences.map((s, i) => {
        let score = 0;
        const words = s.text.split(/\s+/);
        const contentWords = words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
        if (i < 3) score += 2;
        if (i >= totalSent - 2) score += 1.5;
        contentWords.forEach(w => { const freq = wordInDocs[w.toLowerCase()] || 0; if (freq >= 2) score += 0.3; });
        if (words.length >= 10 && words.length <= 35) score += 1.5;
        else if (words.length > 5 && words.length < 50) score += 0.5;
        if (/\b(discuss|topic|agenda|purpose|goal|objective|present|propose|suggest|recommend|update|progress|status|report)\b/i.test(s.text)) score += 2;
        if (closingRe.test(s.text)) score += 2;
        const hasDecision = decisionRe.test(s.text);
        if (hasDecision) score += 5;
        const hasTask = taskRe.test(s.text) && !/\?/.test(s.text);
        if (hasTask) score += 3;
        if (/\?/.test(s.text)) score -= 2;
        const hasRisk = riskRe.test(s.text);
        return { text: s.text, speaker: s.speaker, score, hasDecision, hasTask, hasRisk };
    });

    const clusters = [];
    const assigned = new Set();
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    sorted.forEach(s => {
        if (assigned.has(s.text)) return;
        const sWords = new Set(s.text.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
        if (sWords.size === 0) { assigned.add(s.text); return; }
        const cluster = { sentences: [s], words: sWords };
        assigned.add(s.text);
        sorted.forEach(s2 => {
            if (assigned.has(s2.text)) return;
            const s2Words = new Set(s2.text.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
            const overlap = [...sWords].filter(w => s2Words.has(w)).length;
            const union = new Set([...sWords, ...s2Words]).size;
            if (union > 0 && overlap / union > 0.12) {
                cluster.sentences.push(s2);
                assigned.add(s2.text);
                s2Words.forEach(w => sWords.add(w));
            }
        });
        clusters.push(cluster);
    });
    scored.forEach(s => {
        if (!assigned.has(s.text)) {
            const sWords = new Set(s.text.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
            if (sWords.size > 0) { clusters.push({ sentences: [s], words: sWords }); assigned.add(s.text); }
        }
    });

    clusters.sort((a, b) => {
        const aAvg = a.sentences.reduce((sum, s) => sum + s.score, 0) / a.sentences.length;
        const bAvg = b.sentences.reduce((sum, s) => sum + s.score, 0) / b.sentences.length;
        return bAvg - aAvg;
    });

    const topClusterWords = clusters.slice(0, 3).map(c => {
        const freqWords = [...c.words].filter(w => (wordInDocs[w] || 0) >= 2).sort((a, b) => (wordInDocs[b] || 0) - (wordInDocs[a] || 0)).slice(0, 3);
        return freqWords.length > 0 ? freqWords.join(', ') : null;
    }).filter(Boolean);

    const decisionCount = scored.filter(s => s.hasDecision).length;
    const taskCount = scored.filter(s => s.hasTask).length;
    const speakerNames = [...new Set(unique.map(e => e.speaker))].filter(Boolean);

    let executiveSummary = '';
    if (topClusterWords.length > 0) {
        executiveSummary = 'The meeting covered ' + topClusterWords.join(', ') + '. ';
    } else {
        const topSentences = scored.sort((a, b) => b.score - a.score).slice(0, 2);
        executiveSummary = topSentences.map(s => s.text).join(' ') + ' ';
    }
    if (decisionCount > 0) executiveSummary += decisionCount + ' decision' + (decisionCount > 1 ? 's were' : ' was') + ' reached. ';
    if (taskCount > 0) executiveSummary += taskCount + ' action item' + (taskCount > 1 ? 's were' : ' was') + ' identified. ';
    if (speakerNames.length > 1) executiveSummary += speakerNames.length + ' participant' + (speakerNames.length > 1 ? 's' : '') + ' contributed (' + speakerNames.join(', ') + ').';

    const keyDiscussionPoints = clusters.slice(0, 5).map(c => c.sentences.sort((a, b) => b.score - a.score)[0].text).filter(Boolean);
    const decisionsTaken = [...new Set(scored.filter(s => s.hasDecision).sort((a, b) => b.score - a.score).map(s => s.text))].slice(0, 8);
    const actionItems = [...new Set(scored.filter(s => s.hasTask).sort((a, b) => b.score - a.score).map(s => s.text))].slice(0, 8);
    const risks = [...new Set(scored.filter(s => s.hasRisk).sort((a, b) => b.score - a.score).map(s => s.text))].slice(0, 5);

    const lastThird = scored.slice(-Math.max(5, Math.ceil(scored.length / 3)));
    const nextStepSet = new Set();
    lastThird.filter(s => s.hasTask || closingRe.test(s.text)).forEach(s => nextStepSet.add(s.text));
    scored.filter(s => s.hasTask).forEach(s => nextStepSet.add(s.text));
    const nextSteps = [...nextStepSet].slice(0, 5);

    return {
        executiveSummary: executiveSummary.trim() || 'Meeting transcript processed.',
        keyDiscussionPoints,
        decisionsTaken,
        actionItems,
        risks,
        nextSteps
    };
}

describe('extractSummary', () => {
  it('returns empty summary for null input', () => {
    const result = extractSummary(null);
    expect(result.executiveSummary).toBe('Not enough transcript data to generate a summary.');
    expect(result.keyDiscussionPoints).toEqual([]);
  });

  it('returns empty summary for empty array', () => {
    const result = extractSummary([]);
    expect(result.executiveSummary).toBe('Not enough transcript data to generate a summary.');
  });

  it('returns empty summary for entries with only short text', () => {
    const entries = [{ text: 'hi', speaker: 'Alice', timestamp: 1 }];
    const result = extractSummary(entries);
    expect(result.executiveSummary).toBe('No meaningful sentences found in transcript.');
  });

  it('deduplicates identical entries', () => {
    const entries = [
      { text: 'We need to discuss the quarterly budget and finalize the plan for next year.', speaker: 'Alice', timestamp: 1 },
      { text: 'We need to discuss the quarterly budget and finalize the plan for next year.', speaker: 'Alice', timestamp: 2 },
    ];
    const result = extractSummary(entries);
    expect(result.keyDiscussionPoints.length).toBeGreaterThanOrEqual(1);
  });

  it('detects decisions in transcript', () => {
    const entries = [
      { text: 'We agreed to launch the product next month, and the team decided to allocate additional resources to the marketing department.', speaker: 'Bob', timestamp: 1 },
      { text: 'We also approved the new design for the homepage, which was presented by the design team.', speaker: 'Alice', timestamp: 2 },
    ];
    const result = extractSummary(entries);
    expect(result.decisionsTaken.length).toBeGreaterThanOrEqual(1);
    expect(result.executiveSummary).toContain('decision');
  });

  it('detects action items', () => {
    const entries = [
      { text: 'John will prepare the quarterly report and send it to the team by Friday, and also coordinate with the finance department for the budget review.', speaker: 'Alice', timestamp: 1 },
      { text: 'Sarah needs to set up a meeting with the stakeholders to discuss the project timeline and deliverables.', speaker: 'Bob', timestamp: 2 },
    ];
    const result = extractSummary(entries);
    expect(result.actionItems.length).toBeGreaterThanOrEqual(1);
    expect(result.executiveSummary).toContain('action item');
  });

  it('detects risks', () => {
    const entries = [
      { text: 'There is a risk that the vendor might not deliver on time, which could cause a delay in the project schedule.', speaker: 'Carol', timestamp: 1 },
      { text: 'Another concern is the budget constraint, as we might run out of funds before completing the project if we are not careful.', speaker: 'Dave', timestamp: 2 },
    ];
    const result = extractSummary(entries);
    expect(result.risks.length).toBeGreaterThanOrEqual(1);
  });

  it('handles multi-speaker meetings', () => {
    const entries = [
      { text: 'We need to discuss the budget for the next quarter and finalize the plan for the upcoming project.', speaker: 'Alice', timestamp: 1 },
      { text: 'I think we should allocate more resources to the research department for the new initiative.', speaker: 'Bob', timestamp: 2 },
    ];
    const result = extractSummary(entries);
    expect(result.executiveSummary).toContain('participant');
  });

  it('handles all-duplicate entries gracefully', () => {
    const text = 'The quarterly budget discussion covered various aspects of financial planning for the upcoming fiscal period.';
    const entries = Array(5).fill({ text, speaker: 'Alice', timestamp: 1 });
    const result = extractSummary(entries);
    expect(result.executiveSummary).toBeTruthy();
    expect(Array.isArray(result.keyDiscussionPoints)).toBe(true);
  });

  it('generates next steps from tasks', () => {
    const entries = [
      { text: 'We concluded that John will submit the final report and we will schedule a follow-up meeting next week to review the progress.', speaker: 'Alice', timestamp: 1 },
      { text: 'The next step is for the team to implement the changes based on the feedback we received today.', speaker: 'Bob', timestamp: 2 },
    ];
    const result = extractSummary(entries);
    expect(result.nextSteps.length).toBeGreaterThanOrEqual(1);
  });
});
