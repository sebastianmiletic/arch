// sanity-check.mjs - quick integration check
(async () => {
  const res = await fetch('http://localhost:3000/api/health');
  const data = await res.json();
  console.log('Backend health:', JSON.stringify(data));

  const f = await fetch('http://localhost:3000/api/features');
  const features = await f.json();
  console.log('Features loaded:', features.length);
})();
