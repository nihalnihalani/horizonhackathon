[Skip to main content](https://arxiv.org/abs/2608.22752#content)

Search arXiv

Press Enter to search · [Advanced search](https://arxiv.org/search/advanced)

# Computer Science > Artificial Intelligence

**arXiv:2608.22752** (cs)


\[Submitted on 24 Aug 2026\]

# Title:The Compaction Cliff in Long-Running AI Agent Memory

Authors: [Saber Zerhoudi](https://arxiv.org/search/cs?searchtype=author&query=Zerhoudi,+S), [Jelena Mitrovic](https://arxiv.org/search/cs?searchtype=author&query=Mitrovic,+J), [Michael Granitzer](https://arxiv.org/search/cs?searchtype=author&query=Granitzer,+M)

View a PDF of the paper titled The Compaction Cliff in Long-Running AI Agent Memory, by Saber Zerhoudi and 2 other authors

[View PDF](https://arxiv.org/pdf/2608.22752) [HTML (experimental)](https://arxiv.org/html/2608.22752v1)

> Abstract:A safety rule and an episodic log compete for the same tokens in an AI agent's context. When the budget overflows, both are summarized at the same rate; only the rule needs exact wording to remain enforceable. On 20 production agent configurations, Claude Code's /compact prompt on Sonnet 4.6 preserves 53\\% of safety rules after one compaction round and 10\\% after five. We name this the Compaction Cliff. We address it with Knowledge Triage, a framework that classifies each line of an agent's knowledge base by type and routes each type through its own retention policy. Three deterministic operators implement this triage across the three context-management operations: TypeCompact rewrites items in place under per-type fidelity, TypeDecompose partitions a topic too large to compact safely, replicating in-scope safety rules across partitions, and TypeRetrieve fetches items from external storage with in-scope rules pinned ahead of relevance. On five public corpora, TypeCompact preserves 2--4× more safety rules than the strongest single-shot LLM compactor at every ratio, with 96\\% recall over five rounds. TypeDecompose reaches 0\\% locality violations against 93\\% under uniform partitioning. TypeRetrieve reaches 100\\% recall@50 against 73\\% for the best single-shot LLM retriever. On three downstream behavioral benchmarks, we outperform the production Sonnet compactor on medical compliance (paired McNemar p<10−8 on preservation, N=200), the full-policy and hierarchical baselines on retail task pass rate (p<0.01, N=115), and the hierarchical compaction on the airline domain (p=0.024). We release AgentArtifactCorpus (396{,}934 agent configurations from 54{,}628 public GitHub repositories), the classifier, and the reference implementation.

|     |     |
| --- | --- |
| Subjects: | Artificial Intelligence (cs.AI); Information Retrieval (cs.IR) |
| Cite as: | [arXiv:2608.22752](https://arxiv.org/abs/2608.22752) \[cs.AI\] |
|  | (or [arXiv:2608.22752v1](https://arxiv.org/abs/2608.22752v1) \[cs.AI\] for this version) |
|  | [https://doi.org/10.48550/arXiv.2608.22752](https://doi.org/10.48550/arXiv.2608.22752)<br>Focus to learn more<br>arXiv-issued DOI via DataCite |
| Journal reference: | Proceedings of the 35th ACM International Conference on Information and Knowledge Management (CIKM 2026) |
| Related DOI: | [https://doi.org/10.1145/3799682.3840567](https://doi.org/10.1145/3799682.3840567)<br>Focus to learn more<br>DOI(s) linking to related resources |

## Submission history

From: Saber Zerhoudi \[ [view email](https://arxiv.org/show-email/911020a4/2608.22752)\]

**\[v1\]**
Mon, 24 Aug 2026 03:21:56 UTC (941 KB)

Full-text links:

## Access Paper:

View a PDF of the paper titled The Compaction Cliff in Long-Running AI Agent Memory, by Saber Zerhoudi and 2 other authors

- [View PDF](https://arxiv.org/pdf/2608.22752)
- [HTML (experimental)](https://arxiv.org/html/2608.22752v1)
- [TeX Source](https://arxiv.org/src/2608.22752)

[![license icon](https://arxiv.org/icons/licenses/by-4.0.png)view license](http://creativecommons.org/licenses/by/4.0/ "Rights to this article")

### Current browse context:

cs.AI

[< prev](https://arxiv.org/prevnext?id=2608.22752&function=prev&context=cs.AI "previous in cs.AI (accesskey p)")  \|  [next >](https://arxiv.org/prevnext?id=2608.22752&function=next&context=cs.AI "next in cs.AI (accesskey n)")

[new](https://arxiv.org/list/cs.AI/new) \| [recent](https://arxiv.org/list/cs.AI/recent) \| [2026-08](https://arxiv.org/list/cs.AI/2026-08)

Change to browse by:


[cs](https://arxiv.org/abs/2608.22752?context=cs)

[cs.IR](https://arxiv.org/abs/2608.22752?context=cs.IR)

### References & Citations

- [NASA ADS](https://ui.adsabs.harvard.edu/abs/arXiv:2608.22752)
- [Google Scholar](https://scholar.google.com/scholar_lookup?arxiv_id=2608.22752)
- [Semantic Scholar](https://api.semanticscholar.org/arXiv:2608.22752)

export BibTeX citation

### Bookmark

[![BibSonomy](https://arxiv.org/static/browse/0.3.4/images/icons/social/bibsonomy.png)](http://www.bibsonomy.org/BibtexHandler?requTask=upload&url=https://arxiv.org/abs/2608.22752&description=The%20Compaction%20Cliff%20in%20Long-Running%20AI%20Agent%20Memory "Bookmark on BibSonomy") [![Reddit](https://arxiv.org/static/browse/0.3.4/images/icons/social/reddit.png)](https://reddit.com/submit?url=https://arxiv.org/abs/2608.22752&title=The%20Compaction%20Cliff%20in%20Long-Running%20AI%20Agent%20Memory "Bookmark on Reddit")

Bibliographic Tools

# Bibliographic and Citation Tools

Bibliographic Explorer Toggle

Bibliographic Explorer _( [What is the Explorer?](https://info.arxiv.org/labs/showcase.html#arxiv-bibliographic-explorer))_

Connected Papers Toggle

Connected Papers _( [What is Connected Papers?](https://www.connectedpapers.com/about))_

Litmaps Toggle

Litmaps _( [What is Litmaps?](https://www.litmaps.co/))_

scite.ai Toggle

scite Smart Citations _( [What are Smart Citations?](https://www.scite.ai/))_

Code, Data, Media

# Code, Data and Media Associated with this Article

alphaXiv Toggle

alphaXiv _( [What is alphaXiv?](https://alphaxiv.org/))_

Links to Code Toggle

CatalyzeX Code Finder for Papers _( [What is CatalyzeX?](https://www.catalyzex.com/))_

DagsHub Toggle

DagsHub _( [What is DagsHub?](https://dagshub.com/))_

GotitPub Toggle

Gotit.pub _( [What is GotitPub?](http://gotit.pub/faq))_

Huggingface Toggle

Hugging Face _( [What is Huggingface?](https://huggingface.co/huggingface))_

ScienceCast Toggle

ScienceCast _( [What is ScienceCast?](https://sciencecast.org/welcome))_

Demos

# Demos

Replicate Toggle

Replicate _( [What is Replicate?](https://replicate.com/docs/arxiv/about))_

Spaces Toggle

Hugging Face Spaces _( [What is Spaces?](https://huggingface.co/docs/hub/spaces))_

Spaces Toggle

TXYZ.AI _( [What is TXYZ.AI?](https://txyz.ai/))_

Related Papers

# Recommenders and Search Tools

Link to Influence Flower

Influence Flower _( [What are Influence Flowers?](https://influencemap.cmlab.dev/))_

Core recommender toggle

CORE Recommender _( [What is CORE?](https://core.ac.uk/services/recommender))_

- Author
- Venue
- Institution
- Topic

About arXivLabs


# arXivLabs: experimental projects with community collaborators

arXivLabs is a framework that allows collaborators to develop and share new arXiv features directly on our website.

Both individuals and organizations that work with arXivLabs have embraced and accepted our values of openness, community, excellence, and user data privacy. arXiv is committed to these values and only works with partners that adhere to them.

Have an idea for a project that will add value for arXiv's community? [**Learn more about arXivLabs**](https://info.arxiv.org/labs/index.html).

[Which authors of this paper are endorsers?](https://arxiv.org/auth/show-endorsers/2608.22752) \|
Disable MathJax ( [What is MathJax?](https://info.arxiv.org/help/mathjax.html))