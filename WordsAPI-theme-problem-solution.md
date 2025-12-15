s

# Theme-Based Word Retrieval with WordsAPI: Problem & Solution Guide

**Audience:** Chat agent / developer building a word app that uses **WordsAPI**.

## TL;DR

- **Problem:** You wanted to input a theme like `"Zoo"` and get a list of words that fit (e.g., _cages, exhibit, gorillas, animals_). WordsAPI **doesn't expose an endpoint** that returns words by a theme or category value.
- **Why:** WordsAPI returns **domain/category metadata per word** via detail endpoints, but its **search** doesn’t let you filter by a specific category value (e.g., `inCategory=zoology`). [WordsAPI docs] show `inCategory`/`hasCategories` only as per-word lookups.
- **Solution:** Use **Datamuse API** to generate themed candidates (via `ml=` _means like_ and `topics=` _topic bias_), optionally constrain **length** (e.g., `sp=?????` for 5 letters), then **enrich / validate** with WordsAPI relations and frequency.

> Primary references:
>
> - WordsAPI documentation (detail endpoints, search params): https://www.wordsapi.com/docs/
> - Datamuse API (topics, means-like, spelled-like): https://www.datamuse.com/api/

---

## The Original Problem

You asked: _“If I give the theme `Zoo`, can the API return words in that theme?”_ You also wanted 5‑letter themed words such as for **Retro** (e.g., _vinyl, disco, sepia_).

### Why WordsAPI alone isn’t enough

- WordsAPI provides per-word details (`/words/{word}/{detail}`), including: `inCategory`, `hasCategories`, `typeOf`, `hasTypes`, `similarTo`, `memberOf`, etc. But there’s **no endpoint** to query _by a category value_ and return all words in that category. [WordsAPI docs]
- The **search** endpoint lets you filter by **structure** (letters/regex), **part of speech**, and whether a word **has** a given detail type (`hasDetails`), but **not by the value** of that detail (e.g., `inCategory=zoology`). [WordsAPI docs]

**Conclusion:** To get words by a theme (like “zoo”), you need an external **topic/semantic retrieval** source.

---

## The Working Solution

We combined **Datamuse** (for theme/topic generation) with **WordsAPI** (for lexical enrichment and validation).

### Step 1 — Generate themed candidates (Datamuse)

Use the Datamuse `/words` endpoint:

- `ml=` → words that _mean like_ the query (reverse dictionary).
- `topics=` → **bias** toward a topic (e.g., `zoo`, `vintage`, `nostalgia`).
- `sp=?????` → constrain to **exactly 5 letters** (each `?` is one character).
- `max=` → cap results; `md=` can return metadata like parts of speech, frequency.

**Examples (curl):**

```bash
# Zoo theme (no length constraint)
curl "https://api.datamuse.com/words?ml=zoo&topics=zoo&max=100"

# Retro theme, exactly 5 letters
curl "https://api.datamuse.com/words?ml=retro&topics=retro,vintage,nostalgia&sp=?????&max=50&md=pf"
```

> Datamuse parameters documented here: https://www.datamuse.com/api/

### Step 2 — Enrich / validate (WordsAPI)

For each candidate, call WordsAPI to:

- **Synonyms / Similarity:** `/words/{word}/synonyms`, `/words/{word}/similarTo`.
- **Hierarchy:** `/words/{word}/typeOf`, `/words/{word}/hasTypes` (hypernyms/hyponyms).
- **Usage:** `/words/{word}/frequency` (returns `zipf`, `perMillion`, `diversity`).
- **Category checks:** `/words/{word}/inCategory`, `/words/{word}/hasCategories` (to keep on-theme when available).

**Examples (curl; via RapidAPI/Mashape):**

```bash
# Similar words for "retro"
curl "https://wordsapiv1.p.mashape.com/words/retro/similarTo" \
  -H "X-Mashape-Key: <YOUR_RAPIDAPI_KEY>"

# Frequency details
curl "https://wordsapiv1.p.mashape.com/words/vinyl/frequency" \
  -H "X-Mashape-Key: <YOUR_RAPIDAPI_KEY>"

# Category lookup (per word)
curl "https://wordsapiv1.p.mashape.com/words/gorilla/inCategory" \
  -H "X-Mashape-Key: <YOUR_RAPIDAPI_KEY>"
```

> WordsAPI endpoints documented here: https://www.wordsapi.com/docs/

### Step 3 — Filter, rank, and curate

- **Length & characters:** keep `^[a-z]{5}$` for 5‑letter words only.
- **Rank:** sort by Datamuse `score` and/or WordsAPI `zipf` frequency.
- **Curate:** maintain allow/deny lists for obscure proper nouns or multiword items.
- **Cache:** store results locally to reduce external calls and keep the app snappy.

