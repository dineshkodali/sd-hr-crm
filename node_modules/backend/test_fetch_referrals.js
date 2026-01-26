(async ()=>{
  try{
    const res = await fetch('http://localhost:4001/api/safeguarding/referrals?limit=1');
    console.log('status', res.status);
    const text = await res.text();
    console.log(text);
  }catch(e){
    console.error('fetch error', e);
  }
})();
