# Reference: Gary-Yau Chan, "Ultimate 8-step guide to winning hackathons" (user-supplied text)

Author: Gary-Yau Chan, 3x Head of Growth, 26x hackathon winner, co-founder of Clarity Inbox. Participated in 40+ hackathons, won 20+.

## I. Find your hackathon mojo
Go in with the mindset to win; it's a competition. Best hackers: highly competitive, bored by "just talking about it", energized by deadlines, fueled by like-minded people.

## II. Be part of the best team
- Pitch your idea at the initial pitching session and get buy-in.
- Join a team that already has a front-end engineer (key role).
- Have friends/previous hackers; know strengths and weaknesses.
- Don't join solely because of the idea; ideas pivot fast. "Getting the right people and the right chemistry is more important than getting the right idea." (Ed Catmull)

Roles:
- **Front-End Engineer**: carries design from idea to conception; execute a beautiful UI/UX in 24h. One attempt. Not too experimental, not too many features (no time to show them). Optimize for 1 to 2 primary features to maximize the judges' WOW factor.
- **Business Development person**: crafts the business message, presents to judges (problem, market size, user validation), conducts user interviews, voice of reason in engineering disputes. Example: Harry, a BD partner, made the difference in 3 hackathons ($5,000 checks at 2 of them).

## III. Understanding the judges panel is key (4 main types)
Know your audience: investors? BD folks? CTOs/engineers? API evangelists? Choose the idea and tailor the presentation to the panel.

- **API Judges**: Integrate their API in the most unique way. Optimize for the "unused" or "unpopular" functions of their API; they love creativity that makes a non-core function interesting, "gamifying" those functions.
  - Losing example: StackOverflow API evangelist judge; team chose a basic integration at the last minute; prize went to a team that used the API more creatively. "Just sticking it on doesn't work."
  - Winning example: TNW Hack Battle 2013, SendGrid's new Events Webhook (triggers when recipient opens email) + hosted image deleted on second open = "Snapchat for emails"; combined with market knowledge (Gary Vaynerchuk bullish on disappearing coupons). Using what you know + a new API function = win.
- **CTO Judges**: You really have to build out the app. Show good code. Expect backend/database/algorithm questions. They want to know scalability, edge cases, where it can break. They think technically, logically, in depth; value conventional economics over behavioral. A simple app with tons of customer validation and/or market analysis will not impress them.
- **Investor Judges**: Driven by business fundamentals. Market size. Opportunity to integrate with their portfolio's ecosystem. Extra points if some other company has done your business model + integration + hack + community combination before: cite those examples. Historical data measures $$$ opportunity.
  - Losing example: Mobile Payments Hackathon; judges were investors in Cardflight; team did facial-recognition three-factor auth; lack of precedents and no validation; winner had a more familiar, less experimental model.
- **Business Development Judges**: Want to know your app helps their daily lives; they picture themselves as the user. If their family/friends/coworkers have the problem, talk about that. They're sales and marketing experts: show a roadmap for acquiring customers (community, marketplace, scraping a database, viral coefficient).
  - Avoid these business models with them: (1) "Big Company" partnership concepts (too farfetched), (2) selling to small businesses (hard to find budget), (3) Free (not a business model).
  - Example: post-Sandy hackathons; a volunteer surveying app won three times but judges voiced concerns about the free model. With BD judges, your project is judged at the level of a more mature business; you need a revenue plan.

## IV. Decide your approach: Backend vs API vs Design
- **Back-end approach**: usually doesn't work; no time to set up a backend. Utilize front-end and JavaScript.
  - Losing example: Spotify Music Education hackathon; a teammate built a Node.js backend for 24h, team supported him, no functional front-end experience; no judge asked how data was loaded; they only looked at the front-end UX.
- **API approach**: go see the API Evangelist, befriend them, have them teach you their API. A sit-down confirms your app can be tagged with that API (extra validation during judging). Avoid too much detail; they prefer to be WOWed during the presentation. If the API is backend-only, find a way to display data in your app and update it.
- **Design approach**: if no front-end dev, focus solely on design. First impression is everything; great UI/UX can win "audience favorite" prizes. Focus on business use case and presentation.

## V. It's only 24 hours: 5 design shortcuts
1. **Naming**: don't waste time; use a codename.
2. **Combine design**: use templates and proven color schemes (codrops, pttrns, useronboard).
3. **Content**: skip the sign-in screen; land on content.
4. **Transitions**: add a loading gif; tells judges something algorithmic is happening; gives you seconds to recover on notes.
5. **Prototype only**: if the concept is a new UX rather than backend functionality, design-prototype (Illustrator + Invision/Flinto). Apple WWDC 2014 "Prototyping: Fake It Till You Make It."
   - Winning example: Fincapdev hackathon; Immigrant Benefits Reminder app; judges focused on storytelling; personal story as children of immigrants; solid design prototype was sufficient; spent less time on the hack than other teams and won.

## VI. Validation
Always validate, before and after.
- **Before hacking**: BizDev person gets tallies on the idea and speaks with customers; type up notes for the presentation; a secret ingredient of storytelling.
- **After hacking**: on a 2-day event, spend day 2 out of the building talking to potential customers; take pictures of the customer with your team member. At least 2 artifacts show judges you (1) dared to take the next step on customer validation, (2) used Lean Startup, (3) data-driven, (4) customer approval and ready for trial.
- Winning example: SmallBizDev hackathon; pitched 6 businesses before coding; tech was 2 simple HTML pages; CTO judges scored low on tech, but the BD judge convinced the group with the research and validation.

## VII. Time to shine: hacking the demo
- **You**: say why you chose this hack; highlight your experience/industry background (skip names, they're on the tag). Dress to be noticed/memorable.
- **Building the presentation**:
  1. Perform a skit to demonstrate where a person encounters the pain point.
  2. Do an interactive demo; involve the audience if the product allows (e.g., text this Twilio number).
  3. Ask the audience questions for another level of validation, or to be remembered for Audience Choice ("Raise your hands, how many people hate the post office?").
- **Format that works**: Problem, Solution, Market (customer, acquisition), Validation (pictures with customer), Demo, Business Model, Future Rollout, Team.
- Be passionate and practice. Be loud and clear. **Never say you did not have enough time.** Everyone has the same amount.
- Your project is judged at the level of a more mature startup. Be ready for: (1) What's the business model? (2) How do you compare to XYZ? (3) How do you plan to acquire users? (4) How sustainable can it be? (5) Is it scalable? (6) Unspoken: can I deem you winners so you have the confidence to continue building?
- **Order matters**: if you present 1st, expect many questions (judges awake). After 10 presentations there are no questions; if none, speak up: keep creating selling points, talk about user feedback, show artifacts, results and learnings. When one judge asks and one teammate answers, another teammate shows the Market/Business Model slides in the background, or the app features not yet shown. Don't let judges stare into space.

## VIII. Winning: where to go from here
It's the people you worked with that matter most; a hackathon mirrors starting a startup. "Winning isn't everything, but wanting to win is." (Lombardi)
