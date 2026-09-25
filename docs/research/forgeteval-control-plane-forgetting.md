[Skip to main content](https://arxiv.org/abs/2606.15903#content)

Search arXiv

Press Enter to search · [Advanced search](https://arxiv.org/search/advanced)

# Computer Science > Computation and Language

**arXiv:2606.15903** (cs)


\[Submitted on 14 Jun 2026 ( [v1](https://arxiv.org/abs/2606.15903v1)), last revised 16 Jun 2026 (this version, v2)\]

# Title:Control-Plane Placement Shapes Forgetting: An Architectural Study of Agent Memory Across Thirteen System Configurations

Authors: [Dongxu Yang](https://arxiv.org/search/cs?searchtype=author&query=Yang,+D)

View a PDF of the paper titled Control-Plane Placement Shapes Forgetting: An Architectural Study of Agent Memory Across Thirteen System Configurations, by Dongxu Yang

[View PDF](https://arxiv.org/pdf/2606.15903) [HTML (experimental)](https://arxiv.org/html/2606.15903v2)

> Abstract:Where an LLM sits in an agent memory pipeline -- between the recall plane that retrieves stored facts (extensively benchmarked) and the control plane that mutates them via supersede, release, purge (largely untested) -- shapes which forgetting failure modes the system recovers. Comparing thirteen system configurations on a 385-case adversarial surface, we observe three placement regimes with partly complementary coverage: deterministic primitives suffice for lexical/temporal categories but fail canonicalization (5% on identifier-obfuscation, 0% on cross-lingual); inscribe-time LLM recovers canonicalization (100%) but cannot help intent-aware deletion (0% on prefix-collision and compound-fact); a mutation-time hook recovers intent-aware deletion (78-85%) and brightens nearly all categories simultaneously (91.7-93.2% overall, $0.17 per 385-case run, 2.3s/case mutation latency vs. 64-191ms/case deterministic, recall path unchanged).
>
> We expose the trade-off via ForgetEval, a 1000-case templated suite plus a 385-case adversarial layer (132 hand-crafted + 253 LLM-drafted oracle-validated) scored by deterministic substring match, paired with a six-method Adapter Protocol with honest N/A scoring that lets heterogeneous memory stores enter in 130 lines. Admission is corroborated by 10-annotator IAA (Fleiss' kappa = 0.958) and a 77-case external-authored subset (four blind contributors) that replicates the canonicalization asymmetry and amplifies the joint-placement lift (+27.8 pt). Production failures are predominantly forgetting failures rather than recall failures, yet existing benchmarks measure only recall. ForgetEval and all adapters are released under MIT.

|     |     |
| --- | --- |
| Comments: | 25 pages including appendices. Code, benchmark, and adapters released under MIT at [this https URL](https://github.com/deeplethe/lethe) |
| Subjects: | Computation and Language (cs.CL); Artificial Intelligence (cs.AI) |
| ACM classes: | I.2.7; I.2.11; H.3.3 |
| Cite as: | [arXiv:2606.15903](https://arxiv.org/abs/2606.15903) \[cs.CL\] |
|  | (or [arXiv:2606.15903v2](https://arxiv.org/abs/2606.15903v2) \[cs.CL\] for this version) |
|  | [https://doi.org/10.48550/arXiv.2606.15903](https://doi.org/10.48550/arXiv.2606.15903)<br>Focus to learn more<br>arXiv-issued DOI via DataCite |

## Submission history

From: Dongxu Yang \[ [view email](https://arxiv.org/show-email/17f88841/2606.15903)\]

**[\[v1\]](https://arxiv.org/abs/2606.15903v1)**
Sun, 14 Jun 2026 16:32:15 UTC (137 KB)

**\[v2\]**
Tue, 16 Jun 2026 06:16:41 UTC (140 KB)

Full-text links:

## Access Paper:

View a PDF of the paper titled Control-Plane Placement Shapes Forgetting: An Architectural Study of Agent Memory Across Thirteen System Configurations, by Dongxu Yang

- [View PDF](https://arxiv.org/pdf/2606.15903)
- [HTML (experimental)](https://arxiv.org/html/2606.15903v2)
- [TeX Source](https://arxiv.org/src/2606.15903)

[view license](http://arxiv.org/licenses/nonexclusive-distrib/1.0/ "Rights to this article")

### Current browse context:

cs.CL

[< prev](https://arxiv.org/prevnext?id=2606.15903&function=prev&context=cs.CL "previous in cs.CL (accesskey p)")  \|  [next >](https://arxiv.org/prevnext?id=2606.15903&function=next&context=cs.CL "next in cs.CL (accesskey n)")

[new](https://arxiv.org/list/cs.CL/new) \| [recent](https://arxiv.org/list/cs.CL/recent) \| [2026-06](https://arxiv.org/list/cs.CL/2026-06)

Change to browse by:


[cs](https://arxiv.org/abs/2606.15903?context=cs)

[cs.AI](https://arxiv.org/abs/2606.15903?context=cs.AI)

### References & Citations

- [NASA ADS](https://ui.adsabs.harvard.edu/abs/arXiv:2606.15903)
- [Google Scholar](https://scholar.google.com/scholar_lookup?arxiv_id=2606.15903)
- [Semantic Scholar](https://api.semanticscholar.org/arXiv:2606.15903)

export BibTeX citation

### Bookmark

[![BibSonomy](https://arxiv.org/static/browse/0.3.4/images/icons/social/bibsonomy.png)](http://www.bibsonomy.org/BibtexHandler?requTask=upload&url=https://arxiv.org/abs/2606.15903&description=Control-Plane%20Placement%20Shapes%20Forgetting:%20An%20Architectural%20Study%20of%20Agent%20Memory%20Across%20Thirteen%20System%20Configurations "Bookmark on BibSonomy") [![Reddit](https://arxiv.org/static/browse/0.3.4/images/icons/social/reddit.png)](https://reddit.com/submit?url=https://arxiv.org/abs/2606.15903&title=Control-Plane%20Placement%20Shapes%20Forgetting:%20An%20Architectural%20Study%20of%20Agent%20Memory%20Across%20Thirteen%20System%20Configurations "Bookmark on Reddit")

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

[Which authors of this paper are endorsers?](https://arxiv.org/auth/show-endorsers/2606.15903) \|
Disable MathJax ( [What is MathJax?](https://info.arxiv.org/help/mathjax.html))