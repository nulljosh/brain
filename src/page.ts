// The only unauthenticated surface: a shell that asks for the token and then talks to the
// gated API from the browser. No note content is served here.
export const PAGE = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>brain</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--mut:#666;--line:#ddd}
@media(prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--mut:#999;--line:#333}}
*{box-sizing:border-box}
body{margin:0;padding:2rem 1rem;background:var(--bg);color:var(--fg);
font:16px/1.5 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,sans-serif}
main{max-width:44rem;margin:0 auto}
h1{font-size:1.4rem;margin:0 0 .25rem}
p.sub{color:var(--mut);margin:0 0 1.5rem}
input,button,textarea{font:inherit;padding:.6rem .7rem;border:1px solid var(--line);
border-radius:8px;background:var(--bg);color:var(--fg)}
form{display:flex;gap:.5rem;margin:0 0 1rem}
form input{flex:1}
button{cursor:pointer}
label{display:block;color:var(--mut);font-size:.85rem;margin:0 0 .3rem}
#out{white-space:pre-wrap}
.src{color:var(--mut);font-size:.85rem;margin-top:1rem}
</style></head><body><main>
<h1>brain</h1>
<p class="sub">Ask Joshua's notes, roadmaps and wiki.</p>
<label for="tok">Token</label>
<form id="auth"><input id="tok" type="password" placeholder="Bearer token" autocomplete="current-password"></form>
<form id="q"><input id="qi" placeholder="What's blocked on me?" autofocus><button>Ask</button></form>
<div id="out"></div>
</main><script>
const tok=document.getElementById('tok'),out=document.getElementById('out');
tok.value=localStorage.getItem('brain-token')||'';
tok.oninput=()=>localStorage.setItem('brain-token',tok.value);
document.getElementById('auth').onsubmit=e=>e.preventDefault();
document.getElementById('q').onsubmit=async e=>{
  e.preventDefault();
  const q=document.getElementById('qi').value.trim(); if(!q)return;
  out.textContent='Thinking...';
  try{
    const r=await fetch('/api/ask?q='+encodeURIComponent(q),{headers:{authorization:'Bearer '+tok.value}});
    const d=await r.json();
    if(!r.ok){out.textContent=d.error||('HTTP '+r.status);return}
    out.textContent=d.answer||JSON.stringify(d,null,2);
    if(d.sources&&d.sources.length){
      const s=document.createElement('div');s.className='src';
      s.textContent='Sources: '+[...new Set(d.sources.map(x=>x.source||x))].join(', ');
      out.appendChild(s);
    }
  }catch(err){out.textContent=String(err)}
};
</script></body></html>`;
