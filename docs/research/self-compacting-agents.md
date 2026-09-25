[Skip to main content](https://arxiv.org/abs/2606.23525#content)

Search arXiv

Press Enter to search · [Advanced search](https://arxiv.org/search/advanced)

# Computer Science > Computation and Language

**arXiv:2606.23525** (cs)


\[Submitted on 22 Jun 2026 ( [v1](https://arxiv.org/abs/2606.23525v1)), last revised 10 Jul 2026 (this version, v2)\]

# Title:Self-Compacting Language Model Agents

Authors: [Tianjian Li](https://arxiv.org/search/cs?searchtype=author&query=Li,+T), [Jingyu Zhang](https://arxiv.org/search/cs?searchtype=author&query=Zhang,+J), [William Jurayj](https://arxiv.org/search/cs?searchtype=author&query=Jurayj,+W), [Xi Wang](https://arxiv.org/search/cs?searchtype=author&query=Wang,+X), [Chuanyang Jin](https://arxiv.org/search/cs?searchtype=author&query=Jin,+C), [Mehrdad Farajtabar](https://arxiv.org/search/cs?searchtype=author&query=Farajtabar,+M), [Eric Nalisnick](https://arxiv.org/search/cs?searchtype=author&query=Nalisnick,+E), [Daniel Khashabi](https://arxiv.org/search/cs?searchtype=author&query=Khashabi,+D)

View a PDF of the paper titled Self-Compacting Language Model Agents, by Tianjian Li and 7 other authors

[View PDF](https://arxiv.org/pdf/2606.23525) [HTML (experimental)](https://arxiv.org/html/2606.23525v2)

> Abstract:Long agent traces composed of chains of thought and tool calls accumulate stale content that anchor subsequent generations, and eventually outgrow the context window. Existing scaffolds mitigate it with fixed-interval compaction triggered at a token threshold. Such triggers pay no heed to trajectory structure, risking discard of partial results mid-derivation or mid-search. We propose SelfCompact, a scaffold that allows the model itself to decide when and how to compact. Specifically, it pairs two inference-time elements: (i) a compaction tool the model invokes to summarize the accumulated context, and (ii) a lightweight rubric specifying when to fire (a sub-task has resolved, or the trajectory is converging) and when to suppress (mid-derivation, or when stuck). Both are needed. The tool alone is unevenly used across open-weight models, often invoked at unhelpful moments or not at all; the rubric alone cannot act. Together, they elicit effective adaptive compaction without any fine-tuning or external supervision. We present empirical results on six benchmarks (competitive math and agentic search) and seven models. Our results show that SelfCompact matches or exceeds fixed-interval summarization at a fraction of the token cost, improving over a no-summarization baseline by up to 18.1 points on math and 5-9 points on agentic search at 30-70% lower per-question cost. Our results expose a meta-cognitive gap: although unprompted models cannot reliably tell when their own context is rotting, a lightweight rubric closes this gap, reframing when to compact as a capability that scaffolds can supply without training.

|     |     |
| --- | --- |
| Comments: | 25 pages, 3 figures |
| Subjects: | Computation and Language (cs.CL) |
| Cite as: | [arXiv:2606.23525](https://arxiv.org/abs/2606.23525) \[cs.CL\] |
|  | (or [arXiv:2606.23525v2](https://arxiv.org/abs/2606.23525v2) \[cs.CL\] for this version) |
|  | [https://doi.org/10.48550/arXiv.2606.23525](https://doi.org/10.48550/arXiv.2606.23525)<br>Focus to learn more<br>arXiv-issued DOI via DataCite |

## Submission history

From: Tianjian Li \[ [view email](https://arxiv.org/show-email/55c917b7/2606.23525)\]

**[\[v1\]](https://arxiv.org/abs/2606.23525v1)**
Mon, 22 Jun 2026 16:08:34 UTC (631 KB)

**\[v2\]**
Fri, 10 Jul 2026 18:13:00 UTC (1,079 KB)

Full-text links:

## Access Paper:

View a PDF of the paper titled Self-Compacting Language Model Agents, by Tianjian Li and 7 other authors

- [View PDF](https://arxiv.org/pdf/2606.23525)
- [HTML (experimental)](https://arxiv.org/html/2606.23525v2)
- [TeX Source](https://arxiv.org/src/2606.23525)

[![license icon](https://arxiv.org/icons/licenses/by-4.0.png)view license](http://creativecommons.org/licenses/by/4.0/ "Rights to this article")

### Current browse context:

cs.CL

[< prev](https://arxiv.org/prevnext?id=2606.23525&function=prev&context=cs.CL "previous in cs.CL (accesskey p)")  \|  [next >](https://arxiv.org/prevnext?id=2606.23525&function=next&context=cs.CL "next in cs.CL (accesskey n)")

[new](https://arxiv.org/list/cs.CL/new) \| [recent](https://arxiv.org/list/cs.CL/recent) \| [2026-06](https://arxiv.org/list/cs.CL/2026-06)

Change to browse by:


[cs](https://arxiv.org/abs/2606.23525?context=cs)

### References & Citations

- [NASA ADS](https://ui.adsabs.harvard.edu/abs/arXiv:2606.23525)
- [Google Scholar](https://scholar.google.com/scholar_lookup?arxiv_id=2606.23525)
- [Semantic Scholar](https://api.semanticscholar.org/arXiv:2606.23525)

export BibTeX citation

### Bookmark

[![BibSonomy](https://arxiv.org/static/browse/0.3.4/images/icons/social/bibsonomy.png)](http://www.bibsonomy.org/BibtexHandler?requTask=upload&url=https://arxiv.org/abs/2606.23525&description=Self-Compacting%20Language%20Model%20Agents "Bookmark on BibSonomy") [![Reddit](https://arxiv.org/static/browse/0.3.4/images/icons/social/reddit.png)](https://reddit.com/submit?url=https://arxiv.org/abs/2606.23525&title=Self-Compacting%20Language%20Model%20Agents "Bookmark on Reddit")

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

[Which authors of this paper are endorsers?](https://arxiv.org/auth/show-endorsers/2606.23525) \|
Disable MathJax ( [What is MathJax?](https://info.arxiv.org/help/mathjax.html))