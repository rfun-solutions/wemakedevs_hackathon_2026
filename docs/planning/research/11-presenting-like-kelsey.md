# 11 Presenting like Kelsey: what he does on stage, and what it means for our demo

Researched 2026-11-08 for the WeMakeDevs Cloud Native Hackathon (2026-11-09), where Kelsey Hightower judges. Our slot: solo demo of KubeCompanion, length unknown, probably 3 to 5 minutes. Inputs: `07-deep-plan.md` §4 (Kay storyline) and `10-innovation-ideas.md` Round 2 (G4, D2, R3, X1).

**Confidence note.** Pages and podcasts were read through a summarising fetch tool, not watched. The direct quotes below come from published transcripts or articles. Check them against the source before repeating them anywhere public. Where a claim comes from someone else's write-up, the text says so.

---

## 1. Sources

Primary (his own words: transcripts, interviews, his repos):
- **"Kelsey Hightower's approach to developer relations"**, talk transcript, developerrelations.com: https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations . The best source on preparation, rehearsal and the failed-demo story.
- **Future Around & Find Out podcast**, episode with Kelsey: https://share.transistor.fm/s/709c91eb . Covers live demos played "like live jazz", using no scripts, his near-failure at a Google keynote ("extra dope" save, about 32 to 36 min in) and passing on the "aha" moment.
- **Tech Lead Journal #180**, on public speaking: https://techleadjournal.dev/episodes/180/ . Covers talking only about what you work on, being yourself rather than a "college professor", and telling a talk like a story to friends.
- **TFIR, "Find better stories, tell better stories"**, on a keynote with no demo, no slides and no notes: https://tfir.io/find-better-stories-tell-better-stories-secret-of-delivering-great-keynotes/
- **TFIR, "No Code explained"**: https://tfir.io/no-code-explained/ , and the repo https://github.com/kelseyhightower/nocode ("Write nothing; deploy nowhere").
- **Kubernetes the Hard Way README**: https://github.com/kelseyhightower/kubernetes-the-hard-way
- **The Stack, Feb 2025**, on AI hype ("You say RAG, I say cache"): https://www.thestack.technology/kelsey-hightower-says-cloud-needs-to-scale-down-and-so-does-ai-hype/
- **The New Stack, KubeCon 2026**, on "Everyone is a junior engineer when it comes to AI": https://thenewstack.io/hightower-ai-open-source-kubecon/
- **The Register, Apr 2026**, where he mocks automation rebranded as "zero-token architecture": https://www.theregister.com/2026/04/08/automation_zerotoken_architecture_ai/

Secondary (reports and analyses of his talks):
- **Linux.com, "Kubernetes the Smart Way"**, on the KubeCon 2017 Austin keynote: https://www.linux.com/audience/devops/kubernetes-smart-way . An 8-node cluster by voice from a phone, git push to deploy with no kubectl, scaling to 10 replicas by voice.
- **Superuser, "Kubernetes boring"**: https://superuser.openinfra.org/articles/kubernetes-boring/ ("kubectl is the new SSH")
- **Gremlin, Break Things on Purpose ep. 10**, which mentions the Tetris talk: https://www.gremlin.com/blog/podcast-break-things-on-purpose-ep-10-kelsey-hightower-principal-developer-advocate-at-google
- **Cuttlesoft PyCon 2017 recap** ("Kubernetes for Pythonistas": Google Assistant controls a cluster, the scheduler explained with Tetris): https://staging-cuttlesoft-com.vercel.app/blog/2017/06/02/pycon-2017-must-see-talks . Video: https://pyvideo.org/pycon-us-2017/keynote-kubernetes-for-pythonistas.html
- **Curiefense, "Learning in public with Kelsey Hightower"**: https://curiefense.netlify.app/blog/learning-in-public-with-kelsey-hightower ("teachers, not magicians", "removing all the bells and whistles")
- **Event page**: https://luma.com/cnh . The challenge is to make conferences easier, and the Merge Forward track is "Conferences for Everyone".

Not found: anything Kelsey has said specifically about judging hackathons. Section 3 is therefore inference.

---

## 2. The nine most transferable aspects of his style

