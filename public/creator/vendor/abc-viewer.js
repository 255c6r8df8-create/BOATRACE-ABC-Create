/* Read-only ABC presentation. No storage writes or forecast recalculation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BOAT_ABC_VIEWER=api;})(globalThis,function(){
 'use strict';
 function mount(host,html){
  if(!host||typeof html!=='string'||!html.trim())throw Error('ABC一覧の原本がありません');
  const doc=new DOMParser().parseFromString(html,'text/html');
  const source=doc.querySelector('main');
  if(!source||source.querySelectorAll('section').length!==26)throw Error('ABC固定26区分を確認できません');
  const root=host.shadowRoot||host.attachShadow({mode:'open'});
  const style=host.ownerDocument.createElement('style');
  style.textContent=[...doc.querySelectorAll('style')].map(s=>s.textContent
   .replace(/:root\b/g,':host').replace(/\bhtml(?=[\s,{])/g,':host')
   .replace(/\bbody(?=[\s,{])/g,'.abc-document').replace(/nav a\b/g,'nav :is(a,button)')).join('\n')+
   '\n:host{display:block;min-width:0;max-width:100%;isolation:isolate}.abc-document{min-width:0;max-width:100%}nav button{font-family:inherit;border:0;cursor:pointer;min-height:44px}section{scroll-margin-top:12px}.horizontal{max-width:100%;touch-action:pan-x pan-y}';
  const content=host.ownerDocument.createElement('div');content.className='abc-document';
  content.appendChild(host.ownerDocument.importNode(source,true));
  content.querySelectorAll('script,iframe,object,embed,base,form,link,meta').forEach(n=>n.remove());
  content.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes]){
   if(/^on/i.test(a.name)||a.name==='srcdoc'||(a.name==='href'&&/^\s*(javascript|data):/i.test(a.value)))n.removeAttribute(a.name);
  }});
  let nav=content.querySelector('nav');if(!nav){nav=host.ownerDocument.createElement('nav');content.firstElementChild.prepend(nav);}
  const labels=new Map([...nav.querySelectorAll('a[href^="#"]')].map(a=>[a.getAttribute('href').slice(1),a.textContent]));
  nav.setAttribute('aria-label','ABC固定26区分へ移動');nav.replaceChildren();
  for(const section of content.querySelectorAll('section')){
   const button=host.ownerDocument.createElement('button');button.type='button';
   button.dataset.abcSection=section.id;button.setAttribute('aria-controls',section.id);
   button.textContent=labels.get(section.id)||section.querySelector('h2')?.textContent||section.id;
   nav.appendChild(button);
  }
  // Convert every remaining local anchor to a button. No URL/hash navigation can
  // resolve against /manager/index.html, including on iPhone and archived dates.
  for(const a of content.querySelectorAll('a[href^="#"]')){
   const b=host.ownerDocument.createElement('button');b.type='button';
   b.dataset.abcSection=a.getAttribute('href').slice(1);b.textContent=a.textContent;a.replaceWith(b);
  }
  const navigate=event=>{
   const button=event.target.closest?.('button[data-abc-section]');if(!button)return;
   event.preventDefault();event.stopPropagation();
   const target=root.getElementById(button.dataset.abcSection);if(!target)return;
   target.scrollIntoView({block:'start',inline:'nearest',behavior:'auto'});
  };
  // A fresh content node owns the handler, so rerendering does not accumulate it.
  content.addEventListener('click',navigate);
  root.replaceChildren(style,content);
  return {sections:[...content.querySelectorAll('section')].map(s=>s.id)};
 }
 return Object.freeze({mount});
});