---

## Implementation Snippets

### JavaScript (Node / Browser) — Datamuse first

```js
async function getFiveLetterThemeWords(theme = "retro", limit = 50) {
  const params = new URLSearchParams({
    ml: theme,
    topics: `${theme},vintage,nostalgia`,
    sp: "?????",
    max: String(limit),
    md: "pf", // part-of-speech & frequency (optional)
  });
  const url = `https://api.datamuse.com/words?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Datamuse error: ${res.status}`);
  const raw = await res.json();
  const seen = new Set();
  return raw
    .map((r) => r.word.toLowerCase())
    .filter((w) => /^[a-z]{5}$/.test(w) && !seen.has(w) && seen.add(w));
}
```

> Based on Datamuse API semantics: https://www.datamuse.com/api/

### Python — Datamuse first

```python
import requests, re

def themed_five_letter_words(theme='retro', limit=50):
    params = {
        'ml': theme,
        'topics': f'{theme},vintage,nostalgia',
        'sp': '?????',
        'max': str(limit),
        'md': 'pf'
    }
    r = requests.get('https://api.datamuse.com/words', params=params, timeout=20)
    r.raise_for_status()
    raw = r.json()
    seen, out = set(), []
    for item in raw:
        w = item['word'].lower()
        if re.fullmatch(r'[a-z]{5}', w) and w not in seen:
            seen.add(w)
            out.append(w)
    return out
```

### Optional: WordsAPI enrichment (Node sketch)

```js
async function enrichWithWordsAPI(word, apiKey) {
  const base = "https://wordsapiv1.p.mashape.com/words";
  const headers = { "X-Mashape-Key": apiKey };
  const fetchJson = async (path) => {
    const res = await fetch(`${base}/${path}`, { headers });
    if (!res.ok) return null;
    return res.json();
  };
  const frequency = await fetchJson(`${word}/frequency`);
  const similarTo = await fetchJson(`${word}/similarTo`);
  const inCategory = await fetchJson(`${word}/inCategory`);
  return { word, frequency, similarTo, inCategory };
}
```

> WordsAPI endpoints and authentication via RapidAPI: https://www.wordsapi.com/docs/

---

## “Retro” Example (What you expected the app to do)

Using Datamuse with `ml=retro`, `topics=retro,vintage,nostalgia`, and `sp=?????` yields 5‑letter candidates like:

- `vinyl`, `disco`, `sepia`, `oldie`, `radio`, `pager`, `polka`  
  (Results vary by scoring; refine with frequency filters.)
  > This behavior follows Datamuse’s topic/meaning parameters and spelled‑like constraint. https://www.datamuse.com/api/

---

## What the Chat Agent Should Do

When a user asks: _“Give me 5‑letter words for theme `X`”_:

1. **Call Datamuse** with `ml=X`, `topics=X,<synonyms of X>`, `sp=?????`, `max=50`, `md=pf`.
2. **Filter** to `[a-z]{5}` and de‑duplicate.
3. **(Optional) Enrich** each candidate via WordsAPI (`frequency`, `inCategory`, `similarTo`).
4. **Rank & return** top N by combined score/frequency; present a short curated list.
5. **Explain limitations**: Datamuse’s `topics` is a bias hint; results are associative, not taxonomy‑strict. WordsAPI doesn’t support category‑value search.

**If the user specifically requires WordsAPI-only:**

- Use `/words?hasDetails=inCategory` **to find words that have categories**, fetch paginated results, then **client-side filter** those whose per-word `inCategory`/`hasCategories` include the desired domain (e.g., _zoology_). This is heavier and may produce fewer, less clean theme lists. [WordsAPI docs]

---

## Notes & Caveats

- **Rate limits**: Datamuse allows up to ~100k queries/day without an API key; WordsAPI access is via RapidAPI and subject to your plan limits. [Datamuse docs] [WordsAPI docs]
- **Topic vs. category**: Datamuse `topics` is a _ranking hint_, not a strict filter; WordsAPI categories are domain labels derived from lexical resources and applied **per word**, not globally queryable. [Datamuse docs] [WordsAPI docs]
- **Multiword results**: Datamuse may return phrases; filter to single tokens for games like Wordle.
- **Proper nouns**: Consider removing proper nouns unless desired.

---

## References

- **WordsAPI Documentation** — endpoints (`inCategory`, `hasCategories`, `similarTo`, `frequency`), search parameters: https://www.wordsapi.com/docs/
- **Datamuse API** — `ml` (means like), `topics` (context bias), `sp` (spelled-like), metadata: https://www.datamuse.com/api/

[WordsAPI docs]: https://www.wordsapi.com/docs/
[Datamuse docs]: https://www.datamuse.com/api/