### A1. Demo first, slides last or never
He stopped using slides and does not write talks in advance. He prepares demos and keeps a large repertoire of them: "I have hundreds of them and I play them like a musical instrument" ([devrel transcript](https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations)). His keynotes are mostly a phone or a terminal, as in KubeCon 2017 ([Linux.com](https://www.linux.com/audience/devops/kubernetes-smart-way)). In the one keynote where he went the other way, he used no demo and no slides at all, only stories ([TFIR](https://tfir.io/find-better-stories-tell-better-stories-secret-of-delivering-great-keynotes/)). He works in one medium at a time and never puts a heavy deck next to a demo.

### A2. Pass on the "aha", not the feature list
His aim is to give the audience the moment he had when he first used the tool. He sets up shared context so they feel the problem, then shows the payoff, for example by deleting machines and watching Kubernetes bring them back ([FAFO podcast](https://share.transistor.fm/s/709c91eb); [Tech Lead Journal](https://techleadjournal.dev/episodes/180/)). He builds one feeling per demo, not a tour.

### A3. Talk about what you actually built and care about
"Typically, I only talk about things that I'm either working on or care about" ([Tech Lead Journal](https://techleadjournal.dev/episodes/180/)). He tells speakers to use their own voice rather than imitate a professor or "what a good speaker's supposed to be" ([devrel](https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations)).

### A4. Hide the infrastructure; the system working end to end is the point
At KubeCon 2017 he used no kubectl. He did a git push, a branch went to staging and master went to production, and he showed the dashboard, all from a phone. His message was that Kubernetes should be a means to an end and "boring" ([Linux.com](https://www.linux.com/audience/devops/kubernetes-smart-way); [Superuser](https://superuser.openinfra.org/articles/kubernetes-boring/)). The audience sees a user outcome, and the platform is the quiet reason it worked.

### A5. A playful, physical metaphor that carries a real idea
He explains the scheduler as Tetris, with nodes as the board and pods as the blocks, and has played Tetris on stage ([Gremlin](https://www.gremlin.com/blog/podcast-break-things-on-purpose-ep-10-kelsey-hightower-principal-developer-advocate-at-google); [Cuttlesoft](https://staging-cuttlesoft-com.vercel.app/blog/2017/06/02/pycon-2017-must-see-talks)). He drives clusters with Google Assistant. The playfulness always explains something; it is never decoration.

### A6. Simplicity; do the hard thing so the user does not have to
Kubernetes the Hard Way is "optimized for learning" and takes "the long route" on purpose ([README](https://github.com/kelseyhightower/kubernetes-the-hard-way)). Others describe his method as "removing all the bells and whistles" to find the simplest way to make the point ([Curiefense](https://curiefense.netlify.app/blog/learning-in-public-with-kelsey-hightower)).

### A7. Allergic to hype, and to AI hype in particular
He wrote No Code as "a joke against how people market things" ([TFIR](https://tfir.io/no-code-explained/)). On AI: "You say RAG, I say cache"; agents are "just software" handling data; he is "consciously opting out" of the hype ([The Stack](https://www.thestack.technology/kelsey-hightower-says-cloud-needs-to-scale-down-and-so-does-ai-hype/)); and he mocks "zero-token architecture" rebrands ([The Register](https://www.theregister.com/2026/04/08/automation_zerotoken_architecture_ai/)). He also says AI is real and worth taking seriously ([New Stack](https://thenewstack.io/hightower-ai-open-source-kubecon/)). He is a sceptic, not a denier.

### A8. Honest about failure; the audience is on your side
When a demo broke, he stopped and asked the room "Does anyone want to see this work?" They leaned in, and he took away that "people are actually on your side" ([devrel](https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations)). At a Google keynote, a new Chromebook's key bindings and pop-ups nearly sank a live 13-minute build. He narrated it ("I'm on stage dying"), made a joke, and the voice app's reply ("extra dope") won the room ([FAFO](https://share.transistor.fm/s/709c91eb)).

### A9. Risk is managed by rehearsal, not by scripts
"I rehearse and I remember" ([devrel](https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations)). He refused scripted table reads at Google keynotes but always made sure a working demo existed and kept a clear arc ([FAFO](https://share.transistor.fm/s/709c91eb)). He adjusts mid-talk "until the body language improves" ([devrel](https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations)). Knowing the material deeply is what lets him improvise.

---

## 3. What he likely values as a judge (all inference unless marked)

| Likely rewards | Likely penalises | Basis |
|---|---|---|
| A real problem stated plainly, ideally one the builder has felt | Problems invented to fit sponsor tools | A2, A3 (inference) |
| One thing working live, end to end, for a real user | Architecture slides, logo walls, "powered by" lists | A1, A4 (inference) |
| Honest scope: "this part is real, this part is mocked" | Overclaiming, especially autonomy claims for AI agents | A7, A8 (inference; the AI scepticism is documented) |
| Simple solutions to hard problems; "boring" infrastructure | Complexity as a show of effort | A4, A6 (inference) |
| Humanity and inclusion. The event's own criteria include making conferences easier and "Conferences for Everyone" ([luma](https://luma.com/cnh)) | Accessibility used as decoration or as a pity story | Event page (fact); his "human-first" reputation ([devrel](https://developerrelations.com/talks/kelsey-hightowers-approach-to-developer-relations)) (inference) |
| Composure and humour when things break | Panic, or hiding a failure behind a video without saying so | A8 (inference) |
| Clarity about what AI did versus what you did | "Built by N agents" as the headline | A7 (inference) |

The risk for us: our project is dense with AI agents (Agent0, Radar, Gitar, Claude-built code), and he is the most quoted AI-hype sceptic in cloud native. That only works if every agent moment is shown as **software dealing with data that produced a checkable result**, never as magic.

---

## 4. Mapping onto our plan: keep, change, drop

### 4.1 Kay, the cartoon attendee. Candid verdict: keep Kay, but make Kay much smaller.
- **Risk.** A cartoon that stacks hard of hearing, ESL and first-timer onto one person, with a panel for every beat, reads like a marketing persona. That is exactly the kind of polish No Code makes fun of. It also pulls time away from the live system, which is what he rewards (A1, A4). A comic deck next to a live demo breaks the one-medium habit (A1).
- **What works.** A character as a framing device is close to his Tetris trick (A5) when it carries a real idea. Here the idea is that accessibility needs are runtime conditions the cluster can observe and adapt to. That is a genuinely cloud-native framing.
- **Recommendation.**
  - Use Kay in one opening panel and one closing panel at most, not seven.
  - Say early, plainly and without drama that Kay is a composite. If the story has a real origin (yours, a colleague's, something you saw this week in Salt Lake City), lead with that instead; A3 says it lands harder. **Open question for you: is there a true first-person hook we can use?**
  - Do not narrate Kay's disabilities as hardship. State the need ("captions that keep up") and move to the product.
- **Better than a cartoon: make the judge the user (A2, A4).** Kelsey does voice demos. Ask him to say one sentence into the phone or the stage mic, show captions live on the projector, then trigger the lag and show the captions switching engine. He becomes Kay for 30 seconds. Rehearse the fallback where you speak instead if he declines.

### 4.2 Beats: cut from seven to one live loop plus two quick proofs
The 3 to 4 minute default (beats 0, 1, 2, 3a, 4, 5, 7) is a feature tour, and A2 says one aha beats many. Keep:
1. **D2 adaptive captions (live, the hero).** It is the most human, it is visible, and the infrastructure stays invisible, much like the KubeCon 2017 demo. The Dash0 panel appears for 10 seconds as the reason it worked, not as the subject.
2. **G4 "production wrote this rule" (live or near-live, 30 s).** This is the strongest Kelsey-style idea in the plan: the boring automation loop of telemetry becoming a review rule becoming a quoted finding. Show the rule header, then Gitar quoting it.
3. **R3 Agent0 and Radar on the slowdown (20 s, shown not narrated).** Show the fix PR that cites both. Do not run it live and do not call it "two AI SREs" on stage. Say "the telemetry side and the cluster side agreed on the cause; here is the PR."

Drop or demote: beat 1 (agenda building warning), beat 2 (voice capture), beat 3a (comm card) and beat 6 (threads) become one 5-second flick across screens, or go only into the video. Beat 5 (Gitar fixes CI) gets folded into G4 or cut; two Gitar stories is one too many.

### 4.3 Closing line: change it
"Built today by N agents, every PR Gitar-reviewed, AI use disclosed" leads with the agents and will grate (A7). Replace it with the user outcome, followed by one plain sentence of disclosure: "Kay's captions kept up because the cluster was watching. I wrote the specs and reviewed every merge; agents wrote most of the code, and the repo says which." That is honest and specific, and it keeps the claim the right size.

---

## 5. Concrete recommendations for the demo

### 5.1 Opening line style
One sentence of real problem, in your own voice, no title slide. For example:
> "Yesterday's keynote had live captions on the big screen. My phone didn't. If English is your second language and you can't hear well, KubeCon is 37 rooms of noise."

If there is a true personal version, use it instead. Do not start with "KubeCompanion is an AI-powered..."

### 5.2 Structure (3-minute core; 5-minute adds the optional lines)
| Time | Beat | Medium |
|---|---|---|
| 0:00–0:15 | Real problem, one sentence; one Kay panel at most | voice, one image |
| 0:15–1:30 | **Hero: captions live.** Judge or presenter speaks; captions appear; trigger lag; the screen says "switching engine"; Status shows "slow for everyone, not your phone" | phone mirrored + projector |
| 1:30–1:45 | Why it worked: the Dash0 SLI panel by engine, one sentence | browser tab |
| 1:45–2:30 | **Production wrote this rule:** the 15:45 slowdown, `hot-paths.md` header, Gitar quoting it on a PR | GitHub tab |
| 2:30–2:45 | The slowdown's fix PR citing Agent0 and Radar; the Status footer shows the Radar all-clear | GitHub tab |
| 2:45–3:00 | Close: user outcome plus the one-sentence disclosure | voice |
| (+5 min) | Optional: a 20 s flick through agenda warning, voice note offline, comm card; a Synthetic Kay probe line | phone |

### 5.3 Live-demo choreography
- **Tabs pre-opened, left to right in story order:** app on phone (mirrored), Status screen, Dash0 panel, `hot-paths.md`, Gitar PR, fix PR, backup video at the right timestamp. No typing URLs and no logging in on stage (the Chromebook lesson, A8).
- **Trigger the caption lag with one prepared action** (a toggle or a fault-injection flag), not by hoping the network is slow. Say out loud that you are injecting it; honesty is itself a Kelsey move.
- **Narrate what the audience should look at** before it happens ("watch the top-right badge"). This matters for a hard-of-hearing audience member too, and it practises the product's own values.
- **Captions on for your own talk**, if the venue setup allows it. Presenting with KubeCompanion captioning you is the most on-theme proof available.

### 5.4 Risk handling
- **Rehearse until you remember it (A9):** at least three full timed runs tonight, one from a cold laptop on phone tethering.
- **Every live step has a pre-staged equivalent** one tab to the right: a finished Gitar PR from the dress rehearsal, and a recorded caption switch.
- **If something breaks, say so in one line and keep moving.** "Live Wi-Fi, live AI; here is the same thing from an hour ago." Switch to the backup video clip for that beat only, then return to live. Never silently play the video as if it were live; he will notice, and A8 says honesty wins the room.
- **Time-box any stall to 10 seconds** before switching to the backup.
- **Have a 2-minute cut memorised** (the hero beat plus the close) in case the slot is shorter than expected.

### 5.5 Closing
End on the human outcome and one checkable artefact: the public URL or QR code, plus a repo link where the AI-use disclosure lives. Make no claims about the future ("this will change conferences"). Stop talking when the time is up. Leave the last frame on Kay's phone working, not on a logo slide.

### 5.6 Changes to make in `07-deep-plan.md` §4
- §4.2: cut to the three beats above; keep the other beats for the video only.
- §4.1: limit Kay to two panels and add the composite disclosure.
- §4.3: the "3–4 min" row becomes the table in 5.2 here; add the 2-minute cut (hero plus close).
- Beat 7 copy: replace the "built by N agents" line as described in 4.3.
