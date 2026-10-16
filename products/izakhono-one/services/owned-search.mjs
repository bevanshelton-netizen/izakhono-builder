const africanRegions = Object.freeze({
  'south africa':['gauteng','johannesburg','pretoria','durban','gqeberha','cape town','east london','bloemfontein','polokwane','nelspruit','roodepoort'],
  ghana:['accra','kumasi'], kenya:['nairobi','mombasa'], nigeria:['lagos','abuja'], zambia:['lusaka'], zimbabwe:['harare'], botswana:['gaborone'], namibia:['windhoek'], mozambique:['maputo'], tanzania:['dar es salaam'], uganda:['kampala']
});

function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 60);
}

export function localDiscoverySignals(request = {}) {
  const tokens = tokenize(`${request.query} ${request.country} ${request.region}`);
  const matches = Object.entries(africanRegions).flatMap(([country, regions]) => {
    const hit = tokens.includes(country) || regions.some(region => tokens.includes(region));
    return hit ? [{ country, regions:regions.filter(region => tokens.includes(region)) }] : [];
  });
  return { africa:matches.length > 0, matches };
}

export function createOwnedSearchExecutor({ index = [] } = {}) {
  const entries = Array.isArray(index) ? index.slice(0, 10000) : [];
  return ({ request = {}, signals = {} } = {}) => {
    const queryTokens = tokenize(request.query);
    const results = entries.map((entry, indexPosition) => {
      const haystack = tokenize(`${entry.title} ${entry.description} ${entry.country} ${entry.region} ${entry.category}`).join(' ');
      const score = queryTokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      const africanBoost = signals.african && /africa|south africa|ghana|kenya|nigeria|zambia|zimbabwe|botswana|namibia|mozambique|tanzania|uganda/i.test(`${entry.country} ${entry.region}`) ? 0.5 : 0;
      return { entry, score:score + africanBoost, indexPosition };
    }).filter(item => item.score > 0).sort((a,b) => b.score - a.score || a.indexPosition - b.indexPosition).slice(0, 20);
    return { items:results.map(({entry,score}) => ({ id:entry.id, title:entry.title, url:entry.url, snippet:entry.description, source:entry.source, score })) };
  };
}

export function ownedSearchIndexStats(index = []) {
  const entries = Array.isArray(index) ? index : [];
  return { provider:'owned', records:entries.length, mutable:false, tracking:false };
}
